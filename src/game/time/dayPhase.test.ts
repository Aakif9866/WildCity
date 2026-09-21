import { describe, expect, it } from 'vitest'
import { dayPhaseAt } from './dayPhase'

describe('dayPhaseAt', () => {
  it('maps hours to phases including the midnight wrap', () => {
    expect(dayPhaseAt(5)).toBe('morning')
    expect(dayPhaseAt(9.99)).toBe('morning')
    expect(dayPhaseAt(12)).toBe('day')
    expect(dayPhaseAt(18)).toBe('evening')
    expect(dayPhaseAt(22)).toBe('night')
    expect(dayPhaseAt(0)).toBe('night')
    expect(dayPhaseAt(4.9)).toBe('night')
    expect(dayPhaseAt(24 + 12)).toBe('day')
    expect(dayPhaseAt(-1)).toBe('night')
  })
})
