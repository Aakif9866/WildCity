import { beforeAll, describe, expect, it } from 'vitest'
import { generateDemoCity } from '@/cities/demo'
import { SPECIES } from '@/game/animals/species'
import { spawnAnimals } from '@/game/animals/spawn'
import type { Animal, AnimalState } from '@/game/animals/types'
import { NavGrid } from '@/game/navigation/NavGrid'
import type { DayPhase } from '@/game/time/dayPhase'
import { World } from '@/game/world/World'
import { mulberry32 } from '@/utils/random'
import { behaviourWeights } from './behaviour'
import { decide, startBehaviour, updateAnimal, type AIContext } from './fsm'
import { moodOf, updateNeeds } from './needs'

let world: World
let nav: NavGrid
const dog = SPECIES.dog

const makeCtx = (
  seed: number,
  phase: DayPhase = 'day',
  player: AIContext['player'] = null,
  animals: Animal[] = [],
): AIContext => ({
  world,
  nav,
  rng: mulberry32(seed),
  time: { phase },
  player,
  animals,
})
const spawn = (seed: number, n = 1): Animal[] =>
  spawnAnimals([{ species: dog, count: n }], world, nav, mulberry32(seed), { x: 0, z: 20 })

/** Run until `until` is true or `maxSeconds` pass. Returns elapsed seconds or -1. */
function runUntil(
  a: Animal,
  ctx: AIContext,
  until: () => boolean,
  maxSeconds: number,
  dt = 0.1,
): number {
  for (let t = 0; t < maxSeconds; t += dt) {
    updateAnimal(a, ctx, dt)
    if (until()) return t
  }
  return -1
}

beforeAll(() => {
  world = new World(generateDemoCity())
  nav = new NavGrid(world)
})

describe('needs', () => {
  it('hunger grows, energy drains when moving and recovers when resting', () => {
    const [a] = spawn(1) as [Animal]
    a.hunger = 10
    a.energy = 50
    updateNeeds(a, dog, 10)
    expect(a.hunger).toBeGreaterThan(10)
    a.speed = 1.5
    const before = a.energy
    updateNeeds(a, dog, 10)
    expect(a.energy).toBeLessThan(before)
    a.speed = 0
    a.state = 'REST'
    const tired = a.energy
    updateNeeds(a, dog, 10)
    expect(a.energy).toBeGreaterThan(tired)
  })

  it('eating reduces hunger, values stay in 0..100', () => {
    const [a] = spawn(2) as [Animal]
    a.hunger = 50
    a.state = 'EAT'
    updateNeeds(a, dog, 3)
    expect(a.hunger).toBeLessThan(40)
    a.hunger = 99
    a.state = 'IDLE'
    updateNeeds(a, dog, 1e6)
    expect(a.hunger).toBe(100)
  })

  it('low-vigor individuals tire faster than high-vigor ones', () => {
    const [lazy, keen] = spawn(3, 2) as [Animal, Animal]
    for (const [x, v] of [
      [lazy, 10],
      [keen, 95],
    ] as const) {
      x.vigor = v
      x.energy = 100
      x.speed = 1.5
      x.state = 'WANDER'
      updateNeeds(x, dog, 60)
    }
    expect(lazy.energy).toBeLessThan(keen.energy)
  })
})

describe('behaviourWeights', () => {
  const sit = { phase: 'day' as DayPhase, waterNearby: true, friendNearby: true }
  const base = (): Animal => spawn(4)[0] as Animal

  it('a hungry animal strongly prefers food; a full one does not', () => {
    const a = base()
    a.hunger = 90
    expect(behaviourWeights(a, dog, sit).food).toBeGreaterThan(3)
    a.hunger = 5
    expect(behaviourWeights(a, dog, sit).food).toBe(0)
  })

  it('a tired animal prefers rest and wanders less', () => {
    const a = base()
    a.energy = 100
    const fresh = behaviourWeights(a, dog, sit)
    a.energy = 12
    const tired = behaviourWeights(a, dog, sit)
    expect(tired.rest).toBeGreaterThan(fresh.rest * 10)
    expect(tired.wander).toBeLessThan(fresh.wander)
  })

  it('personality shifts the mix: vigor -> wander, curiosity -> explore, social -> friends', () => {
    const a = base()
    Object.assign(a, { vigor: 95, curiosity: 90, social: 90 })
    const keen = behaviourWeights(a, dog, sit)
    Object.assign(a, { vigor: 10, curiosity: 10, social: 10 })
    const calm = behaviourWeights(a, dog, sit)
    expect(keen.wander).toBeGreaterThan(calm.wander)
    expect(keen.idle).toBeLessThan(calm.idle)
    expect(keen.goto_zone).toBeGreaterThan(calm.goto_zone)
    expect(keen.friend).toBeGreaterThan(calm.friend)
  })

  it('time of day matters: a diurnal dog sleeps at night, never at midday', () => {
    const a = base()
    a.energy = 70
    expect(behaviourWeights(a, dog, { ...sit, phase: 'day' }).sleep).toBe(0)
    const night = behaviourWeights(a, dog, { ...sit, phase: 'night' })
    expect(night.sleep).toBeGreaterThan(night.wander)
  })

  it('no friend / no water means those behaviours have zero weight', () => {
    const w = behaviourWeights(base(), dog, {
      phase: 'day',
      waterNearby: false,
      friendNearby: false,
    })
    expect(w.friend).toBe(0)
    expect(w.water).toBe(0)
  })
})

describe('state transitions', () => {
  it('hungry: IDLE -> MOVE_TO_TARGET(food) -> EAT -> hunger drops -> IDLE', () => {
    const [a] = spawn(5) as [Animal]
    const ctx = makeCtx(5)
    a.hunger = 90
    a.state = 'IDLE'
    a.stateTime = 100
    decide(a, dog, ctx)
    expect(a.state).toBe('MOVE_TO_TARGET')
    expect(a.targetKind).toBe('food')
    expect(runUntil(a, ctx, () => a.state === 'EAT', 120)).toBeGreaterThan(0)
    const hungerAtEat = a.hunger
    expect(runUntil(a, ctx, () => a.state === 'IDLE', 30)).toBeGreaterThan(0)
    expect(a.hunger).toBeLessThan(hungerAtEat)
    expect(a.state).toBe('IDLE')
  })

  it('exhausted: goes to REST, recovers energy, then returns to IDLE', () => {
    const [a] = spawn(6) as [Animal]
    const ctx = makeCtx(6)
    a.energy = 5
    a.stateTime = 100
    decide(a, dog, ctx)
    expect(a.state).toBe('REST')
    expect(runUntil(a, ctx, () => a.state === 'IDLE', 60)).toBeGreaterThan(0)
    expect(a.energy).toBeGreaterThanOrEqual(70)
  })

  it('night: a rested-ish diurnal dog goes to SLEEP and wakes when the day comes', () => {
    const [a] = spawn(7) as [Animal]
    a.energy = 60
    a.hunger = 10
    startBehaviour('sleep', a, dog, makeCtx(7, 'night'))
    expect(a.state).toBe('SLEEP')
    const day = makeCtx(7, 'day')
    updateAnimal(a, day, 0.1)
    expect(a.state).toBe('SLEEP') // minimum sleep time
    a.stateTime = 20
    updateAnimal(a, day, 0.1)
    expect(a.state).toBe('IDLE')
    expect(a.animation).toBe('idle')
  })

  it('sleeping animals are shown with the sleep animation', () => {
    const [a] = spawn(8) as [Animal]
    startBehaviour('sleep', a, dog, makeCtx(8, 'night'))
    updateAnimal(a, makeCtx(8, 'night'), 0.1)
    expect(a.animation).toBe('sleep')
  })

  it('a running player nearby makes a shy animal FLEE, then it calms down', () => {
    const [a] = spawn(9) as [Animal]
    Object.assign(a, { curiosity: 5, social: 5, vigor: 50 }) // shy: boldness 1.3
    const p = { x: a.position.x + 2.5, z: a.position.z, speed: 8.5 }
    const ctx = makeCtx(9, 'day', p)
    updateAnimal(a, ctx, 0.1)
    expect(a.state).toBe('FLEE')
    const d0 = Math.hypot(a.position.x - p.x, a.position.z - p.z)
    for (let t = 0; t < 3; t += 0.1) updateAnimal(a, ctx, 0.1)
    expect(Math.hypot(a.position.x - p.x, a.position.z - p.z)).toBeGreaterThan(d0 + 3)
    expect(a.speed).toBeGreaterThan(3)
    ctx.player = null
    expect(runUntil(a, ctx, () => a.state === 'IDLE', 30)).toBeGreaterThanOrEqual(0)
    expect(a.state).toBe('IDLE')
  })

  it('a bold, sociable dog tolerates a walking player at the same distance', () => {
    const [a] = spawn(10) as [Animal]
    Object.assign(a, { curiosity: 95, social: 95 })
    const ctx = makeCtx(10, 'day', { x: a.position.x + 2.5, z: a.position.z, speed: 3 })
    updateAnimal(a, ctx, 0.1)
    expect(a.state).not.toBe('FLEE')
  })

  it('a cornered animal that cannot plan a route does not retry A* every frame', () => {
    const [a] = spawn(11) as [Animal]
    Object.assign(a, { curiosity: 5, social: 5 })
    // Surround by making every path fail: put the "player" on top of a spot with no walkable escape.
    const ctx = makeCtx(11, 'day', { x: a.position.x + 1, z: a.position.z, speed: 9 })
    const realFind = nav.findPath.bind(nav)
    let calls = 0
    nav.findPath = () => {
      calls++
      return null
    }
    try {
      for (let i = 0; i < 20; i++) updateAnimal(a, ctx, 0.016)
    } finally {
      nav.findPath = realFind
    }
    expect(calls).toBeLessThanOrEqual(10) // 5 attempts per cooldown window, not per frame
  })

  it('goes to drink at the pond and stands at the shore', () => {
    const [a] = spawn(12) as [Animal]
    a.position.x = -62
    a.position.z = -30
    a.hunger = 5
    const ctx = makeCtx(12)
    expect(startBehaviour('water', a, dog, ctx)).toBe(true)
    expect(a.targetKind).toBe('water')
    expect(runUntil(a, ctx, () => a.state === 'DRINK', 90)).toBeGreaterThan(0)
    expect(nav.directionToZone(a.position.x, a.position.z, 'WATER', 6)).not.toBeNull()
    expect(a.animation === 'eat' || a.state === 'DRINK').toBe(true)
  })

  it('unimplemented states fall back to idling instead of getting stuck', () => {
    const [a] = spawn(13) as [Animal]
    a.state = 'INVESTIGATE'
    expect(() => updateAnimal(a, makeCtx(13), 0.1)).not.toThrow()
  })
})

describe('mood', () => {
  it('reflects state and needs', () => {
    const [a] = spawn(14) as [Animal]
    Object.assign(a, { hunger: 10, energy: 90, vigor: 20, curiosity: 20 })
    expect(moodOf(a)).toBe('Content')
    a.hunger = 90
    expect(moodOf(a)).toBe('Hungry')
    a.state = 'FLEE'
    expect(moodOf(a)).toBe('Scared')
  })
})

describe('soak', () => {
  it('a population survives 10 simulated minutes: valid needs, never in buildings, varied states', () => {
    const animals = spawn(21, 6)
    const ctx = makeCtx(21, 'day', null, animals)
    const seen = new Set<AnimalState>()
    for (let t = 0; t < 600; t += 0.1) {
      for (const a of animals) {
        updateAnimal(a, ctx, 0.1)
        seen.add(a.state)
        expect(a.hunger).toBeGreaterThanOrEqual(0)
        expect(a.hunger).toBeLessThanOrEqual(100)
        expect(a.energy).toBeGreaterThanOrEqual(0)
        expect(a.energy).toBeLessThanOrEqual(100)
        expect(Number.isFinite(a.position.x + a.position.z + a.yaw)).toBe(true)
        if (world.buildingAt(a.position.x, a.position.z))
          throw new Error(`${a.id} inside building at t=${t}`)
      }
    }
    for (const s of ['IDLE', 'WANDER', 'MOVE_TO_TARGET', 'EAT'] as AnimalState[])
      expect(seen.has(s)).toBe(true)
  })
})
