import { describe, expect, it } from 'vitest'
import { parseRig } from './rig'
import { SPECIES } from './species'

describe('parseRig', () => {
  it('accepts the shipped dog rig', () => {
    expect(SPECIES.dog.rig.groups.length).toBeGreaterThan(2)
  })
  it('rejects malformed rigs instead of returning garbage', () => {
    expect(() => parseRig(null)).toThrow()
    expect(() => parseRig({ groups: [] })).toThrow()
    expect(() => parseRig({ groups: [{ pivot: [0, 0], parts: [] }] })).toThrow()
    expect(() =>
      parseRig({ groups: [{ pivot: [0, 0, 0], parts: [{ size: [1, 1, 1], pos: [0, 0, 0] }] }] }),
    ).toThrow()
  })
  it('falls back to no animation for an unknown anim name', () => {
    expect(
      parseRig({ groups: [{ pivot: [0, 0, 0], anim: 'wiggle', parts: [] }] }).groups[0]!.anim,
    ).toBe('none')
  })
})
