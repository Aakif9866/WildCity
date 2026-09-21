import { describe, expect, it } from 'vitest'
import type { Vec2 } from '@/cities/types'
import { polygonArea, rectPolygon } from './geometry2d'
import {
  clipPolygonToSquare,
  clipPolylineToSquare,
  normalizeRing,
  simplifyLine,
  simplifyRing,
} from './simplify'

describe('simplifyLine', () => {
  it('drops collinear/near-collinear points but keeps corners', () => {
    const line: Vec2[] = [
      [0, 0],
      [5, 0.05],
      [10, 0],
      [10, 10],
    ]
    expect(simplifyLine(line, 0.5)).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
    ])
  })
  it('keeps everything when tolerance is tiny, and handles short lines', () => {
    const line: Vec2[] = [
      [0, 0],
      [5, 1],
      [10, 0],
    ]
    expect(simplifyLine(line, 0.01)).toHaveLength(3)
    expect(
      simplifyLine(
        [
          [0, 0],
          [1, 1],
        ],
        5,
      ),
    ).toHaveLength(2)
  })
})

describe('rings', () => {
  it('normalizeRing removes the closing duplicate and repeated points', () => {
    expect(
      normalizeRing([
        [0, 0],
        [4, 0],
        [4, 0],
        [4, 4],
        [0, 0],
      ]),
    ).toEqual([
      [0, 0],
      [4, 0],
      [4, 4],
    ])
  })
  it('simplifyRing keeps at least a triangle', () => {
    const ring = rectPolygon(0, 0, 10, 10)
    expect(simplifyRing(ring, 0.1).length).toBe(4)
    expect(
      simplifyRing(
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        100,
      ),
    ).toHaveLength(3)
  })
})

describe('clipPolygonToSquare', () => {
  it('leaves an inside polygon unchanged', () => {
    const p = rectPolygon(-5, -5, 5, 5)
    expect(polygonArea(clipPolygonToSquare(p, 10))).toBeCloseTo(100)
  })
  it('cuts a polygon straddling the edge down to the visible part', () => {
    const p = rectPolygon(0, 0, 40, 10) // half outside a 20-m half-size square
    expect(Math.abs(polygonArea(clipPolygonToSquare(p, 20)))).toBeCloseTo(200)
  })
  it('returns nothing for polygons fully outside', () => {
    expect(clipPolygonToSquare(rectPolygon(50, 50, 60, 60), 20)).toEqual([])
  })
  it('a huge polygon covering the whole square clips to the square', () => {
    expect(
      Math.abs(polygonArea(clipPolygonToSquare(rectPolygon(-1000, -1000, 1000, 1000), 20))),
    ).toBeCloseTo(1600)
  })
})

describe('clipPolylineToSquare', () => {
  it('trims a line that crosses the boundary', () => {
    const runs = clipPolylineToSquare(
      [
        [-50, 0],
        [50, 0],
      ],
      20,
    )
    expect(runs).toHaveLength(1)
    expect(runs[0]).toEqual([
      [-20, 0],
      [20, 0],
    ])
  })
  it('splits a line that leaves and re-enters into runs', () => {
    const runs = clipPolylineToSquare(
      [
        [0, 0],
        [30, 0],
        [30, 10],
        [0, 10],
      ],
      20,
    )
    expect(runs).toHaveLength(2)
  })
  it('drops lines entirely outside and keeps inside ones intact', () => {
    expect(
      clipPolylineToSquare(
        [
          [100, 100],
          [120, 100],
        ],
        20,
      ),
    ).toEqual([])
    expect(
      clipPolylineToSquare(
        [
          [-5, -5],
          [0, 3],
          [5, 5],
        ],
        20,
      ),
    ).toEqual([
      [
        [-5, -5],
        [0, 3],
        [5, 5],
      ],
    ])
  })
})
