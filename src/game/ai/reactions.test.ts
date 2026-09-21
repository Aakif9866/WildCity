import { beforeAll, describe, expect, it } from 'vitest'
import { generateDemoCity } from '@/cities/demo'
import { SPECIES } from '@/game/animals/species'
import { spawnAnimals } from '@/game/animals/spawn'
import type { Animal, SpeciesId } from '@/game/animals/types'
import { NavGrid } from '@/game/navigation/NavGrid'
import { World } from '@/game/world/World'
import { mulberry32 } from '@/utils/random'
import { interactWithAnimal, updateAnimal, type AIContext } from './fsm'
import { chooseReaction, standoffDistance } from './reactions'

let world: World
let nav: NavGrid
beforeAll(() => {
  world = new World(generateDemoCity())
  nav = new NavGrid(world)
})

const make = (id: SpeciesId, seed = 1): Animal => {
  const a = spawnAnimals([{ species: SPECIES[id], count: 1 }], world, nav, mulberry32(seed), {
    x: 0,
    z: 20,
  })[0] as Animal
  const p = nav.nearestWalkable(0, 40)!
  a.position.x = p[0]
  a.position.z = p[1]
  a.position.y = 0
  a.state = 'IDLE'
  a.attention = 0
  return a
}
const ctxWith = (
  a: Animal,
  player: AIContext['player'],
  seed = 7,
  rng?: () => number,
): AIContext => ({
  world,
  nav,
  rng: rng ?? mulberry32(seed),
  time: { phase: 'day' },
  player,
  animals: [a],
})
/** Player standing (still) `d` metres from the animal on the +x side. */
const playerAt = (a: Animal, d: number, speed = 0) => ({
  x: a.position.x + d,
  z: a.position.z,
  speed,
})
const dist = (a: Animal, p: { x: number; z: number }) =>
  Math.hypot(a.position.x - p.x, a.position.z - p.z)

describe('chooseReaction', () => {
  it('"ignore" species never react; out-of-range players are not noticed', () => {
    const pigeon = make('pigeon')
    expect(chooseReaction(pigeon, SPECIES.pigeon, playerAt(pigeon, 6), () => 0)).toBeNull()
    const dog = make('dog')
    expect(chooseReaction(dog, SPECIES.dog, playerAt(dog, 40), () => 0)).toBeNull()
  })

  it('sociable dogs follow, curious monkeys/cats investigate', () => {
    const dog = make('dog')
    dog.social = 95
    expect(chooseReaction(dog, SPECIES.dog, playerAt(dog, 8), () => 0)).toBe('follow')
    const monkey = make('monkey')
    monkey.curiosity = 95
    expect(chooseReaction(monkey, SPECIES.monkey, playerAt(monkey, 8), () => 0)).toBe('investigate')
    const cat = make('cat')
    cat.curiosity = 95
    expect(chooseReaction(cat, SPECIES.cat, playerAt(cat, 8), () => 0)).toBe('investigate')
  })

  it('personality sets the odds: a shy animal reacts far less than a bold one', () => {
    const rate = (curiosity: number): number => {
      const cat = make('cat')
      cat.curiosity = curiosity
      const rng = mulberry32(3)
      let hits = 0
      for (let i = 0; i < 400; i++)
        if (chooseReaction(cat, SPECIES.cat, playerAt(cat, 8), rng)) hits++
      return hits / 400
    }
    expect(rate(95)).toBeGreaterThan(rate(10) * 3)
  })

  it('an animal that is too scared does not approach', () => {
    const cat = make('cat')
    cat.curiosity = 100
    cat.social = 0
    expect(chooseReaction(cat, SPECIES.cat, playerAt(cat, 1, 8.5), () => 0)).toBeNull()
  })

  it('wary animals keep a larger stand-off distance than bold ones', () => {
    const shy = make('cat')
    Object.assign(shy, { curiosity: 30, social: 5 })
    const bold = make('cat')
    Object.assign(bold, { curiosity: 100, social: 60 })
    expect(standoffDistance(shy, SPECIES.cat)).toBeGreaterThan(standoffDistance(bold, SPECIES.cat))
    expect(standoffDistance(bold, SPECIES.cat)).toBeGreaterThanOrEqual(2.5)
  })
})

describe('reaction states', () => {
  it('a curious monkey walks over, stops at a distance, looks at the player, then loses interest', () => {
    const m = make('monkey')
    Object.assign(m, { curiosity: 100, social: 90 })
    const player = playerAt(m, 10)
    const ctx = ctxWith(m, player, 1, () => 0) // rng 0 => always reacts
    let started = false
    let closest = Infinity
    let lookedAt = false
    for (let t = 0; t < 40; t += 0.1) {
      updateAnimal(m, ctx, 0.1)
      if (m.state === 'INVESTIGATE') started = true
      if (started) closest = Math.min(closest, dist(m, player))
      if (m.state === 'INVESTIGATE' && m.path.length === 0 && m.speed < 0.3) {
        const want = Math.atan2(-(player.x - m.position.x), -(player.z - m.position.z))
        if (Math.abs(Math.atan2(Math.sin(m.yaw - want), Math.cos(m.yaw - want))) < 0.5)
          lookedAt = true
      }
      if (started && m.state === 'IDLE') break
    }
    expect(started).toBe(true)
    expect(closest).toBeLessThan(6)
    expect(closest).toBeGreaterThan(1.5)
    expect(lookedAt).toBe(true)
    expect(m.state).toBe('IDLE')
    expect(m.attention).toBeGreaterThan(15) // won't pester again straight away
  })

  it('a friendly dog follows a walking player and keeps close', () => {
    const d = make('dog')
    Object.assign(d, { social: 100, curiosity: 100 })
    const player = { x: d.position.x + 12, z: d.position.z, speed: 3 }
    const ctx = ctxWith(d, player, 2, () => 0)
    let sawFollow = false
    for (let t = 0; t < 25; t += 0.1) {
      // Player strolls along the road.
      const p = nav.nearestWalkable(player.x, player.z + 0.3)
      if (p && nav.lineClear(player.x, player.z, p[0], p[1])) player.z = p[1]
      updateAnimal(d, ctx, 0.1)
      if (d.state === 'FOLLOW') sawFollow = true
    }
    expect(sawFollow).toBe(true)
    expect(dist(d, player)).toBeLessThan(9)
  })

  it('following ends on its own after a while and starts a cooldown', () => {
    const d = make('dog')
    Object.assign(d, { social: 100, curiosity: 100 })
    const ctx = ctxWith(d, playerAt(d, 8), 3, () => 0)
    for (let t = 0; t < 30; t += 0.1) updateAnimal(d, ctx, 0.1)
    d.state = 'FOLLOW'
    d.stateTime = 41
    updateAnimal(d, ctx, 0.1)
    expect(d.state).toBe('IDLE')
    expect(d.attention).toBeGreaterThan(30)
  })

  it('does not re-investigate constantly: bounded number of visits per minute', () => {
    const c = make('cat')
    Object.assign(c, { curiosity: 100, social: 40 })
    const player = playerAt(c, 9)
    const ctx = ctxWith(c, player, 4, () => 0)
    let visits = 0
    let prev = c.state
    for (let t = 0; t < 60; t += 0.1) {
      updateAnimal(c, ctx, 0.1)
      if (c.state === 'INVESTIGATE' && prev !== 'INVESTIGATE') visits++
      prev = c.state
    }
    expect(visits).toBeLessThanOrEqual(3)
  })

  it('never walks into a building while approaching', () => {
    const m = make('monkey')
    Object.assign(m, { curiosity: 100 })
    const ctx = ctxWith(m, playerAt(m, 12), 5, () => 0)
    for (let t = 0; t < 40; t += 0.1) {
      updateAnimal(m, ctx, 0.1)
      expect(world.buildingAt(m.position.x, m.position.z)).toBeNull()
    }
  })
})

describe('interactWithAnimal', () => {
  it('a trusting animal accepts and enters INTERACT facing the player, then returns to IDLE', () => {
    const d = make('dog')
    Object.assign(d, { social: 95, curiosity: 90 })
    const player = playerAt(d, 2.5)
    const ctx = ctxWith(d, player, 1, () => 0.01)
    const r = interactWithAnimal(d, ctx)
    expect(r.accepted).toBe(true)
    expect(r.message.length).toBeGreaterThan(5)
    expect(d.state).toBe('INTERACT')
    for (let t = 0; t < 2; t += 0.1) updateAnimal(d, ctx, 0.1)
    expect(d.state).toBe('INTERACT')
    expect(d.speed).toBeLessThan(0.3)
    for (let t = 0; t < 4; t += 0.1) updateAnimal(d, ctx, 0.1)
    expect(d.state).not.toBe('INTERACT')
  })

  it('a shy animal declines and retreats', () => {
    const c = make('cat')
    Object.assign(c, { social: 5, curiosity: 5 })
    const ctx = ctxWith(c, playerAt(c, 2.5), 1, () => 0.99)
    const r = interactWithAnimal(c, ctx)
    expect(r.accepted).toBe(false)
    expect(c.state).toBe('FLEE')
  })

  it('leaves sleeping and frightened animals alone with an explanatory message', () => {
    const d = make('dog')
    d.state = 'SLEEP'
    const asleep = interactWithAnimal(
      d,
      ctxWith(d, playerAt(d, 2), 1, () => 0),
    )
    expect(asleep.accepted).toBe(false)
    expect(d.state).toBe('SLEEP')
    expect(asleep.message).toMatch(/asleep/i)
    d.state = 'FLEE'
    expect(
      interactWithAnimal(
        d,
        ctxWith(d, playerAt(d, 2), 1, () => 0),
      ).message,
    ).toMatch(/frightened/i)
  })

  it('every species has an acceptance message', () => {
    for (const id of Object.keys(SPECIES) as SpeciesId[]) {
      const a = make(id)
      Object.assign(a, { social: 100, curiosity: 100 })
      expect(
        interactWithAnimal(
          a,
          ctxWith(a, playerAt(a, 2), 1, () => 0),
        ).message,
      ).not.toBe('It accepts your company.')
    }
  })
})
