import type {
  AreaZone,
  AreaZoneKind,
  Building,
  CityData,
  CityMetadata,
  Road,
  RoadKind,
  Vec2,
} from './types'

const ROAD_KINDS: readonly RoadKind[] = ['primary', 'secondary', 'residential', 'footway']
const AREA_KINDS: readonly AreaZoneKind[] = ['PARK', 'WATER', 'RESIDENTIAL', 'COMMERCIAL']

export class CityDataError extends Error {}

export interface ParsedCity {
  city: CityData
  /** Non-fatal problems (features skipped because their geometry was malformed). */
  warnings: string[]
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isVec2 = (v: unknown): v is Vec2 =>
  Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1])
const isPoly = (v: unknown, min: number): v is Vec2[] =>
  Array.isArray(v) && v.length >= min && v.every(isVec2)
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0

function parseMetadata(raw: unknown): CityMetadata {
  const m = raw as Partial<CityMetadata> | null
  if (
    !m ||
    !isStr(m.id) ||
    !isStr(m.name) ||
    !isNum(m.center?.lat) ||
    !isNum(m.center?.lon) ||
    !isNum(m.halfSize) ||
    m.halfSize < 20 ||
    m.halfSize > 5000 ||
    !isNum(m.spawn?.x) ||
    !isNum(m.spawn?.z)
  )
    throw new CityDataError('City metadata is missing or invalid')
  return {
    id: m.id,
    name: m.name,
    country: typeof m.country === 'string' ? m.country : '',
    center: { lat: m.center.lat, lon: m.center.lon },
    halfSize: m.halfSize,
    spawn: { x: m.spawn.x, z: m.spawn.z, yaw: isNum(m.spawn.yaw) ? m.spawn.yaw : 0 },
    attribution: typeof m.attribution === 'string' ? m.attribution : undefined,
    description: typeof m.description === 'string' ? m.description : undefined,
  }
}

/**
 * Validate raw city JSON. Bad features are skipped with a warning; a city with nothing usable
 * (or broken metadata) is rejected so the game never starts in a half-empty world.
 */
export function parseCityData(
  rawMeta: unknown,
  rawRoads: unknown,
  rawBuildings: unknown,
  rawZones: unknown,
): ParsedCity {
  const metadata = parseMetadata(rawMeta)
  const warnings: string[] = []
  const skipped = (what: string, n: number): void => {
    if (n > 0) warnings.push(`skipped ${n} malformed ${what}`)
  }

  const roads: Road[] = []
  let badRoads = 0
  for (const r of Array.isArray(rawRoads) ? (rawRoads as Record<string, unknown>[]) : []) {
    if (
      r &&
      isStr(r.id) &&
      ROAD_KINDS.includes(r.kind as RoadKind) &&
      isNum(r.width) &&
      r.width > 0 &&
      r.width < 60 &&
      isPoly(r.points, 2)
    )
      roads.push({ id: r.id, kind: r.kind as RoadKind, width: r.width, points: r.points })
    else badRoads++
  }
  skipped('roads', badRoads)

  const buildings: Building[] = []
  let badBuildings = 0
  for (const b of Array.isArray(rawBuildings) ? (rawBuildings as Record<string, unknown>[]) : []) {
    if (
      b &&
      isStr(b.id) &&
      isNum(b.height) &&
      b.height > 0 &&
      b.height < 500 &&
      isPoly(b.footprint, 3)
    )
      buildings.push({ id: b.id, footprint: b.footprint, height: b.height })
    else badBuildings++
  }
  skipped('buildings', badBuildings)

  const zonesRaw = rawZones as { areas?: unknown; trees?: unknown } | null
  const zones: AreaZone[] = []
  let badZones = 0
  for (const z of Array.isArray(zonesRaw?.areas)
    ? (zonesRaw.areas as Record<string, unknown>[])
    : []) {
    if (z && AREA_KINDS.includes(z.kind as AreaZoneKind) && isPoly(z.polygon, 3))
      zones.push({ kind: z.kind as AreaZoneKind, polygon: z.polygon })
    else badZones++
  }
  skipped('zones', badZones)
  const trees: Vec2[] = Array.isArray(zonesRaw?.trees)
    ? (zonesRaw.trees as unknown[]).filter(isVec2)
    : []

  if (roads.length === 0 && buildings.length === 0 && zones.length === 0)
    throw new CityDataError('City data contains no usable geometry')

  return { city: { metadata, roads, buildings, zones, trees }, warnings }
}
