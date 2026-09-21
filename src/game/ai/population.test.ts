import { beforeAll, describe, expect, it } from 'vitest'
import { generateDemoCity } from '@/cities/demo'
import { settleToGround } from '@/game/animals/locomotion'
import { SPECIES } from '@/game/animals/species'
import { spawnAnimals } from '@/game/animals/spawn'
import { DEFAULT_SPAWN_PLAN } from '@/game/animals/spawnPlan'
import type { Animal, SpeciesId } from '@/game/animals/types'
import { NavGrid } from '@/game/navigation/NavGrid'
import { DAY_PHASES, type DayPhase } from '@/game/time/dayPhase'
import { World } from '@/game/world/World'
import { mulberry32 } from '@/utils/random'
import { behaviourWeights } from './behaviour'
import { startBehaviour, updateAnimal, type AIContext } from './fsm'

let world: World
let nav: NavGrid
const mk = (
  seed: number,
  phase: DayPhase = 'day',
  animals: Animal[] = [],
  player: AIContext['player'] = null,
): AIContext => ({
  world,
  nav,
  rng: mulberry32(seed),
  time: { phase },
  player,
  animals,
})
const pop = (seed: number, plan = DEFAULT_SPAWN_PLAN) =>
  spawnAnimals(plan, world, nav, mulberry32(seed), { x: 0, z: 20 })

beforeAll(() => {
  world = new World(generateDemoCity())
  nav = new NavGrid(world)
})

describe('spawning the full population', () => {
  let animals: Animal[]
  beforeAll(() => {
    animals = pop(1)
  })
  it('spawns all 22 with unique ids and the right counts per species', () => {
    expect(animals).toHaveLength(22)
    expect(new Set(animals.map((a) => a.id)).size).toBe(22)
    const count = (id: SpeciesId) => animals.filter((a) => a.species === id).length
    expect([
      count('dog'),
      count('cat'),
      count('pigeon'),
      count('monkey'),
      count('squirrel'),
    ]).toEqual([4, 3, 8, 3, 4])
  })

  it('ground species start on walkable ground, pigeons may start on roofs at roof height', () => {
    for (const a of animals) {
      const { x, y, z } = a.position
      if (SPECIES[a.species].flying) {
        const roof = world.buildingAt(x, z)?.height ?? 0
        expect(y).toBeCloseTo(roof, 5)
      } else {
        expect(nav.isWalkable(x, z)).toBe(true)
        expect(y).toBe(0)
      }
      expect(Math.hypot(x, z - 20)).toBeGreaterThanOrEqual(15)
    }
  })

  it('tree-loving species start in or near trees/parks more than on roads', () => {
    const tree = animals.filter((a) => a.species === 'monkey' || a.species === 'squirrel')
    const onRoad = tree.filter((a) => nav.zoneAt(a.position.x, a.position.z) === 'ROAD')
    expect(onRoad.length).toBeLessThanOrEqual(tree.length / 2)
  })
})

describe('pigeon flight', () => {
  const roofSpot = (): { x: number; z: number; h: number } => {
    const b = world.city.buildings.find((b) => b.height > 20)!
    const xs = b.footprint.map((p) => p[0])
    const zs = b.footprint.map((p) => p[1])
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      z: (Math.min(...zs) + Math.max(...zs)) / 2,
      h: b.height,
    }
  }

  it('flies over buildings to a distant rooftop and lands on it', () => {
    const [p] = pop(2, [{ species: SPECIES.pigeon, count: 1 }]) as [Animal]
    p.position.x = 0
    p.position.z = 20
    p.position.y = 0
    const roof = roofSpot()
    const ctx = mk(2)
    p.path = [[roof.x, roof.z]]
    p.pathIndex = 0
    p.target = [roof.x, roof.z]
    p.targetKind = 'spot'
    p.airborne = true
    p.state = 'MOVE_TO_TARGET'
    let maxY = 0
    let sawFly = false
    for (let t = 0; t < 120 && p.airborne; t += 0.05) {
      updateAnimal(p, ctx, 0.05)
      maxY = Math.max(maxY, p.position.y)
      if (p.animation === 'fly') sawFly = true
      expect(Number.isFinite(p.position.x + p.position.y + p.position.z)).toBe(true)
    }
    expect(sawFly).toBe(true)
    expect(maxY).toBeGreaterThan(3)
    expect(p.airborne).toBe(false)
    expect(p.position.y).toBeCloseTo(roof.h, 1)
    expect(Math.hypot(p.position.x - roof.x, p.position.z - roof.z)).toBeLessThan(1)
  })

  it('walks (does not fly) for a short hop between walkable spots', () => {
    const [p] = pop(3, [{ species: SPECIES.pigeon, count: 1 }]) as [Animal]
    const start = nav.nearestWalkable(0, 20)!
    p.position.x = start[0]
    p.position.z = start[1]
    p.position.y = 0
    p.airborne = false
    const ctx = mk(3)
    let hops = 0
    for (let i = 0; i < 20 && hops === 0; i++) {
      if (startBehaviour('wander', p, SPECIES.pigeon, ctx) && !p.airborne) hops++
    }
    // wander range is 3..25 so short hops must sometimes be on foot
    expect(hops).toBeGreaterThan(0)
  })

  it('a flight cut short still ends on the ground', () => {
    const [p] = pop(4, [{ species: SPECIES.pigeon, count: 1 }]) as [Animal]
    p.position.x = 0
    p.position.z = 20
    p.position.y = 5
    p.airborne = true
    p.path = []
    for (let i = 0; i < 100; i++) settleToGround(p, 0.05, world)
    expect(p.airborne).toBe(false)
    expect(p.position.y).toBe(0)
  })

  it('a startled pigeon takes off away from the player', () => {
    const [p] = pop(5, [{ species: SPECIES.pigeon, count: 1 }]) as [Animal]
    const start = nav.nearestWalkable(0, 20)!
    p.position.x = start[0]
    p.position.z = start[1]
    p.position.y = 0
    Object.assign(p, { curiosity: 5, social: 5 })
    const player = { x: p.position.x + 4, z: p.position.z, speed: 8.5 }
    const ctx = mk(5, 'day', [], player)
    updateAnimal(p, ctx, 0.05)
    expect(p.state).toBe('FLEE')
    const d0 = Math.hypot(p.position.x - player.x, p.position.z - player.z)
    for (let i = 0; i < 60; i++) updateAnimal(p, ctx, 0.05)
    expect(Math.hypot(p.position.x - player.x, p.position.z - player.z)).toBeGreaterThan(d0 + 4)
  })
})

describe('species-specific behaviour', () => {
  const sit = (phase: DayPhase) => ({ phase, waterNearby: false, friendNearby: false })
  const one = (id: keyof typeof SPECIES): Animal => {
    const a = pop(9, [{ species: SPECIES[id], count: 1 }])[0] as Animal
    Object.assign(a, { energy: 70, hunger: 10, vigor: 60 })
    return a
  }

  it('cats are more active at night than midday; pigeons/dogs the opposite', () => {
    const cat = one('cat')
    expect(behaviourWeights(cat, SPECIES.cat, sit('night')).wander).toBeGreaterThan(
      behaviourWeights(cat, SPECIES.cat, sit('day')).wander,
    )
    const pig = one('pigeon')
    expect(behaviourWeights(pig, SPECIES.pigeon, sit('morning')).wander).toBeGreaterThan(
      behaviourWeights(pig, SPECIES.pigeon, sit('night')).wander,
    )
  })

  it('pigeons, monkeys and squirrels sleep at night; cats do not', () => {
    for (const id of ['pigeon', 'monkey', 'squirrel'] as const) {
      const a = one(id)
      expect(behaviourWeights(a, SPECIES[id], sit('night')).sleep).toBeGreaterThan(0)
      expect(behaviourWeights(a, SPECIES[id], sit('day')).sleep).toBe(0)
    }
    const cat = one('cat')
    expect(behaviourWeights(cat, SPECIES.cat, sit('night')).sleep).toBe(0)
  })

  it('squirrels take short hops, dogs longer ones', () => {
    const hop = (id: keyof typeof SPECIES): number => {
      const a = one(id)
      let max = 0
      for (let i = 0; i < 30; i++) {
        a.path = []
        if (startBehaviour('wander', a, SPECIES[id], mk(i))) {
          const t = a.target!
          max = Math.max(max, Math.hypot(t[0] - a.position.x, t[1] - a.position.z))
        }
      }
      return max
    }
    expect(hop('squirrel')).toBeLessThan(hop('dog'))
  })
})

describe('full-day soak', () => {
  it('22 animals survive a simulated day: sane state, no building collisions, everyone acts', () => {
    const animals = pop(31)
    const ctx = mk(31, 'morning', animals)
    const visited = new Map<SpeciesId, Set<string>>()
    const problems: string[] = []
    const total = 24 * 40 // 40 sim-seconds per game-hour: covers every phase without a huge runtime
    for (let t = 0; t < total; t += 0.1) {
      ctx.time.phase = DAY_PHASES[Math.min(3, Math.floor((t / total) * 4))]!
      for (const a of animals) {
        updateAnimal(a, ctx, 0.1)
        const set = visited.get(a.species) ?? new Set<string>()
        set.add(a.state)
        visited.set(a.species, set)
        const { x, y, z } = a.position
        if (!Number.isFinite(x + y + z + a.yaw))
          problems.push(`${a.id} non-finite at t=${t.toFixed(1)}`)
        else if (y < 0) problems.push(`${a.id} underground`)
        else if (a.energy < 0 || a.hunger > 100) problems.push(`${a.id} bad needs`)
        else if (!SPECIES[a.species].flying && world.buildingAt(x, z))
          problems.push(`${a.id} inside building`)
        else if (!world.inBounds(x, z)) problems.push(`${a.id} out of bounds`)
      }
    }
    expect(problems.slice(0, 5)).toEqual([])
    for (const id of Object.keys(SPECIES) as SpeciesId[]) {
      const seen = visited.get(id)!
      expect(seen.size).toBeGreaterThanOrEqual(3)
      expect(seen.has('WANDER') || seen.has('MOVE_TO_TARGET')).toBe(true)
    }
  }, 60_000)
})
