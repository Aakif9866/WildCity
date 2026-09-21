import type {
  AreaZone,
  AreaZoneKind,
  Building,
  CityData,
  Road,
  RoadKind,
  Vec2,
} from '@/cities/types'
import { latLonToLocal, type LatLon } from '@/game/world/geo'
import { pointInPolygon, polygonAabb, polygonArea } from '@/game/world/geometry2d'
import {
  clipPolygonToSquare,
  clipPolylineToSquare,
  normalizeRing,
  simplifyLine,
  simplifyRing,
} from '@/game/world/simplify'
import { mulberry32, randRange } from '@/utils/random'

// Minimal shape of Overpass `out geom;` JSON. Everything is treated as untrusted input.
interface GeoPoint {
  lat: number
  lon: number
}
interface OverpassMember {
  type?: string
  role?: string
  geometry?: GeoPoint[]
}
export interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  tags?: Record<string, string>
  geometry?: GeoPoint[]
  members?: OverpassMember[]
}

export interface ConvertOptions {
  id: string
  name: string
  country: string
  center: LatLon
  /** Half the side of the playable square, in metres. */
  halfSize: number
  attribution?: string
  description?: string
}

export interface ConvertReport {
  buildings: number
  roads: number
  areas: Record<AreaZoneKind, number>
  trees: number
  dropped: Record<string, number>
}

const MIN_BUILDING_AREA = 12
const MAX_TREES = 3000

const ROAD_WIDTH: Record<string, number> = {
  motorway: 20,
  trunk: 18,
  primary: 14,
  secondary: 12,
  tertiary: 10,
  unclassified: 8,
  residential: 7,
  living_street: 6,
  service: 5,
  track: 4,
  road: 7,
}
const ROAD_KIND: Record<string, RoadKind> = {
  motorway: 'primary',
  trunk: 'primary',
  primary: 'primary',
  secondary: 'secondary',
  tertiary: 'secondary',
}
const FOOTWAYS = new Set(['footway', 'path', 'pedestrian', 'steps', 'cycleway', 'bridleway'])
const IGNORED_HIGHWAY = new Set([
  'proposed',
  'construction',
  'abandoned',
  'razed',
  'platform',
  'bus_stop',
  'elevator',
  'corridor',
  'raceway',
])

const PARK_LEISURE = new Set([
  'park',
  'garden',
  'playground',
  'recreation_ground',
  'pitch',
  'golf_course',
  'nature_reserve',
])
const PARK_LANDUSE = new Set([
  'grass',
  'recreation_ground',
  'forest',
  'meadow',
  'village_green',
  'cemetery',
  'orchard',
  'flowerbed',
])
const PARK_NATURAL = new Set(['wood', 'scrub', 'grassland', 'heath'])
const WATER_LANDUSE = new Set(['reservoir', 'basin'])
const COMMERCIAL_LANDUSE = new Set(['commercial', 'retail', 'industrial'])

const hash = (s: string): number => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

const validPoint = (p: GeoPoint | undefined): p is GeoPoint =>
  !!p &&
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lon) &&
  Math.abs(p.lat) <= 90 &&
  Math.abs(p.lon) <= 180

const key = (p: GeoPoint): string => `${p.lat.toFixed(7)},${p.lon.toFixed(7)}`

/**
 * Stitch a relation's open outer segments into closed rings. Real-world lakes/parks are usually
 * split across several ways; a ring that never closes is dropped.
 */
export function joinRings(segments: GeoPoint[][]): GeoPoint[][] {
  const pool = segments.filter((s) => s.length >= 2).map((s) => [...s])
  const rings: GeoPoint[][] = []
  while (pool.length > 0) {
    const ring = pool.pop() as GeoPoint[]
    let progressed = true
    while (progressed && key(ring[0] as GeoPoint) !== key(ring[ring.length - 1] as GeoPoint)) {
      progressed = false
      const end = key(ring[ring.length - 1] as GeoPoint)
      for (let i = 0; i < pool.length; i++) {
        const seg = pool[i] as GeoPoint[]
        if (key(seg[0] as GeoPoint) === end) ring.push(...seg.slice(1))
        else if (key(seg[seg.length - 1] as GeoPoint) === end)
          ring.push(...[...seg].reverse().slice(1))
        else continue
        pool.splice(i, 1)
        progressed = true
        break
      }
    }
    if (key(ring[0] as GeoPoint) === key(ring[ring.length - 1] as GeoPoint) && ring.length >= 4)
      rings.push(ring)
  }
  return rings
}

/** All closed outer rings of an element (way ring, or a relation's stitched outer members). */
function outerRings(el: OverpassElement): GeoPoint[][] {
  if (el.type === 'way' && el.geometry) {
    const g = el.geometry
    return g.length >= 4 && key(g[0] as GeoPoint) === key(g[g.length - 1] as GeoPoint) ? [g] : []
  }
  if (el.type === 'relation' && el.members) {
    const outer = el.members
      .filter((m) => m.type === 'way' && m.role !== 'inner' && Array.isArray(m.geometry))
      .map((m) => m.geometry as GeoPoint[])
    return joinRings(outer)
  }
  return []
}

function parseHeight(tags: Record<string, string>, id: number): number {
  const h = parseFloat(tags.height ?? '')
  if (Number.isFinite(h) && h > 0) return Math.min(150, Math.max(3, h))
  const levels = parseFloat(tags['building:levels'] ?? '')
  if (Number.isFinite(levels) && levels > 0) return Math.min(150, Math.max(3, levels * 3.2 + 1))
  // No data: a deterministic 6-13 m so skylines aren't a flat carpet.
  return 6 + (hash(String(id)) % 8)
}

function areaKind(tags: Record<string, string>): AreaZoneKind | null {
  if (
    tags.natural === 'water' ||
    tags.waterway === 'riverbank' ||
    WATER_LANDUSE.has(tags.landuse ?? '')
  )
    return 'WATER'
  if (
    PARK_LEISURE.has(tags.leisure ?? '') ||
    PARK_LANDUSE.has(tags.landuse ?? '') ||
    PARK_NATURAL.has(tags.natural ?? '')
  )
    return 'PARK'
  if (tags.landuse === 'residential' || tags.landuse === 'village') return 'RESIDENTIAL'
  if (COMMERCIAL_LANDUSE.has(tags.landuse ?? '')) return 'COMMERCIAL'
  return null
}

function chooseSpawn(
  roads: Road[],
  buildings: Building[],
  halfSize: number,
): { x: number; z: number; yaw: number } {
  const blocked = (x: number, z: number): boolean =>
    buildings.some((b) => pointInPolygon(x, z, b.footprint))
  // Midpoints of longer road segments: mid-road, never a dead-end vertex where the asphalt just stops.
  const candidates: Vec2[] = []
  for (const r of roads) {
    if (r.kind === 'footway') continue
    for (let i = 0; i < r.points.length - 1; i++) {
      const [ax, az] = r.points[i] as Vec2
      const [bx, bz] = r.points[i + 1] as Vec2
      if (Math.hypot(bx - ax, bz - az) >= 8) candidates.push([(ax + bx) / 2, (az + bz) / 2])
    }
  }
  candidates.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]))
  for (const [x, z] of candidates) {
    if (Math.abs(x) < halfSize * 0.9 && Math.abs(z) < halfSize * 0.9 && !blocked(x, z))
      return { x, z, yaw: 0 }
  }
  for (let r = 0; r < halfSize * 0.9; r += 4) {
    for (let a = 0; a < 16; a++) {
      const x = Math.cos((a / 16) * Math.PI * 2) * r
      const z = Math.sin((a / 16) * Math.PI * 2) * r
      if (!blocked(x, z)) return { x, z, yaw: 0 }
    }
  }
  return { x: 0, z: 0, yaw: 0 }
}

/** Convert an Overpass response into the game's CityData. Malformed features are dropped, not fatal. */
export function convertOverpass(
  data: unknown,
  opts: ConvertOptions,
): { city: CityData; report: ConvertReport } {
  const elements = (data as { elements?: unknown })?.elements
  if (!Array.isArray(elements)) throw new Error('Overpass data has no "elements" array')

  const h = opts.halfSize
  const toLocal = (p: GeoPoint): Vec2 => latLonToLocal(opts.center, p.lat, p.lon)
  const rng = mulberry32(hash(opts.id))
  const report: ConvertReport = {
    buildings: 0,
    roads: 0,
    areas: { PARK: 0, WATER: 0, RESIDENTIAL: 0, COMMERCIAL: 0 },
    trees: 0,
    dropped: {},
  }
  const drop = (why: string): void => void (report.dropped[why] = (report.dropped[why] ?? 0) + 1)

  const buildings: Building[] = []
  const roads: Road[] = []
  const zones: AreaZone[] = []
  const trees: Vec2[] = []

  const ringToLocal = (ring: GeoPoint[], tolerance: number): Vec2[] | null => {
    if (!ring.every(validPoint)) return null
    const local = normalizeRing(ring.map(toLocal))
    if (local.length < 3) return null
    const clipped = clipPolygonToSquare(local, h)
    if (clipped.length < 3) return []
    return simplifyRing(clipped, tolerance)
  }

  for (const el of elements as OverpassElement[]) {
    const tags = el?.tags ?? {}

    if (el.type === 'node') {
      if (tags.natural === 'tree' && Number.isFinite(el.lat) && Number.isFinite(el.lon)) {
        const [x, z] = toLocal({ lat: el.lat as number, lon: el.lon as number })
        if (Math.abs(x) < h && Math.abs(z) < h) trees.push([x, z])
      }
      continue
    }

    if (tags.building && tags.building !== 'no') {
      const rings = outerRings(el)
      if (rings.length === 0) drop('building: not a closed ring')
      for (const ring of rings) {
        const poly = ringToLocal(ring, 0.5)
        if (poly === null) drop('building: bad geometry')
        else if (poly.length === 0) drop('building: outside area')
        else if (Math.abs(polygonArea(poly)) < MIN_BUILDING_AREA) drop('building: too small')
        else
          buildings.push({
            id: `${el.type[0]}${el.id}`,
            footprint: poly,
            height: Math.round(parseHeight(tags, el.id)),
          })
      }
      continue
    }

    if (tags.highway && el.type === 'way') {
      if (IGNORED_HIGHWAY.has(tags.highway) || tags.area === 'yes' || tags.tunnel === 'yes') {
        drop('road: ignored type')
        continue
      }
      if (!el.geometry || el.geometry.length < 2 || !el.geometry.every(validPoint)) {
        drop('road: bad geometry')
        continue
      }
      const footway = FOOTWAYS.has(tags.highway)
      const explicit = parseFloat(tags.width ?? '')
      const width = footway
        ? 2.5
        : Number.isFinite(explicit) && explicit >= 2 && explicit <= 40
          ? explicit
          : (ROAD_WIDTH[tags.highway] ?? 6)
      const kind: RoadKind = footway ? 'footway' : (ROAD_KIND[tags.highway] ?? 'residential')
      const line = simplifyLine(el.geometry.map(toLocal), 1)
      clipPolylineToSquare(line, h).forEach((run, i) =>
        roads.push({ id: `w${el.id}_${i}`, kind, width, points: run }),
      )
      continue
    }

    const kind = areaKind(tags)
    if (kind) {
      const rings = outerRings(el)
      if (rings.length === 0) drop('area: not a closed ring')
      for (const ring of rings) {
        const poly = ringToLocal(ring, 1.5)
        if (poly === null) drop('area: bad geometry')
        else if (poly.length === 0) drop('area: outside area')
        else {
          zones.push({ kind, polygon: poly })
          report.areas[kind]++
        }
      }
    }
  }

  // Trees: mapped ones plus a sparse, reproducible scatter inside parks so they read as green.
  const blocked = (x: number, z: number): boolean =>
    buildings.some((b) => pointInPolygon(x, z, b.footprint))
  for (const zone of zones) {
    if (zone.kind !== 'PARK' || trees.length >= MAX_TREES) continue
    const box = polygonAabb(zone.polygon)
    const count = Math.min(220, Math.floor(Math.abs(polygonArea(zone.polygon)) / 260))
    for (let n = 0, placed = 0; placed < count && n < count * 8; n++) {
      const x = randRange(rng, box.minX, box.maxX)
      const z = randRange(rng, box.minZ, box.maxZ)
      if (pointInPolygon(x, z, zone.polygon) && !blocked(x, z)) {
        trees.push([x, z])
        placed++
      }
    }
  }
  const waterPolys = zones.filter((z) => z.kind === 'WATER')
  const finalTrees = trees
    .filter(([x, z]) => !waterPolys.some((w) => pointInPolygon(x, z, w.polygon)) && !blocked(x, z))
    .slice(0, MAX_TREES)

  report.buildings = buildings.length
  report.roads = roads.length
  report.trees = finalTrees.length

  return {
    city: {
      metadata: {
        id: opts.id,
        name: opts.name,
        country: opts.country,
        center: opts.center,
        halfSize: h,
        spawn: chooseSpawn(roads, buildings, h),
        attribution: opts.attribution,
        description: opts.description,
      },
      roads,
      buildings,
      zones,
      trees: finalTrees,
    },
    report,
  }
}
