import type { Vec2, ZoneKind } from '@/cities/types'
import type { Rng } from '@/utils/random'
import { pickWeighted } from '@/utils/random'
import type { World } from '@/game/world/World'

export const ZONE_LIST: ZoneKind[] = [
  'ROAD',
  'SIDEWALK',
  'BUILDING',
  'PARK',
  'WATER',
  'RESIDENTIAL',
  'COMMERCIAL',
  'TREE',
]
const ZONE_CODE = new Map(ZONE_LIST.map((z, i) => [z, i]))
const TREE_RADIUS = 2.5
// Distance kept from building walls: bigger than any animal's collision radius so paths never graze walls.
const CLEARANCE = 1

export type ZoneCost = (zone: ZoneKind) => number

class MinHeap {
  private ids: number[] = []
  private keys: number[] = []
  get size(): number {
    return this.ids.length
  }
  push(id: number, key: number): void {
    let i = this.ids.length
    this.ids.push(id)
    this.keys.push(key)
    while (i > 0) {
      const p = (i - 1) >> 1
      if ((this.keys[p] as number) <= key) break
      this.ids[i] = this.ids[p] as number
      this.keys[i] = this.keys[p] as number
      i = p
    }
    this.ids[i] = id
    this.keys[i] = key
  }
  pop(): number {
    const top = this.ids[0] as number
    const lastId = this.ids.pop() as number
    const lastKey = this.keys.pop() as number
    const n = this.ids.length
    if (n > 0) {
      let i = 0
      for (;;) {
        let c = 2 * i + 1
        if (c >= n) break
        if (c + 1 < n && (this.keys[c + 1] as number) < (this.keys[c] as number)) c++
        if ((this.keys[c] as number) >= lastKey) break
        this.ids[i] = this.ids[c] as number
        this.keys[i] = this.keys[c] as number
        i = c
      }
      this.ids[i] = lastId
      this.keys[i] = lastKey
    }
    return top
  }
}

/**
 * Coarse walkability + zone grid over the playable area, with A* on top. Built once per city;
 * animals query it instead of the polygon-based World so pathfinding stays cheap.
 */
export class NavGrid {
  readonly cell: number
  readonly n: number
  readonly halfSize: number
  private readonly walkable: Uint8Array
  private readonly zones: Uint8Array
  // Reused across searches; `stamp` avoids clearing 60k+ entries per query.
  private readonly stamp: Uint32Array
  private readonly g: Float32Array
  private readonly parent: Int32Array
  private readonly closed: Uint32Array
  private search = 0

  constructor(world: World, cell = 2) {
    this.cell = cell
    this.halfSize = world.halfSize
    this.n = Math.ceil((world.halfSize * 2) / cell)
    const total = this.n * this.n
    this.walkable = new Uint8Array(total)
    this.zones = new Uint8Array(total)
    this.stamp = new Uint32Array(total)
    this.g = new Float32Array(total)
    this.parent = new Int32Array(total)
    this.closed = new Uint32Array(total)

    for (let cz = 0; cz < this.n; cz++) {
      for (let cx = 0; cx < this.n; cx++) {
        const x = -this.halfSize + (cx + 0.5) * cell
        const z = -this.halfSize + (cz + 0.5) * cell
        const zone = world.zoneAt(x, z)
        const i = cz * this.n + cx
        this.zones[i] = ZONE_CODE.get(zone) ?? 0
        const nearWall = zone !== 'BUILDING' && world.resolveCircle(x, z, CLEARANCE).hit
        const edge = !world.inBounds(x, z, 1.5)
        this.walkable[i] = zone === 'BUILDING' || zone === 'WATER' || nearWall || edge ? 0 : 1
      }
    }

    // Derived TREE zone: lets species prefer "trees" through the same zone-preference config.
    const treeZone = ZONE_CODE.get('TREE') as number
    const reach = Math.ceil(TREE_RADIUS / cell)
    for (const [tx, tz] of world.city.trees) {
      const cx0 = Math.floor((tx + this.halfSize) / cell)
      const cz0 = Math.floor((tz + this.halfSize) / cell)
      for (let dz = -reach; dz <= reach; dz++) {
        for (let dx = -reach; dx <= reach; dx++) {
          const cx = cx0 + dx
          const cz = cz0 + dz
          if (cx < 0 || cz < 0 || cx >= this.n || cz >= this.n) continue
          const i = cz * this.n + cx
          const z = ZONE_LIST[this.zones[i] as number] as ZoneKind
          if (z === 'ROAD' || z === 'BUILDING' || z === 'WATER') continue
          if (Math.hypot(dx * cell, dz * cell) <= TREE_RADIUS) this.zones[i] = treeZone
        }
      }
    }
  }

  private toCell(v: number): number {
    return Math.floor((v + this.halfSize) / this.cell)
  }
  private center(c: number): number {
    return -this.halfSize + (c + 0.5) * this.cell
  }
  private index(x: number, z: number): number {
    const cx = this.toCell(x)
    const cz = this.toCell(z)
    return cx < 0 || cz < 0 || cx >= this.n || cz >= this.n ? -1 : cz * this.n + cx
  }

  isWalkable(x: number, z: number): boolean {
    const i = this.index(x, z)
    return i >= 0 && this.walkable[i] === 1
  }

  zoneAt(x: number, z: number): ZoneKind {
    const i = this.index(x, z)
    return i < 0 ? 'RESIDENTIAL' : (ZONE_LIST[this.zones[i] as number] as ZoneKind)
  }

  /** Closest walkable cell centre within maxRadius metres (ring search). */
  nearestWalkable(x: number, z: number, maxRadius = 20): Vec2 | null {
    if (this.isWalkable(x, z)) return [x, z]
    const cx0 = this.toCell(x)
    const cz0 = this.toCell(z)
    const maxR = Math.ceil(maxRadius / this.cell)
    for (let r = 1; r <= maxR; r++) {
      let best: Vec2 | null = null
      let bestD = Infinity
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue
          const cx = cx0 + dx
          const cz = cz0 + dz
          if (cx < 0 || cz < 0 || cx >= this.n || cz >= this.n) continue
          if (this.walkable[cz * this.n + cx] !== 1) continue
          const px = this.center(cx)
          const pz = this.center(cz)
          const d = Math.hypot(px - x, pz - z)
          if (d < bestD) {
            bestD = d
            best = [px, pz]
          }
        }
      }
      if (best) return best
    }
    return null
  }

  /** True if the straight segment only crosses walkable cells. */
  lineClear(ax: number, az: number, bx: number, bz: number): boolean {
    const len = Math.hypot(bx - ax, bz - az)
    const steps = Math.ceil(len / (this.cell * 0.5))
    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps
      if (!this.isWalkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false
    }
    return true
  }

  /**
   * A* over the walkable grid (8-neighbour, no corner cutting), then greedy line-of-sight
   * smoothing. `cost` biases the route towards preferred zones. Returns waypoints excluding the start.
   */
  findPath(
    sx: number,
    sz: number,
    gx: number,
    gz: number,
    cost?: ZoneCost,
    maxNodes = 12000,
  ): Vec2[] | null {
    const start = this.index(sx, sz)
    const goal = this.index(gx, gz)
    if (start < 0 || goal < 0 || this.walkable[goal] !== 1) return null
    // The start may sit in a non-walkable cell (e.g. just nudged by collision): allow leaving it.
    const id = ++this.search
    const n = this.n
    const goalX = goal % n
    const goalZ = (goal / n) | 0
    const heap = new MinHeap()
    this.stamp[start] = id
    this.g[start] = 0
    this.parent[start] = -1
    heap.push(start, 0)
    let expanded = 0
    let found = false

    while (heap.size > 0 && expanded < maxNodes) {
      const cur = heap.pop()
      if (this.closed[cur] === id) continue
      this.closed[cur] = id
      if (cur === goal) {
        found = true
        break
      }
      expanded++
      const cx = cur % n
      const cz = (cur / n) | 0
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dz === 0) continue
          const nx = cx + dx
          const nz = cz + dz
          if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue
          const ni = nz * n + nx
          if (this.walkable[ni] !== 1 || this.closed[ni] === id) continue
          if (
            dx !== 0 &&
            dz !== 0 &&
            (this.walkable[cz * n + nx] !== 1 || this.walkable[nz * n + cx] !== 1)
          )
            continue
          const zoneMul = cost ? cost(ZONE_LIST[this.zones[ni] as number] as ZoneKind) : 1
          const step = (dx !== 0 && dz !== 0 ? 1.4142 : 1) * zoneMul
          const ng = (this.g[cur] as number) + step
          if (this.stamp[ni] !== id || ng < (this.g[ni] as number)) {
            this.stamp[ni] = id
            this.g[ni] = ng
            this.parent[ni] = cur
            // Heuristic uses the cheapest possible zone multiplier (1) so it stays admissible.
            heap.push(ni, ng + Math.hypot(nx - goalX, nz - goalZ))
          }
        }
      }
    }
    if (!found) return null

    const cells: number[] = []
    for (let c = goal; c !== -1 && c !== start; c = this.parent[c] as number) cells.push(c)
    cells.reverse()
    const pts: Vec2[] = [
      [sx, sz],
      ...cells.map((c): Vec2 => [this.center(c % n), this.center((c / n) | 0)]),
    ]
    pts[pts.length - 1] = [gx, gz]

    const out: Vec2[] = []
    let anchor = 0
    while (anchor < pts.length - 1) {
      let far = anchor + 1
      for (let j = pts.length - 1; j > anchor + 1; j--) {
        const a = pts[anchor] as Vec2
        const b = pts[j] as Vec2
        if (this.lineClear(a[0], a[1], b[0], b[1])) {
          far = j
          break
        }
      }
      out.push(pts[far] as Vec2)
      anchor = far
    }
    return out
  }

  /** Angle (yaw convention, 0 = -z) towards the nearest cell of `zone` within `dist`, or null. */
  directionToZone(x: number, z: number, zone: ZoneKind, dist: number): number | null {
    let best: number | null = null
    let bestD = Infinity
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2
      for (let d = this.cell; d <= dist; d += this.cell) {
        if (this.zoneAt(x + Math.cos(a) * d, z + Math.sin(a) * d) === zone) {
          if (d < bestD) {
            bestD = d
            best = Math.atan2(-Math.cos(a), -Math.sin(a))
          }
          break
        }
      }
    }
    return best
  }

  /**
   * Like randomSpot but with an arbitrary acceptance test (e.g. "next to water").
   */
  randomSpotWhere(
    cx: number,
    cz: number,
    minR: number,
    maxR: number,
    rng: Rng,
    accept: (x: number, z: number) => boolean,
    tries = 30,
  ): Vec2 | null {
    for (let t = 0; t < tries; t++) {
      const a = rng() * Math.PI * 2
      const r = minR + rng() * (maxR - minR)
      const x = cx + Math.cos(a) * r
      const z = cz + Math.sin(a) * r
      if (this.isWalkable(x, z) && accept(x, z)) return [x, z]
    }
    return null
  }

  /**
   * Like randomSpot for flyers: any in-bounds point that isn't water, including rooftops.
   * Weights see the true zone (BUILDING included) so pigeons can prefer roofs.
   */
  randomAirSpot(
    cx: number,
    cz: number,
    minR: number,
    maxR: number,
    rng: Rng,
    weight?: ZoneCost,
    tries = 14,
  ): Vec2 | null {
    const candidates: { p: Vec2; w: number }[] = []
    const limit = this.halfSize - 3
    for (let t = 0; t < tries; t++) {
      const a = rng() * Math.PI * 2
      const r = minR + rng() * (maxR - minR)
      const x = cx + Math.cos(a) * r
      const z = cz + Math.sin(a) * r
      if (Math.abs(x) > limit || Math.abs(z) > limit) continue
      const zone = this.zoneAt(x, z)
      if (zone === 'WATER') continue
      candidates.push({ p: [x, z], w: weight ? weight(zone) : 1 })
    }
    return pickWeighted(rng, candidates, (c) => c.w)?.p ?? null
  }

  /**
   * Sample walkable spots in an annulus and pick one weighted by `weight(zone)`. Cheap and
   * good enough for "where would I like to go next" decisions.
   */
  randomSpot(
    cx: number,
    cz: number,
    minR: number,
    maxR: number,
    rng: Rng,
    weight?: ZoneCost,
    tries = 14,
  ): Vec2 | null {
    const candidates: { p: Vec2; w: number }[] = []
    for (let t = 0; t < tries; t++) {
      const a = rng() * Math.PI * 2
      const r = minR + rng() * (maxR - minR)
      const x = cx + Math.cos(a) * r
      const z = cz + Math.sin(a) * r
      if (!this.isWalkable(x, z)) continue
      candidates.push({ p: [x, z], w: weight ? weight(this.zoneAt(x, z)) : 1 })
    }
    return pickWeighted(rng, candidates, (c) => c.w)?.p ?? null
  }
}
