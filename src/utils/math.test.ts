import { describe, expect, it } from 'vitest'
import { clamp, lerp } from './math'

describe('math utils', () => {
  it('clamps below, within and above range', () => {
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(11, 0, 10)).toBe(10)
  })

  it('lerps between two values', () => {
    expect(lerp(0, 10, 0.5)).toBe(5)
  })
})
