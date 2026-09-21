import { describe, expect, it } from 'vitest'
import type { Vec2 } from '@/cities/types'
import {
  closestPointOnSegment,
  distanceToPolyline,
  pointInPolygon,
  polygonArea,
  rectPolygon,
} from './geometry2d'

const L: Vec2[] = [
  [0, 0],
  [10, 0],
  [10, 4],
  [4, 4],
  [4, 10],
  [0, 10],
]

describe('geometry2d', () => {
  it('detects points inside a concave polygon', () => {
    expect(pointInPolygon(2, 2, L)).toBe(true)
    expect(pointInPolygon(8, 2, L)).toBe(true)
    expect(pointInPolygon(8, 8, L)).toBe(false)
    expect(pointInPolygon(-1, 5, L)).toBe(false)
  })

  it('finds the closest point on a segment, clamped to endpoints', () => {
    expect(closestPointOnSegment(5, 3, 0, 0, 10, 0)).toMatchObject({ dist: 3, x: 5, z: 0 })
    expect(closestPointOnSegment(-4, 3, 0, 0, 10, 0)).toMatchObject({ dist: 5, x: 0, z: 0 })
  })

  it('measures distance to a polyline', () => {
    expect(
      distanceToPolyline(5, 2, [
        [0, 0],
        [10, 0],
        [10, 10],
      ]),
    ).toBe(2)
  })

  it('computes signed area', () => {
    expect(polygonArea(rectPolygon(0, 0, 4, 3))).toBeCloseTo(12)
  })
})
