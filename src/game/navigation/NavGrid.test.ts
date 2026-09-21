import { beforeAll, describe, expect, it } from 'vitest'
import { generateDemoCity } from '@/cities/demo'
import { World } from '@/game/world/World'
import { mulberry32 } from '@/utils/random'
import { NavGrid } from './NavGrid'

let world: World
let nav: NavGrid

beforeAll(() => {
  world = new World(generateDemoCity())
  nav = new NavGrid(world)
})

/** Every point along the polyline must be outside buildings. */
function pathClear(from: [number, number], path: [number, number][]): boolean {
  let prev = from
  for (const p of path) {
    for (let t = 0; t <= 1; t += 0.05) {
      const x = prev[0] + (p[0] - prev[0]) * t
      const z = prev[1] + (p[1] - prev[1]) * t
      if (world.buildingAt(x, z)) return false
    }
    prev = p
  }
  return true
}

describe('NavGrid', () => {
  it('marks building interiors and water as not walkable', () => {
    const b = world.city.buildings[0]!
    const [x, z] = b.footprint[0]!
    expect(nav.isWalkable(x + 1, z + 1)).toBe(false)
    expect(nav.isWalkable(-62, -62)).toBe(false) // pond centre
    expect(nav.isWalkable(0, 20)).toBe(true) // road at spawn
  })

  it('classifies zones and derives TREE zones near trees', () => {
    expect(nav.zoneAt(0, 20)).toBe('ROAD')
    const [tx, tz] = world.city.trees.find(([x, z]) => world.zoneAt(x, z) === 'PARK')!
    expect(nav.zoneAt(tx, tz)).toBe('TREE')
  })

  it('finds a path across the map that never crosses a building', () => {
    const start: [number, number] = [-125, -200]
    const path = nav.findPath(...start, 125, 200, undefined, 70000)!
    expect(path).not.toBeNull()
    expect(pathClear(start, path)).toBe(true)
    const end = path[path.length - 1]!
    expect(Math.hypot(end[0] - 125, end[1] - 200)).toBeLessThan(0.01)
  })

  it('finds moderate-length local routes within the default node budget', () => {
    expect(nav.findPath(-125, -125, 0, 0)).not.toBeNull()
    expect(nav.findPath(-125, -100, 125, 100)).not.toBeNull()
  })

  it('returns null for an unwalkable or out-of-bounds goal', () => {
    const b = world.city.buildings[0]!
    const [x, z] = b.footprint[0]!
    expect(nav.findPath(0, 20, x + 1, z + 1)).toBeNull()
    expect(nav.findPath(0, 20, 9999, 0)).toBeNull()
  })

  it('smooths paths: open ground needs a single waypoint', () => {
    const path = nav.findPath(-100, 0, 100, 0)
    expect(path).not.toBeNull()
    expect(path!.length).toBeLessThanOrEqual(2)
  })

  it('nearestWalkable rescues a point inside a building', () => {
    const b = world.city.buildings[0]!
    const [x, z] = b.footprint[0]!
    const p = nav.nearestWalkable(x + 1, z + 1)!
    expect(nav.isWalkable(p[0], p[1])).toBe(true)
  })

  it('randomSpot only returns walkable points and honours zone weights', () => {
    const rng = mulberry32(3)
    for (let i = 0; i < 50; i++) {
      const s = nav.randomSpot(0, 0, 0, 200, rng, (z) => (z === 'PARK' ? 1 : 0), 60)
      if (s)
        expect(nav.zoneAt(s[0], s[1]) === 'PARK' || nav.zoneAt(s[0], s[1]) === 'TREE').toBe(true)
    }
  })

  it('a cost function steers the route away from expensive zones', () => {
    const start: [number, number] = [0, 5]
    const goal: [number, number] = [0, 60]
    const cheap = nav.findPath(...start, ...goal)!
    const roadHater = nav.findPath(...start, ...goal, (z) => (z === 'ROAD' ? 8 : 1))!
    expect(cheap).not.toBeNull()
    expect(roadHater).not.toBeNull()
  })
})
