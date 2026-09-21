import type { Vec2 } from '@/cities/types'
import { polygonArea } from './geometry2d'

function perpendicularDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const len = Math.hypot(dx, dz)
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
  return Math.abs(dz * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len
}

/** Douglas–Peucker: drop points that deviate less than `tolerance` metres from the simplified line. */
export function simplifyLine(points: readonly Vec2[], tolerance: number): Vec2[] {
  if (points.length < 3) return [...points]
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length > 0) {
    const [lo, hi] = stack.pop() as [number, number]
    let worst = 0
    let index = -1
    for (let i = lo + 1; i < hi; i++) {
      const d = perpendicularDistance(points[i] as Vec2, points[lo] as Vec2, points[hi] as Vec2)
      if (d > worst) {
        worst = d
        index = i
      }
    }
    if (index !== -1 && worst > tolerance) {
      keep[index] = 1
      stack.push([lo, index], [index, hi])
    }
  }
  return points.filter((_, i) => keep[i] === 1)
}

/** Simplify a closed ring (no repeated closing point). Keeps at least 3 points or returns the original. */
export function simplifyRing(ring: readonly Vec2[], tolerance: number): Vec2[] {
  if (ring.length <= 3) return [...ring]
  const open = simplifyLine([...ring, ring[0] as Vec2], tolerance)
  open.pop()
  return open.length >= 3 ? open : [...ring]
}

/** Remove the duplicate closing point OSM rings carry, and consecutive duplicates. */
export function normalizeRing(ring: readonly Vec2[]): Vec2[] {
  const out: Vec2[] = []
  for (const p of ring) {
    const last = out[out.length - 1]
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p)
  }
  const first = out[0]
  const last = out[out.length - 1]
  if (out.length > 1 && first && last && first[0] === last[0] && first[1] === last[1]) out.pop()
  return out
}

/** Clip a polygon to the square [-h, h]^2 (Sutherland–Hodgman). Returns [] if nothing remains. */
export function clipPolygonToSquare(poly: readonly Vec2[], h: number): Vec2[] {
  type Edge = { inside: (p: Vec2) => boolean; cross: (a: Vec2, b: Vec2) => Vec2 }
  const edges: Edge[] = [
    {
      inside: (p) => p[0] >= -h,
      cross: (a, b) => [-h, a[1] + ((b[1] - a[1]) * (-h - a[0])) / (b[0] - a[0])],
    },
    {
      inside: (p) => p[0] <= h,
      cross: (a, b) => [h, a[1] + ((b[1] - a[1]) * (h - a[0])) / (b[0] - a[0])],
    },
    {
      inside: (p) => p[1] >= -h,
      cross: (a, b) => [a[0] + ((b[0] - a[0]) * (-h - a[1])) / (b[1] - a[1]), -h],
    },
    {
      inside: (p) => p[1] <= h,
      cross: (a, b) => [a[0] + ((b[0] - a[0]) * (h - a[1])) / (b[1] - a[1]), h],
    },
  ]
  let output: Vec2[] = [...poly]
  for (const edge of edges) {
    const input = output
    output = []
    for (let i = 0; i < input.length; i++) {
      const cur = input[i] as Vec2
      const prev = input[(i + input.length - 1) % input.length] as Vec2
      if (edge.inside(cur)) {
        if (!edge.inside(prev)) output.push(edge.cross(prev, cur))
        output.push(cur)
      } else if (edge.inside(prev)) output.push(edge.cross(prev, cur))
    }
    if (output.length === 0) return []
  }
  return output.length >= 3 && Math.abs(polygonArea(output)) > 1e-6 ? output : []
}

/** Clip a polyline to the square; a line that leaves and re-enters becomes several runs. */
export function clipPolylineToSquare(points: readonly Vec2[], h: number): Vec2[][] {
  const runs: Vec2[][] = []
  let current: Vec2[] = []
  const flush = (): void => {
    if (current.length >= 2) runs.push(current)
    current = []
  }
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, z0] = points[i] as Vec2
    const [x1, z1] = points[i + 1] as Vec2
    // Liang–Barsky against the square.
    let t0 = 0
    let t1 = 1
    const dx = x1 - x0
    const dz = z1 - z0
    let visible = true
    for (const [p, q] of [
      [-dx, x0 + h],
      [dx, h - x0],
      [-dz, z0 + h],
      [dz, h - z0],
    ] as const) {
      if (p === 0) {
        if (q < 0) visible = false
      } else {
        const r = q / p
        if (p < 0) t0 = Math.max(t0, r)
        else t1 = Math.min(t1, r)
      }
    }
    if (!visible || t0 > t1) {
      flush()
      continue
    }
    const a: Vec2 = [x0 + dx * t0, z0 + dz * t0]
    const b: Vec2 = [x0 + dx * t1, z0 + dz * t1]
    const last = current[current.length - 1]
    if (!last || Math.hypot(last[0] - a[0], last[1] - a[1]) > 1e-6) {
      flush()
      current.push(a)
    }
    current.push(b)
    if (t1 < 1) flush() // left the square
  }
  flush()
  return runs
}
