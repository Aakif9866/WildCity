import { describe, expect, it } from 'vitest'
import { pointInPolygon } from '@/game/world/geometry2d'
import { generateDemoCity } from './demo'

describe('generateDemoCity', () => {
  const city = generateDemoCity()

  it('is deterministic', () => {
    expect(generateDemoCity().buildings.length).toBe(city.buildings.length)
    expect(generateDemoCity().trees[5]).toEqual(city.trees[5])
  })

  it('produces buildings, roads, parks, water and trees inside the bounds', () => {
    expect(city.buildings.length).toBeGreaterThan(30)
    expect(city.roads.length).toBe(6)
    expect(city.zones.some((z) => z.kind === 'PARK')).toBe(true)
    expect(city.zones.some((z) => z.kind === 'WATER')).toBe(true)
    for (const b of city.buildings)
      for (const [x, z] of b.footprint) {
        expect(Math.abs(x)).toBeLessThanOrEqual(city.metadata.halfSize)
        expect(Math.abs(z)).toBeLessThanOrEqual(city.metadata.halfSize)
      }
  })

  it('places no tree inside a building', () => {
    for (const [x, z] of city.trees)
      expect(city.buildings.some((b) => pointInPolygon(x, z, b.footprint))).toBe(false)
  })

  it('spawns the player outside every building', () => {
    const { x, z } = city.metadata.spawn
    expect(city.buildings.some((b) => pointInPolygon(x, z, b.footprint))).toBe(false)
  })
})
