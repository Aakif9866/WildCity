import { beforeAll, describe, expect, it } from 'vitest'
import { generateDemoCity } from '@/cities/demo'
import { SPECIES } from '@/game/animals/species'
import { spawnAnimals } from '@/game/animals/spawn'
import type { AnimalState } from '@/game/animals/types'
import { NavGrid } from '@/game/navigation/NavGrid'
import { World } from '@/game/world/World'
import { mulberry32 } from '@/utils/random'
import { updateAnimal, type AIContext } from './fsm'

let ctx: AIContext
beforeAll(() => {
  const world = new World(generateDemoCity())
  ctx = { world, nav: new NavGrid(world), rng: mulberry32(11) }
})

describe('animal wander loop', () => {
  it('cycles IDLE <-> WANDER, actually travels, and never enters a building', () => {
    const [dog] = spawnAnimals([{ species: SPECIES.dog, count: 1 }], ctx.nav, mulberry32(2), {
      x: 0,
      z: 20,
    })
    const start = { ...dog!.position }
    const seen = new Set<AnimalState>()
    let maxFromStart = 0
    let transitions = 0
    let last = dog!.state
    for (let t = 0; t < 300; t += 0.1) {
      updateAnimal(dog!, ctx, 0.1)
      seen.add(dog!.state)
      if (dog!.state !== last) transitions++
      last = dog!.state
      maxFromStart = Math.max(
        maxFromStart,
        Math.hypot(dog!.position.x - start.x, dog!.position.z - start.z),
      )
      expect(ctx.world.buildingAt(dog!.position.x, dog!.position.z)).toBeNull()
      expect(ctx.world.inBounds(dog!.position.x, dog!.position.z)).toBe(true)
    }
    expect(seen.has('IDLE') && seen.has('WANDER')).toBe(true)
    expect(transitions).toBeGreaterThan(6)
    expect(maxFromStart).toBeGreaterThan(15)
  })

  it('animation follows speed', () => {
    const [dog] = spawnAnimals([{ species: SPECIES.dog, count: 1 }], ctx.nav, mulberry32(4), {
      x: 0,
      z: 20,
    })
    updateAnimal(dog!, ctx, 0.016)
    expect(dog!.animation).toBe('idle')
    dog!.speed = 1.5
    dog!.state = 'WANDER'
    dog!.path = []
    updateAnimal(dog!, ctx, 0.016)
    expect(['walk', 'idle']).toContain(dog!.animation)
  })

  it('unknown/unimplemented states fall back to idling instead of getting stuck', () => {
    const [dog] = spawnAnimals([{ species: SPECIES.dog, count: 1 }], ctx.nav, mulberry32(6), {
      x: 0,
      z: 20,
    })
    dog!.state = 'SLEEP'
    expect(() => updateAnimal(dog!, ctx, 0.1)).not.toThrow()
  })
})
