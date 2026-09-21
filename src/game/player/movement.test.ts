import { describe, expect, it } from 'vitest'
import type { CityData } from '@/cities/types'
import { emptyInput, type InputFrame } from '@/game/input/types'
import { World } from '@/game/world/World'
import { angleDelta, createPlayer, stepPlayer } from './movement'

const city: CityData = {
  metadata: {
    id: 't',
    name: 't',
    country: 't',
    center: { lat: 0, lon: 0 },
    halfSize: 60,
    spawn: { x: 0, z: 0, yaw: 0 },
  },
  roads: [],
  buildings: [
    {
      id: 'b',
      footprint: [
        [-10, -30],
        [10, -30],
        [10, -20],
        [-10, -20],
      ],
      height: 12,
    },
  ],
  zones: [],
  trees: [],
}
const world = new World(city)
const input = (o: Partial<InputFrame>): InputFrame => ({ ...emptyInput(), ...o })

function run(p: ReturnType<typeof createPlayer>, i: InputFrame, seconds: number, camYaw = 0): void {
  for (let t = 0; t < seconds; t += 1 / 60) stepPlayer(p, i, camYaw, 1 / 60, world)
}

describe('stepPlayer', () => {
  it('moves forward (-z) relative to a camera at yaw 0', () => {
    const p = createPlayer(0, 0, 0, world)
    run(p, input({ moveY: 1 }), 0.5)
    expect(p.z).toBeLessThan(-1)
    expect(Math.abs(p.x)).toBeLessThan(0.01)
  })

  it('moves relative to camera yaw (yaw 90deg: forward = -x)', () => {
    const p = createPlayer(0, 0, 0, world)
    run(p, input({ moveY: 1 }), 0.5, Math.PI / 2)
    expect(p.x).toBeLessThan(-1)
  })

  it('running is faster than walking and diagonal is not faster than straight', () => {
    const walk = createPlayer(0, 0, 0, world)
    const sprint = createPlayer(0, 0, 0, world)
    const diag = createPlayer(0, 0, 0, world)
    run(walk, input({ moveY: 1 }), 1)
    run(sprint, input({ moveY: 1, run: true }), 1)
    run(diag, input({ moveY: 1, moveX: 1 }), 1)
    expect(-sprint.z).toBeGreaterThan(-walk.z * 1.4)
    expect(Math.hypot(diag.x, diag.z)).toBeLessThanOrEqual(Math.hypot(walk.x, walk.z) + 0.05)
  })

  it('jumps, peaks above ground, and lands without falling through', () => {
    const p = createPlayer(0, 0, 0, world)
    let peak = 0
    stepPlayer(p, input({ jump: true }), 0, 1 / 60, world)
    for (let i = 0; i < 120; i++) {
      stepPlayer(p, input({}), 0, 1 / 60, world)
      peak = Math.max(peak, p.y)
      expect(p.y).toBeGreaterThanOrEqual(0)
    }
    expect(peak).toBeGreaterThan(1)
    expect(p.grounded).toBe(true)
  })

  it('cannot jump again while airborne', () => {
    const p = createPlayer(0, 0, 0, world)
    stepPlayer(p, input({ jump: true }), 0, 1 / 60, world)
    for (let i = 0; i < 100; i++) stepPlayer(p, input({ jump: true }), 0, 1 / 60, world)
    expect(p.y).toBeLessThan(4)
  })

  it('never ends up inside a building when running into one', () => {
    const p = createPlayer(0, 0, 0, world)
    for (let t = 0; t < 4; t += 1 / 60) {
      stepPlayer(p, input({ moveY: 1, run: true }), 0, 1 / 60, world)
      expect(world.buildingAt(p.x, p.z)).toBeNull()
    }
    expect(p.z).toBeGreaterThan(-20)
  })

  it('slides along a wall instead of sticking', () => {
    const p = createPlayer(0, -18, 0, world)
    run(p, input({ moveY: 1, moveX: 1 }), 1)
    expect(p.x).toBeGreaterThan(2)
  })

  it('stays inside the playable bounds', () => {
    const p = createPlayer(50, 50, 0, world)
    run(p, input({ moveX: 1, moveY: -1, run: true }), 5)
    expect(world.inBounds(p.x, p.z)).toBe(true)
  })

  it('angleDelta takes the shortest way round', () => {
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6, 5)
    expect(angleDelta(0, 1)).toBeCloseTo(1)
  })
})
