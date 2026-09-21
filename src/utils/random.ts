export type Rng = () => number

/** Small deterministic PRNG so worlds and tests are reproducible from a seed. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const randRange = (rng: Rng, min: number, max: number): number => min + rng() * (max - min)

export function pickWeighted<T>(
  rng: Rng,
  items: readonly T[],
  weight: (item: T) => number,
): T | null {
  let total = 0
  for (const item of items) total += Math.max(0, weight(item))
  if (total <= 0) return null
  let r = rng() * total
  for (const item of items) {
    r -= Math.max(0, weight(item))
    if (r <= 0) return item
  }
  return items[items.length - 1] ?? null
}
