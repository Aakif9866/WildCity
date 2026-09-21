import { beforeAll, describe, expect, it } from 'vitest'
import { generateDemoCity } from '@/cities/demo'
import { SPECIES } from '@/game/animals/species'
import { spawnAnimals } from '@/game/animals/spawn'
import type { SpeciesId } from '@/game/animals/types'
import { NavGrid } from '@/game/navigation/NavGrid'
import { advanceClock, createClock } from '@/game/time/clock'
import { dayPhaseAt, DAY_PHASES, type DayPhase } from '@/game/time/dayPhase'
import { World } from '@/game/world/World'
import { mulberry32 } from '@/utils/random'
import { updateAnimal, type AIContext } from './fsm'

let world: World
let nav: NavGrid
beforeAll(() => {
  world = new World(generateDemoCity())
  nav = new NavGrid(world)
})

describe('animal daily schedules driven by the real clock', () => {
  it('dogs sleep at night and are up by day; cats sleep by day and are active at night', () => {
    const animals = spawnAnimals(
      [
        { species: SPECIES.dog, count: 12 },
        { species: SPECIES.cat, count: 12 },
        { species: SPECIES.pigeon, count: 12 },
      ],
      world,
      nav,
      mulberry32(5),
      { x: 0, z: 20 },
    )
    const clock = createClock(6, 240) // 240 s per day: 10 s per game hour
    const ctx: AIContext = {
      world,
      nav,
      rng: mulberry32(9),
      time: { phase: dayPhaseAt(clock.hour) },
      player: null,
      animals,
    }
    const sleeping = new Map<string, number>()
    const samples = new Map<string, number>()
    const bump = (m: Map<string, number>, k: string, n = 1): void =>
      void m.set(k, (m.get(k) ?? 0) + n)

    for (let t = 0; t < 480; t += 0.1) {
      advanceClock(clock, 0.1)
      ctx.time.phase = dayPhaseAt(clock.hour)
      for (const a of animals) {
        updateAnimal(a, ctx, 0.1)
        const k = `${a.species}:${ctx.time.phase}`
        bump(samples, k)
        if (a.state === 'SLEEP') bump(sleeping, k)
      }
    }
    const frac = (id: SpeciesId, phase: DayPhase): number =>
      (sleeping.get(`${id}:${phase}`) ?? 0) / (samples.get(`${id}:${phase}`) ?? 1)
    const table = Object.fromEntries(
      (['dog', 'cat', 'pigeon'] as const).map((id) => [
        id,
        Object.fromEntries(DAY_PHASES.map((p) => [p, +frac(id, p).toFixed(2)])),
      ]),
    )

    // Diurnal dogs: asleep a lot at night, awake by day.
    expect(frac('dog', 'night')).toBeGreaterThan(0.35)
    expect(frac('dog', 'day')).toBeLessThan(0.1)
    expect(frac('dog', 'night')).toBeGreaterThan(frac('dog', 'day') * 4)
    // Cats: the opposite rhythm.
    expect(frac('cat', 'day')).toBeGreaterThan(frac('cat', 'night'))
    expect(frac('cat', 'night')).toBeLessThan(0.15)
    // Pigeons: asleep at night, active in the morning.
    expect(frac('pigeon', 'night')).toBeGreaterThan(0.35)
    expect(frac('pigeon', 'morning')).toBeLessThan(0.15)
    // Everyone is still in a sane state at the end.
    for (const a of animals) expect(Number.isFinite(a.position.x + a.position.z)).toBe(true)
    console.info('sleep fraction by phase', JSON.stringify(table))
  }, 60_000)
})
