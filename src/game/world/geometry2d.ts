import type { Vec2 } from '@/cities/types'

export interface Aabb {
  minX: number
  minZ: number
  maxX: number
  maxZ: number
}

export function polygonAabb(poly: readonly Vec2[]): Aabb {
  let minX = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxZ = -Infinity
  for (const [x, z] of poly) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }
  return { minX, minZ, maxX, maxZ }
}

/** Ray-casting point-in-polygon; works for concave polygons. */
export function pointInPolygon(x: number, z: number, poly: readonly Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i] as Vec2
    const [xj, zj] = poly[j] as Vec2
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

export interface SegmentHit {
  /** Distance from the point to the closest point on the segment. */
  dist: number
  /** Closest point on the segment. */
  x: number
  z: number
}

export function closestPointOnSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): SegmentHit {
  const dx = bx - ax
  const dz = bz - az
  const lenSq = dx * dx + dz * dz
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lenSq))
  const x = ax + t * dx
  const z = az + t * dz
  return { dist: Math.hypot(px - x, pz - z), x, z }
}

/** Shortest distance from a point to a polyline. */
export function distanceToPolyline(px: number, pz: number, pts: readonly Vec2[]): number {
  let best = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i] as Vec2
    const b = pts[i + 1] as Vec2
    best = Math.min(best, closestPointOnSegment(px, pz, a[0], a[1], b[0], b[1]).dist)
  }
  return best
}

/** Signed area; positive = counter-clockwise in (x, z). */
export function polygonArea(poly: readonly Vec2[]): number {
  let a = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i] as Vec2
    const [xj, zj] = poly[j] as Vec2
    a += xj * zi - xi * zj
  }
  return a / 2
}

export const rectPolygon = (minX: number, minZ: number, maxX: number, maxZ: number): Vec2[] => [
  [minX, minZ],
  [maxX, minZ],
  [maxX, maxZ],
  [minX, maxZ],
]
