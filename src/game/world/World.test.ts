import { describe, expect, it } from 'vitest'
import { generateDemoCity } from '@/cities/demo'
import type { CityData } from '@/cities/types'
import { World } from './World'

const city: CityData = {
  metadata: {
    id: 't',
    name: 't',
    country: 't',
    center: { lat: 0, lon: 0 },
    halfSize: 100,
    spawn: { x: 0, z: 0, yaw: 0 },
  },
  roads: [
    {
      id: 'r',
      kind: 'secondary',
      width: 10,
      points: [
        [-100, 0],
        [100, 0],
      ],
    },
  ],
  buildings: [
    {
      id: 'b',
      footprint: [
        [20, 20],
        [40, 20],
        [40, 40],
        [20, 40],
      ],
      height: 10,
    },
  ],
  zones: [
    {
      kind: 'PARK',
      polygon: [
        [-90, 20],
        [-50, 20],
        [-50, 60],
        [-90, 60],
      ],
    },
    {
      kind: 'WATER',
      polygon: [
        [-80, 30],
        [-60, 30],
        [-60, 50],
        [-80, 50],
      ],
    },
  ],
  trees: [],
}
const world = new World(city)

describe('World', () => {
  it('pushes a circle out of a building from outside and inside', () => {
    const outside = world.resolveCircle(19.5, 30, 1)
    expect(outside.hit).toBe(true)
    expect(outside.x).toBeCloseTo(19, 1)
    const inside = world.resolveCircle(38, 30, 1)
    expect(inside.hit).toBe(true)
    expect(inside.x).toBeGreaterThan(40.9)
    expect(world.buildingAt(inside.x, inside.z)).toBeNull()
  })

  it('leaves a free circle untouched', () => {
    expect(world.resolveCircle(0, 50, 1)).toEqual({ x: 0, z: 50, hit: false })
  })

  it('classifies zones with the right priority', () => {
    expect(world.zoneAt(30, 30)).toBe('BUILDING')
    expect(world.zoneAt(0, 2)).toBe('ROAD')
    expect(world.zoneAt(0, 6)).toBe('SIDEWALK')
    expect(world.zoneAt(-55, 25)).toBe('PARK')
    expect(world.zoneAt(-70, 40)).toBe('WATER')
    expect(world.zoneAt(60, 80)).toBe('RESIDENTIAL')
  })

  it('clamps to bounds', () => {
    expect(world.clampToBounds(500, -500, 1)).toEqual([99, -99])
    expect(world.inBounds(0, 0)).toBe(true)
    expect(world.inBounds(101, 0)).toBe(false)
  })

  it('stops a camera ray at a wall but not in the open', () => {
    expect(Math.abs(world.freeDistance([10, 2, 30], [50, 2, 30]) - 10)).toBeLessThanOrEqual(1)
    expect(world.freeDistance([10, 5, 30], [10, 8, 10])).toBeGreaterThan(20)
    // above the roof line the ray passes over
    expect(world.freeDistance([10, 15, 30], [50, 15, 30])).toBeCloseTo(40, 0)
  })

  it('never leaves demo-city spawn inside a building', () => {
    const demo = generateDemoCity()
    const w = new World(demo)
    expect(w.buildingAt(demo.metadata.spawn.x, demo.metadata.spawn.z)).toBeNull()
  })
})
