import type { Aabb } from './geometry2d'

/** Uniform hash grid: cheap point/box lookups for collision and zone queries. */
export class SpatialGrid<T> {
  private readonly cells = new Map<number, T[]>()

  private readonly cell: number

  constructor(cell = 25) {
    this.cell = cell
  }

  private key(cx: number, cz: number): number {
    return (cx + 8192) * 16384 + (cz + 8192)
  }

  insert(item: T, box: Aabb): void {
    const c = this.cell
    for (let cx = Math.floor(box.minX / c); cx <= Math.floor(box.maxX / c); cx++) {
      for (let cz = Math.floor(box.minZ / c); cz <= Math.floor(box.maxZ / c); cz++) {
        const k = this.key(cx, cz)
        const list = this.cells.get(k)
        if (list) list.push(item)
        else this.cells.set(k, [item])
      }
    }
  }

  /** Candidates in the cell containing the point. Callers must still test precisely. */
  queryPoint(x: number, z: number): readonly T[] {
    return this.cells.get(this.key(Math.floor(x / this.cell), Math.floor(z / this.cell))) ?? []
  }

  /** Deduplicated candidates overlapping the box. */
  queryBox(minX: number, minZ: number, maxX: number, maxZ: number): T[] {
    const c = this.cell
    const out = new Set<T>()
    for (let cx = Math.floor(minX / c); cx <= Math.floor(maxX / c); cx++) {
      for (let cz = Math.floor(minZ / c); cz <= Math.floor(maxZ / c); cz++) {
        this.cells.get(this.key(cx, cz))?.forEach((t) => out.add(t))
      }
    }
    return [...out]
  }
}
