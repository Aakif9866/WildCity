import { pointInPolygon, rectPolygon } from '@/game/world/geometry2d'
import { mulberry32, randRange } from '@/utils/random'
import type { AreaZone, Building, CityData, Road, Vec2 } from './types'
import { SIDEWALK_WIDTH } from './types'

// Hand-made test city in the exact same format real cities use. Kept as a generator (not
// committed JSON) because it doubles as an always-available offline fallback city.
const HALF = 250
const LINES = [-125, 0, 125]
const EDGES = [-HALF, ...LINES, HALF]
const roadWidth = (line: number): number => (line === 0 ? 16 : 12)

const PARK_BLOCKS = new Set(['1,1', '2,2'])
const COMMERCIAL_BLOCKS = new Set(['2,1', '1,2', '3,3'])

export function generateDemoCity(seed = 7): CityData {
  const rng = mulberry32(seed)
  const roads: Road[] = []
  const buildings: Building[] = []
  const zones: AreaZone[] = []
  const trees: Vec2[] = []

  for (const line of LINES) {
    const kind = line === 0 ? 'primary' : 'secondary'
    roads.push({
      id: `ew-${line}`,
      kind,
      width: roadWidth(line),
      points: [
        [-HALF, line],
        [HALF, line],
      ],
    })
    roads.push({
      id: `ns-${line}`,
      kind,
      width: roadWidth(line),
      points: [
        [line, -HALF],
        [line, HALF],
      ],
    })
  }

  // Inner rectangle of a block: inset from adjacent road edges + sidewalk, small margin at map edge.
  const inset = (edge: number, isMapEdge: boolean): number =>
    isMapEdge ? 6 : roadWidth(edge) / 2 + SIDEWALK_WIDTH + 3
  const blockRect = (i: number, j: number) => {
    const x0 = EDGES[i] as number
    const x1 = EDGES[i + 1] as number
    const z0 = EDGES[j] as number
    const z1 = EDGES[j + 1] as number
    return {
      minX: x0 + inset(x0, i === 0),
      maxX: x1 - inset(x1, i === EDGES.length - 2),
      minZ: z0 + inset(z0, j === 0),
      maxZ: z1 - inset(z1, j === EDGES.length - 2),
    }
  }

  const pond: Vec2[] = Array.from({ length: 14 }, (_, k) => {
    const a = (k / 14) * Math.PI * 2
    return [-62 + Math.cos(a) * 14, -62 + Math.sin(a) * 10] as Vec2
  })

  for (let i = 0; i < EDGES.length - 1; i++) {
    for (let j = 0; j < EDGES.length - 1; j++) {
      const key = `${i},${j}`
      const r = blockRect(i, j)
      const poly = rectPolygon(r.minX, r.minZ, r.maxX, r.maxZ)

      if (PARK_BLOCKS.has(key)) {
        zones.push({ kind: 'PARK', polygon: poly })
        continue
      }
      const commercial = COMMERCIAL_BLOCKS.has(key)
      zones.push({ kind: commercial ? 'COMMERCIAL' : 'RESIDENTIAL', polygon: poly })

      const nx = 3 + Math.floor(rng() * 2)
      const nz = 3 + Math.floor(rng() * 2)
      const lotW = (r.maxX - r.minX) / nx
      const lotD = (r.maxZ - r.minZ) / nz
      for (let a = 0; a < nx; a++) {
        for (let b = 0; b < nz; b++) {
          if (rng() < 0.12) continue // empty lot -> open ground, gives animals somewhere to be
          const m = randRange(rng, 2.5, 5)
          const x0 = r.minX + a * lotW + m
          const x1 = r.minX + (a + 1) * lotW - m
          const z0 = r.minZ + b * lotD + m
          const z1 = r.minZ + (b + 1) * lotD - m
          const footprint: Vec2[] =
            rng() < 0.25
              ? [
                  [x0, z0],
                  [x1, z0],
                  [x1, (z0 + z1) / 2],
                  [(x0 + x1) / 2, (z0 + z1) / 2],
                  [(x0 + x1) / 2, z1],
                  [x0, z1],
                ]
              : rectPolygon(x0, z0, x1, z1)
          const height = commercial ? randRange(rng, 15, 40) : randRange(rng, 6, 16)
          buildings.push({ id: `b-${i}-${j}-${a}-${b}`, footprint, height: Math.round(height) })
        }
      }
    }
  }
  zones.push({ kind: 'WATER', polygon: pond })

  // Street trees along both sidewalks, skipping intersections.
  const nearCrossing = (v: number, axisLines: number[]): boolean =>
    axisLines.some((l) => Math.abs(v - l) < roadWidth(l) / 2 + 5)
  for (const line of LINES) {
    const off = roadWidth(line) / 2 + SIDEWALK_WIDTH / 2
    for (let t = -HALF + 10; t < HALF - 5; t += 14) {
      if (nearCrossing(t, LINES)) continue
      trees.push([t, line - off], [t, line + off], [line - off, t], [line + off, t])
    }
  }

  // Park and yard trees, kept out of the pond and buildings.
  const blocked = (x: number, z: number): boolean =>
    buildings.some((b) => pointInPolygon(x, z, b.footprint)) || pointInPolygon(x, z, pond)
  for (const zone of zones) {
    if (zone.kind !== 'PARK' && zone.kind !== 'RESIDENTIAL') continue
    const xs = zone.polygon.map((p) => p[0])
    const zs = zone.polygon.map((p) => p[1])
    const count = zone.kind === 'PARK' ? 70 : 8
    for (let n = 0, placed = 0; placed < count && n < count * 6; n++) {
      const x = randRange(rng, Math.min(...xs) + 2, Math.max(...xs) - 2)
      const z = randRange(rng, Math.min(...zs) + 2, Math.max(...zs) - 2)
      if (blocked(x, z)) continue
      trees.push([x, z])
      placed++
    }
  }

  return {
    metadata: {
      id: 'demo',
      name: 'Demo Town',
      country: 'Test',
      center: { lat: 0, lon: 0 },
      halfSize: HALF,
      spawn: { x: 0, z: 20, yaw: 0 },
    },
    roads,
    buildings,
    zones,
    trees,
  }
}
