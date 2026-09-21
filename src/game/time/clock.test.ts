import { describe, expect, it } from 'vitest'
import {
  advanceClock,
  createClock,
  formatClock,
  normalizeHour,
  phaseLabel,
  PHASE_START_HOUR,
} from './clock'
import { dayPhaseAt } from './dayPhase'

describe('clock', () => {
  it('advances so a full day takes daySeconds, and wraps past midnight', () => {
    const c = createClock(0, 240)
    for (let t = 0; t < 120; t += 0.5) advanceClock(c, 0.5)
    expect(c.hour).toBeCloseTo(12, 6)
    for (let t = 0; t < 130; t += 0.5) advanceClock(c, 0.5)
    expect(c.hour).toBeGreaterThanOrEqual(0)
    expect(c.hour).toBeLessThan(24)
    expect(c.hour).toBeCloseTo((12 + (130 / 240) * 24) % 24, 6)
  })

  it('normalizes odd inputs safely', () => {
    expect(normalizeHour(25)).toBe(1)
    expect(normalizeHour(-1)).toBe(23)
    expect(normalizeHour(NaN)).toBe(8)
    expect(createClock(Infinity).hour).toBe(8)
  })

  it('formats HH:MM and labels the phase', () => {
    expect(formatClock(8.5)).toBe('08:30')
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(23.999)).toBe('23:59')
    expect(phaseLabel(7)).toBe('Morning')
    expect(phaseLabel(22)).toBe('Night')
  })

  it('phase shortcuts land inside their phase', () => {
    for (const [phase, hour] of Object.entries(PHASE_START_HOUR))
      expect(dayPhaseAt(hour)).toBe(phase)
  })
})
