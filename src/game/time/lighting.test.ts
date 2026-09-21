import { describe, expect, it } from 'vitest'
import { lightingAt, type LightingState } from './lighting'

const brightness = (c: number[]): number => c[0]! * 0.3 + c[1]! * 0.6 + c[2]! * 0.1

describe('lightingAt', () => {
  it('the sun is overhead at noon and below the horizon at midnight', () => {
    expect(lightingAt(12).sunPosition[1]).toBeGreaterThan(0.9)
    expect(lightingAt(0).sunPosition[1]).toBeLessThan(-0.9)
    expect(lightingAt(6).sunPosition[1]).toBeCloseTo(0, 1)
  })

  it('the sun rises in the east (+x) and sets in the west (-x)', () => {
    expect(lightingAt(7).sunPosition[0]).toBeGreaterThan(0.4)
    expect(lightingAt(17).sunPosition[0]).toBeLessThan(-0.4)
  })

  it('the main light always comes from above the horizon (moon at night)', () => {
    for (let h = 0; h < 24; h += 0.25) expect(lightingAt(h).lightDirection[1]).toBeGreaterThan(0.04)
    const night = lightingAt(1)
    expect(night.lightDirection[1]).toBeGreaterThan(0)
    expect(night.moonPosition[1]).toBeGreaterThan(0.9)
  })

  it('midday is bright, night is dim but never black, dusk is in between', () => {
    const noon = lightingAt(12)
    const night = lightingAt(1)
    const dusk = lightingAt(19)
    expect(noon.lightIntensity + noon.hemiIntensity).toBeGreaterThan(
      night.lightIntensity + night.hemiIntensity,
    )
    expect(brightness(noon.sky)).toBeGreaterThan(brightness(dusk.sky))
    expect(brightness(dusk.sky)).toBeGreaterThan(brightness(night.sky))
    expect(night.hemiIntensity).toBeGreaterThan(0.5) // stays playable
    expect(night.lightIntensity).toBeGreaterThan(0.1)
  })

  it('stars only show at night, and fade in/out', () => {
    expect(lightingAt(12).stars).toBe(0)
    expect(lightingAt(1).stars).toBe(1)
    expect(lightingAt(23).stars).toBe(1)
    expect(lightingAt(20).stars).toBeGreaterThan(0)
    expect(lightingAt(20).stars).toBeLessThan(1)
  })

  it('sunset is warm: red > blue in the sky colour at 18:30', () => {
    const s = lightingAt(18.5).sky
    expect(s[0]).toBeGreaterThan(s[2])
  })

  it('has no visible jumps: adjacent minutes differ by a tiny amount, including across midnight', () => {
    const flat = (l: LightingState): number[] => [
      ...l.sky,
      ...l.lightColor,
      ...l.hemiSky,
      ...l.hemiGround,
      l.lightIntensity,
      l.hemiIntensity,
      l.stars,
      ...l.sunPosition,
    ]
    let worst = 0
    for (let m = 0; m < 24 * 60; m++) {
      const a = flat(lightingAt(m / 60))
      const b = flat(lightingAt(((m + 1) % (24 * 60)) / 60))
      a.forEach((v, i) => (worst = Math.max(worst, Math.abs(v - b[i]!))))
    }
    expect(worst).toBeLessThan(0.05)
  })

  it('wraps hours outside 0..24 and returns finite numbers everywhere', () => {
    expect(lightingAt(36).sky).toEqual(lightingAt(12).sky)
    expect(lightingAt(-6).sky).toEqual(lightingAt(18).sky)
    for (let h = 0; h < 24; h += 0.1) {
      const l = lightingAt(h)
      expect(
        [...l.sky, ...l.lightColor, l.lightIntensity, l.hemiIntensity, ...l.lightDirection].every(
          Number.isFinite,
        ),
      ).toBe(true)
    }
  })
})
