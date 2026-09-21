// CPU benchmark of the game logic (no rendering). Usage: npm run bench [-- --json]
// Numbers are wall-clock on the machine running it: compare before/after, not across machines.
import { readFileSync } from 'node:fs'
import { generateDemoCity } from '../src/cities/demo'
import { parseCityData } from '../src/cities/parse'
import type { CityData } from '../src/cities/types'
import { updateAnimal, type AIContext } from '../src/game/ai/fsm'
import { spawnAnimals } from '../src/game/animals/spawn'
import { DEFAULT_SPAWN_PLAN } from '../src/game/animals/spawnPlan'
import { NavGrid } from '../src/game/navigation/NavGrid'
import { World } from '../src/game/world/World'
import { mulberry32 } from '../src/utils/random'

const now = (): number => performance.now()
const time = <T>(fn: () => T): [T, number] => {
  const t = now()
  const r = fn()
  return [r, now() - t]
}
const read = (id: string, file: string): unknown =>
  JSON.parse(readFileSync(`public/cities/${id}/${file}`, 'utf8'))

function loadCity(id: string): [CityData, number] {
  if (id === 'demo') return [generateDemoCity(), 0]
  return time(
    () =>
      parseCityData(
        read(id, 'metadata.json'),
        read(id, 'roads.json'),
        read(id, 'buildings.json'),
        read(id, 'zones.json'),
      ).city,
  ) as [CityData, number]
}

const rows: Record<string, number | string>[] = []
for (const id of ['demo', 'hyderabad', 'bengaluru', 'london']) {
  const [city, parseMs] = loadCity(id)
  const [world, worldMs] = time(() => new World(city))
  const [nav, navMs] = time(() => new NavGrid(world))
  const rng = mulberry32(1)
  const { x, z } = city.metadata.spawn
  const [animals, spawnMs] = time(() => spawnAnimals(DEFAULT_SPAWN_PLAN, world, nav, rng, { x, z }))

  const ctx: AIContext = {
    world,
    nav,
    rng,
    time: { phase: 'day' },
    player: { x, z, speed: 0 },
    animals,
  }
  for (let i = 0; i < 120; i++) for (const a of animals) updateAnimal(a, ctx, 1 / 60) // warm up the JIT
  const frames: number[] = []
  for (let f = 0; f < 1200; f++) {
    ctx.player = { x: x + Math.sin(f / 90) * 30, z: z + Math.cos(f / 90) * 30, speed: 4.5 }
    const t = now()
    for (const a of animals) updateAnimal(a, ctx, 1 / 60)
    frames.push(now() - t)
  }
  frames.sort((a, b) => a - b)

  // A*: typical local routes (what animals request), plus the worst one.
  const astar: number[] = []
  for (let i = 0; i < 300; i++) {
    const a = nav.randomSpot(0, 0, 0, nav.halfSize * 0.9, rng)
    const b = a && nav.randomSpot(a[0], a[1], 10, 70, rng)
    if (!a || !b) continue
    const [, ms] = time(() => nav.findPath(a[0], a[1], b[0], b[1]))
    astar.push(ms)
  }
  astar.sort((p, q) => p - q)

  const [, zoneMs] = time(() => {
    for (let i = 0; i < 100_000; i++)
      world.zoneAt((rng() * 2 - 1) * world.halfSize, (rng() * 2 - 1) * world.halfSize)
  })
  const [, collideMs] = time(() => {
    for (let i = 0; i < 100_000; i++)
      world.resolveCircle((rng() * 2 - 1) * world.halfSize, (rng() * 2 - 1) * world.halfSize, 0.45)
  })

  rows.push({
    city: id,
    buildings: city.buildings.length,
    roads: city.roads.length,
    'parse ms': +parseMs.toFixed(1),
    'World ms': +worldMs.toFixed(1),
    'NavGrid ms': +navMs.toFixed(0),
    'spawn ms': +spawnMs.toFixed(1),
    'AI 22 animals avg ms/frame': +(frames.reduce((s, v) => s + v, 0) / frames.length).toFixed(3),
    'AI p99 ms': +(frames[Math.floor(frames.length * 0.99)] as number).toFixed(3),
    'AI max ms': +(frames[frames.length - 1] as number).toFixed(2),
    'A* avg ms': +(astar.reduce((s, v) => s + v, 0) / astar.length).toFixed(2),
    'A* max ms': +(astar[astar.length - 1] as number).toFixed(1),
    'zoneAt us/call': +((zoneMs / 100_000) * 1000).toFixed(2),
    'resolveCircle us/call': +((collideMs / 100_000) * 1000).toFixed(2),
  })
}
if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2))
else console.table(rows)
