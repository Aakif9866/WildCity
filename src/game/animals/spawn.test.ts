import { beforeAll, describe, expect, it } from 'vitest'
import { generateDemoCity } from '@/cities/demo'
import { NavGrid } from '@/game/navigation/NavGrid'
import { World } from '@/game/world/World'
import { mulberry32 } from '@/utils/random'
import { SPECIES } from './species'
import { spawnAnimals } from './spawn'

let world: World
let nav: NavGrid
beforeAll(() => {
  world = new World(generateDemoCity())
  nav = new NavGrid(world)
})

describe('spawnAnimals', () => {
  it('spawns the requested count, on walkable ground, away from the player', () => {
    const animals = spawnAnimals([{ species: SPECIES.dog, count: 12 }], world, nav, mulberry32(5), {
      x: 0,
      z: 20,
    })
    expect(animals).toHaveLength(12)
    expect(new Set(animals.map((a) => a.id)).size).toBe(12)
    for (const a of animals) {
      expect(nav.isWalkable(a.position.x, a.position.z)).toBe(true)
      expect(world.buildingAt(a.position.x, a.position.z)).toBeNull()
      expect(Math.hypot(a.position.x, a.position.z - 20)).toBeGreaterThanOrEqual(15)
    }
  })

  it('draws personality within the species ranges', () => {
    const { personality } = SPECIES.dog
    for (const a of spawnAnimals([{ species: SPECIES.dog, count: 20 }], world, nav, mulberry32(9), {
      x: 0,
      z: 20,
    })) {
      expect(a.vigor).toBeGreaterThanOrEqual(personality.vigor[0])
      expect(a.vigor).toBeLessThanOrEqual(personality.vigor[1])
      expect(a.social).toBeGreaterThanOrEqual(personality.social[0])
      expect(a.social).toBeLessThanOrEqual(personality.social[1])
    }
  })

  it('is deterministic for a seed and biased towards preferred zones', () => {
    const a = spawnAnimals([{ species: SPECIES.dog, count: 30 }], world, nav, mulberry32(1), {
      x: 0,
      z: 20,
    })
    const b = spawnAnimals([{ species: SPECIES.dog, count: 30 }], world, nav, mulberry32(1), {
      x: 0,
      z: 20,
    })
    expect(a.map((x) => x.position.x)).toEqual(b.map((x) => x.position.x))
    const onRoad = a.filter((x) => nav.zoneAt(x.position.x, x.position.z) === 'ROAD').length
    expect(onRoad).toBeLessThan(a.length / 3)
  })
})
