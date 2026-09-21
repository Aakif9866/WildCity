import {
  SIDEWALK_WIDTH,
  type AreaZone,
  type CityData,
  type Vec2,
  type ZoneKind,
} from '@/cities/types'
import { closestPointOnSegment, pointInPolygon, polygonAabb, type Aabb } from './geometry2d'
import { SpatialGrid } from './SpatialGrid'

export interface BuildingCollider {
  id: string
  poly: readonly Vec2[]
  aabb: Aabb
  height: number
}

interface RoadSegment {
  ax: number
  az: number
  bx: number
  bz: number
  half: number
  footway: boolean
}

interface AreaCollider {
  kind: AreaZone['kind']
  poly: readonly Vec2[]
  aabb: Aabb
}

const overlaps = (a: Aabb, minX: number, minZ: number, maxX: number, maxZ: number): boolean =>
  a.minX <= maxX && a.maxX >= minX && a.minZ <= maxZ && a.maxZ >= minZ

// Area zones are checked in this order: first match wins.
const AREA_PRIORITY: AreaZone['kind'][] = ['WATER', 'PARK', 'COMMERCIAL', 'RESIDENTIAL']

/**
 * Query layer over CityData: collision, zone lookup and terrain height. Pure logic, no rendering,
 * so player, camera and animal AI all share one source of truth about the world.
 */
export class World {
  readonly halfSize: number
  readonly city: CityData
  private readonly buildingGrid = new SpatialGrid<BuildingCollider>()
  private readonly roadGrid = new SpatialGrid<RoadSegment>()
  private readonly areaGrid = new SpatialGrid<AreaCollider>()

  constructor(city: CityData) {
    this.city = city
    this.halfSize = city.metadata.halfSize

    for (const b of city.buildings) {
      if (b.footprint.length < 3) continue
      const aabb = polygonAabb(b.footprint)
      this.buildingGrid.insert({ id: b.id, poly: b.footprint, aabb, height: b.height }, aabb)
    }

    for (const r of city.roads) {
      const half = r.width / 2
      const reach = half + SIDEWALK_WIDTH
      for (let i = 0; i < r.points.length - 1; i++) {
        const [ax, az] = r.points[i] as Vec2
        const [bx, bz] = r.points[i + 1] as Vec2
        this.roadGrid.insert(
          { ax, az, bx, bz, half, footway: r.kind === 'footway' },
          {
            minX: Math.min(ax, bx) - reach,
            maxX: Math.max(ax, bx) + reach,
            minZ: Math.min(az, bz) - reach,
            maxZ: Math.max(az, bz) + reach,
          },
        )
      }
    }

    for (const z of city.zones) {
      if (z.polygon.length < 3) continue
      const aabb = polygonAabb(z.polygon)
      this.areaGrid.insert({ kind: z.kind, poly: z.polygon, aabb }, aabb)
    }
  }

  /** Ground height. Flat for now (OSM has no elevation); every system goes through this hook. */
  heightAt(_x: number, _z: number): number {
    return 0
  }

  buildingAt(x: number, z: number): BuildingCollider | null {
    for (const b of this.buildingGrid.queryPoint(x, z)) {
      const a = b.aabb
      if (x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ && pointInPolygon(x, z, b.poly))
        return b
    }
    return null
  }

  /** True if the 3D point is inside a building volume. */
  isSolidAt(x: number, y: number, z: number): boolean {
    const b = this.buildingAt(x, z)
    return b !== null && y < b.height
  }

  inBounds(x: number, z: number, margin = 0): boolean {
    const h = this.halfSize - margin
    return Math.abs(x) <= h && Math.abs(z) <= h
  }

  clampToBounds(x: number, z: number, margin = 1): Vec2 {
    const h = this.halfSize - margin
    return [Math.max(-h, Math.min(h, x)), Math.max(-h, Math.min(h, z))]
  }

  /** Push a circle out of any building footprint it overlaps. Iterates so corners settle. */
  resolveCircle(x: number, z: number, r: number): { x: number; z: number; hit: boolean } {
    let px = x
    let pz = z
    let hit = false
    for (let iter = 0; iter < 4; iter++) {
      let moved = false
      for (const b of this.buildingGrid.queryBox(px - r, pz - r, px + r, pz + r)) {
        if (!overlaps(b.aabb, px - r, pz - r, px + r, pz + r)) continue
        let best = Infinity
        let cx = 0
        let cz = 0
        for (let i = 0, j = b.poly.length - 1; i < b.poly.length; j = i++) {
          const a = b.poly[j] as Vec2
          const c = b.poly[i] as Vec2
          const s = closestPointOnSegment(px, pz, a[0], a[1], c[0], c[1])
          if (s.dist < best) {
            best = s.dist
            cx = s.x
            cz = s.z
          }
        }
        const inside = pointInPolygon(px, pz, b.poly)
        if (!inside && best >= r) continue
        if (best < 1e-6) continue
        // Inside: escape through the nearest edge. Outside but too close: back off to radius r.
        const dirX = inside ? (cx - px) / best : (px - cx) / best
        const dirZ = inside ? (cz - pz) / best : (pz - cz) / best
        px = cx + dirX * r
        pz = cz + dirZ * r
        moved = true
      }
      if (!moved) break
      hit = true
    }
    return { x: px, z: pz, hit }
  }

  zoneAt(x: number, z: number): ZoneKind {
    if (this.buildingAt(x, z)) return 'BUILDING'

    let nearest = Infinity
    let nearestHalf = 0
    let footwayOnly = true
    for (const s of this.roadGrid.queryPoint(x, z)) {
      const d = closestPointOnSegment(x, z, s.ax, s.az, s.bx, s.bz).dist
      if (d < nearest) {
        nearest = d
        nearestHalf = s.half
      }
      if (!s.footway && d <= s.half) footwayOnly = false
    }
    if (nearest <= nearestHalf) return footwayOnly ? 'SIDEWALK' : 'ROAD'
    if (nearest <= nearestHalf + SIDEWALK_WIDTH) return 'SIDEWALK'

    const areas = this.areaGrid.queryPoint(x, z)
    for (const kind of AREA_PRIORITY) {
      for (const a of areas) {
        if (a.kind === kind && pointInPolygon(x, z, a.poly)) return kind
      }
    }
    return 'RESIDENTIAL'
  }

  /**
   * Walk from `from` towards `to` and return the furthest point that isn't inside a building
   * or underground. Used to keep the camera from clipping through walls.
   */
  freeDistance(
    from: readonly [number, number, number],
    to: readonly [number, number, number],
    step = 0.5,
  ): number {
    const dx = to[0] - from[0]
    const dy = to[1] - from[1]
    const dz = to[2] - from[2]
    const len = Math.hypot(dx, dy, dz)
    for (let d = step; d <= len; d += step) {
      const t = d / len
      const x = from[0] + dx * t
      const y = from[1] + dy * t
      const z = from[2] + dz * t
      if (y < this.heightAt(x, z) + 0.3 || this.isSolidAt(x, y, z)) return Math.max(0, d - step)
    }
    return len
  }
}
