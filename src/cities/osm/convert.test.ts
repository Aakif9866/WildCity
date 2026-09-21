import { describe, expect, it } from 'vitest'
import { localToLatLon } from '@/game/world/geo'
import { distanceToPolyline, pointInPolygon } from '@/game/world/geometry2d'
import { convertOverpass, joinRings, type OverpassElement } from './convert'

const center = { lat: 17.41, lon: 78.47 }
const pt = (x: number, z: number) => localToLatLon(center, x, z)
const ring = (pts: [number, number][]) => pts.map(([x, z]) => pt(x, z))
const rect = (x0: number, z0: number, x1: number, z1: number) =>
  ring([
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
    [x0, z0],
  ])
const opts = {
  id: 'test',
  name: 'Test',
  country: 'X',
  center,
  halfSize: 200,
  attribution: '© OpenStreetMap contributors',
}

const elements: OverpassElement[] = [
  { type: 'way', id: 1, tags: { building: 'yes', height: '20' }, geometry: rect(20, 20, 40, 40) },
  {
    type: 'way',
    id: 2,
    tags: { building: 'residential', 'building:levels': '5' },
    geometry: rect(60, 20, 80, 40),
  },
  { type: 'way', id: 3, tags: { building: 'yes' }, geometry: rect(-90, 20, -70, 30) },
  { type: 'way', id: 4, tags: { building: 'yes' }, geometry: rect(100, 100, 102, 102) }, // 4 m^2: too small
  { type: 'way', id: 5, tags: { building: 'yes' }, geometry: rect(500, 500, 520, 520) }, // outside
  {
    type: 'way',
    id: 6,
    tags: { building: 'yes' },
    geometry: [{ lat: NaN, lon: 1 }, ...rect(0, 0, 10, 10)],
  }, // malformed
  { type: 'way', id: 7, tags: { building: 'no' }, geometry: rect(-50, -50, -30, -30) }, // explicitly not a building
  {
    type: 'way',
    id: 10,
    tags: { highway: 'primary' },
    geometry: ring([
      [-300, 0],
      [300, 0],
    ]),
  },
  {
    type: 'way',
    id: 11,
    tags: { highway: 'residential', width: '9' },
    geometry: ring([
      [0, -100],
      [0, 100],
    ]),
  },
  {
    type: 'way',
    id: 12,
    tags: { highway: 'footway' },
    geometry: ring([
      [10, 10],
      [30, 10],
    ]),
  },
  {
    type: 'way',
    id: 13,
    tags: { highway: 'primary', tunnel: 'yes' },
    geometry: ring([
      [-100, 50],
      [100, 50],
    ]),
  },
  {
    type: 'way',
    id: 14,
    tags: { highway: 'proposed' },
    geometry: ring([
      [-100, 60],
      [100, 60],
    ]),
  },
  { type: 'way', id: 15, tags: { highway: 'service' }, geometry: [pt(0, 0)] }, // single point
  { type: 'way', id: 20, tags: { leisure: 'park' }, geometry: rect(-150, -150, -50, -50) },
  { type: 'way', id: 21, tags: { landuse: 'residential' }, geometry: rect(-190, 60, 190, 190) },
  {
    // A lake split across two open outer ways, as real relations often are.
    type: 'relation',
    id: 30,
    tags: { natural: 'water', type: 'multipolygon' },
    members: [
      {
        type: 'way',
        role: 'outer',
        geometry: ring([
          [100, -100],
          [160, -100],
          [160, -40],
        ]),
      },
      {
        type: 'way',
        role: 'outer',
        geometry: ring([
          [160, -40],
          [100, -40],
          [100, -100],
        ]),
      },
    ],
  },
  { type: 'node', id: 40, lat: pt(-5, -5).lat, lon: pt(-5, -5).lon, tags: { natural: 'tree' } },
  { type: 'node', id: 41, lat: pt(900, 900).lat, lon: pt(900, 900).lon, tags: { natural: 'tree' } },
]

describe('convertOverpass', () => {
  const { city, report } = convertOverpass({ elements }, opts)
  const byId = (id: string) => city.buildings.find((b) => b.id === id)

  it('keeps valid buildings and drops tiny, outside, malformed and non-building ones', () => {
    expect(city.buildings.map((b) => b.id).sort()).toEqual(['w1', 'w2', 'w3'])
    expect(report.dropped['building: too small']).toBe(1)
    expect(report.dropped['building: outside area']).toBe(1)
    expect(report.dropped['building: not a closed ring']).toBe(1)
  })

  it('derives heights from height, levels, or a deterministic fallback', () => {
    expect(byId('w1')?.height).toBe(20)
    expect(byId('w2')?.height).toBe(17) // 5 levels * 3.2 + 1
    const fallback = byId('w3')!.height
    expect(fallback).toBeGreaterThanOrEqual(6)
    expect(fallback).toBeLessThanOrEqual(13)
    expect(
      convertOverpass({ elements }, opts).city.buildings.find((b) => b.id === 'w3')?.height,
    ).toBe(fallback)
  })

  it('places buildings at the right local coordinates (x east, z south)', () => {
    const xs = byId('w1')!.footprint.map((p) => p[0])
    const zs = byId('w1')!.footprint.map((p) => p[1])
    expect(Math.min(...xs)).toBeCloseTo(20, 0)
    expect(Math.max(...xs)).toBeCloseTo(40, 0)
    expect(Math.min(...zs)).toBeCloseTo(20, 0)
  })

  it('classifies roads by width and kind, clips them, and drops tunnels/proposed/broken ones', () => {
    const primary = city.roads.find((r) => r.id.startsWith('w10'))!
    expect(primary.kind).toBe('primary')
    expect(primary.width).toBe(14)
    expect(Math.min(...primary.points.map((p) => p[0]))).toBeCloseTo(-200, 0) // clipped to the square
    expect(Math.max(...primary.points.map((p) => p[0]))).toBeCloseTo(200, 0)
    expect(city.roads.find((r) => r.id.startsWith('w11'))!.width).toBe(9)
    expect(city.roads.find((r) => r.id.startsWith('w12'))!.kind).toBe('footway')
    expect(city.roads.some((r) => ['w13_0', 'w14_0', 'w15_0'].includes(r.id))).toBe(false)
  })

  it('creates zones: park, landuse, and a lake stitched from two open segments', () => {
    expect(report.areas.PARK).toBe(1)
    expect(report.areas.RESIDENTIAL).toBe(1)
    expect(report.areas.WATER).toBe(1)
    const lake = city.zones.find((z) => z.kind === 'WATER')!
    expect(pointInPolygon(130, -70, lake.polygon)).toBe(true)
    expect(pointInPolygon(0, 0, lake.polygon)).toBe(false)
  })

  it('keeps mapped trees inside the area and scatters trees inside parks only', () => {
    expect(city.trees.some(([x, z]) => Math.abs(x + 5) < 1 && Math.abs(z + 5) < 1)).toBe(true)
    expect(city.trees.some(([x, z]) => Math.abs(x) > 200 || Math.abs(z) > 200)).toBe(false)
    const park = city.zones.find((z) => z.kind === 'PARK')!
    expect(
      city.trees.filter(([x, z]) => pointInPolygon(x, z, park.polygon)).length,
    ).toBeGreaterThan(10)
  })

  it('never puts trees in buildings or water', () => {
    const lake = city.zones.find((z) => z.kind === 'WATER')!
    for (const [x, z] of city.trees) {
      expect(city.buildings.some((b) => pointInPolygon(x, z, b.footprint))).toBe(false)
      expect(pointInPolygon(x, z, lake.polygon)).toBe(false)
    }
  })

  it('chooses a spawn on a road, outside every building, inside the area', () => {
    const { x, z } = city.metadata.spawn
    expect(city.buildings.some((b) => pointInPolygon(x, z, b.footprint))).toBe(false)
    expect(Math.abs(x)).toBeLessThan(200)
    expect(Math.abs(z)).toBeLessThan(200)
    expect(Math.min(...city.roads.map((r) => distanceToPolyline(x, z, r.points)))).toBeLessThan(0.5)
  })

  it('carries metadata and attribution, and is deterministic', () => {
    expect(city.metadata.attribution).toContain('OpenStreetMap')
    expect(city.metadata.halfSize).toBe(200)
    expect(convertOverpass({ elements }, opts).city.trees).toEqual(city.trees)
  })

  it('rejects data that is not an Overpass response', () => {
    expect(() => convertOverpass({}, opts)).toThrow(/elements/)
    expect(() => convertOverpass(null, opts)).toThrow()
  })

  it('an empty response still yields a valid (empty) city with a spawn', () => {
    const empty = convertOverpass({ elements: [] }, opts).city
    expect(empty.buildings).toEqual([])
    expect(empty.metadata.spawn).toEqual({ x: 0, z: 0, yaw: 0 })
  })
})

describe('joinRings', () => {
  const p = (n: number) => ({ lat: n, lon: n })
  it('stitches segments regardless of direction', () => {
    const rings = joinRings([
      [p(1), p(2), p(3)],
      [p(1), p(4), p(3)],
    ])
    expect(rings).toHaveLength(1)
    expect(rings[0]!.length).toBe(5)
  })
  it('drops rings that never close', () => {
    expect(joinRings([[p(1), p(2), p(3)]])).toEqual([])
  })
})
