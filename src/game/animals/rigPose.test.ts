import { describe, expect, it } from 'vitest'
import { newPose, poseFor } from './rigPose'

describe('poseFor', () => {
  it('legs A and B move in opposite phase and stand still when not moving', () => {
    const a = poseFor('strideA', 'walk', 1, 1, 0, newPose()).z
    const b = poseFor('strideB', 'walk', 1, 1, 0, newPose()).z
    expect(a).toBeCloseTo(-b, 6)
    expect(poseFor('strideA', 'idle', 0, 1, 0, newPose())).toEqual(newPose())
  })
  it('wings flap only while flying, mirrored left/right', () => {
    expect(poseFor('flapL', 'walk', 1, 0, 0.3, newPose()).rz).toBe(0)
    const l = poseFor('flapL', 'fly', 1, 0, 0.3, newPose()).rz
    const r = poseFor('flapR', 'fly', 1, 0, 0.3, newPose()).rz
    expect(l).toBeCloseTo(-r, 6)
    expect(l).not.toBe(0)
  })
  it('feet never go below the ground (lift is non-negative)', () => {
    for (let p = 0; p < 7; p += 0.2)
      expect(poseFor('strideA', 'run', 1, p, 0, newPose()).y).toBeGreaterThanOrEqual(0)
  })
})
