import { describe, expect, it } from 'vitest'
import { decideDpr, dprSteps, FAST_MS, SLOW_MS } from './quality'

describe('dprSteps', () => {
  it('always ends at the device maximum and never exceeds it', () => {
    expect(dprSteps(2)).toEqual([0.6, 0.75, 1, 1.25, 1.5, 2])
    expect(dprSteps(1)).toEqual([0.6, 0.75, 1])
    expect(dprSteps(3)).toEqual([0.6, 0.75, 1, 1.25, 1.5, 2, 3])
    expect(dprSteps(1.75).at(-1)).toBe(1.75)
  })
})

describe('decideDpr', () => {
  it('steps down one notch when frames are slow, and stops at the floor', () => {
    expect(decideDpr(2, SLOW_MS + 10, 2)).toBe(1.5)
    expect(decideDpr(0.6, 200, 2)).toBe(0.6)
  })
  it('steps up when there is headroom, and stops at the device maximum', () => {
    expect(decideDpr(1, FAST_MS - 5, 2)).toBe(1.25)
    expect(decideDpr(2, 4, 2)).toBe(2)
  })
  it('holds steady inside the hysteresis band (no flip-flopping)', () => {
    for (const ms of [FAST_MS, 16.7, 20, SLOW_MS]) expect(decideDpr(1.5, ms, 2)).toBe(1.5)
  })
  it('converges instead of oscillating: a steady 30 ms machine settles at the floor, a 10 ms one at the top', () => {
    let d = 2
    for (let i = 0; i < 20; i++) d = decideDpr(d, 30, 2)
    expect(d).toBe(0.6)
    for (let i = 0; i < 20; i++) d = decideDpr(d, 10, 2)
    expect(d).toBe(2)
  })
  it('snaps an unknown starting value to the nearest step', () => {
    expect(decideDpr(1.1, 16.7, 2)).toBe(1)
  })
})
