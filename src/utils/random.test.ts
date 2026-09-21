import { describe, expect, it } from 'vitest'
import { mulberry32, pickWeighted } from './random'

describe('random', () => {
  it('is deterministic for a seed and within [0, 1)', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 50; i++) {
      const v = a()
      expect(v).toBe(b())
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('pickWeighted respects zero weights and returns null when all are zero', () => {
    const rng = mulberry32(1)
    for (let i = 0; i < 30; i++)
      expect(pickWeighted(rng, ['a', 'b'], (s) => (s === 'a' ? 0 : 1))).toBe('b')
    expect(pickWeighted(rng, ['a'], () => 0)).toBeNull()
  })
})
