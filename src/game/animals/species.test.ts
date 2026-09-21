import { describe, expect, it } from 'vitest'
import { DAY_PHASES } from '@/game/time/dayPhase'
import { DEFAULT_PREFERENCE, preference, SPECIES, zoneCost } from './species'
import { DEFAULT_SPAWN_PLAN } from './spawnPlan'

const all = Object.values(SPECIES)

describe('species data', () => {
  it('has the five MVP species with valid, well-formed config', () => {
    expect(Object.keys(SPECIES).sort()).toEqual(['cat', 'dog', 'monkey', 'pigeon', 'squirrel'])
    for (const s of all) {
      expect(s.rig.groups.length).toBeGreaterThan(2)
      expect(s.coats.length).toBeGreaterThan(0)
      expect(s.walkSpeed).toBeGreaterThan(0)
      expect(s.runSpeed).toBeGreaterThan(s.walkSpeed)
      for (const v of Object.values(s.zonePreference)) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
      for (const p of DAY_PHASES) {
        expect(s.activity[p]).toBeGreaterThanOrEqual(0)
        expect(s.activity[p]).toBeLessThanOrEqual(1)
      }
      for (const [min, max] of Object.values(s.personality)) expect(min).toBeLessThanOrEqual(max)
      expect(s.wanderRange[0]).toBeLessThan(s.wanderRange[1])
    }
  })

  it('every rig has legs and a head so it can animate', () => {
    for (const s of all) {
      const anims = s.rig.groups.map((g) => g.anim)
      expect(anims).toContain('strideA')
      expect(anims).toContain('strideB')
      expect(anims).toContain('head')
    }
  })

  it('matches the zone preferences from the design doc', () => {
    const order = (id: keyof typeof SPECIES, zones: Parameters<typeof preference>[1][]): boolean =>
      zones.every(
        (z, i) => i === 0 || preference(SPECIES[id], zones[i - 1]!) > preference(SPECIES[id], z),
      )
    expect(order('dog', ['PARK', 'SIDEWALK', 'RESIDENTIAL'])).toBe(true)
    expect(order('pigeon', ['BUILDING', 'ROAD', 'PARK'])).toBe(true)
    expect(order('monkey', ['TREE', 'PARK', 'RESIDENTIAL'])).toBe(true)
    expect(order('squirrel', ['TREE', 'PARK'])).toBe(true)
  })

  it('matches the activity schedules: birds morning, cats evening/night, dogs day', () => {
    const p = SPECIES.pigeon.activity
    expect(p.morning).toBeGreaterThanOrEqual(Math.max(p.day, p.evening, p.night))
    const c = SPECIES.cat.activity
    expect(Math.min(c.evening, c.night)).toBeGreaterThan(Math.max(c.morning, c.day))
    const d = SPECIES.dog.activity
    expect(d.day).toBeGreaterThanOrEqual(Math.max(d.morning, d.evening, d.night))
    for (const s of all) expect(s.activity.night).toBeLessThanOrEqual(1)
  })

  it('species differ in personality range and behaviour tuning (data-driven)', () => {
    expect(SPECIES.dog.personality.social[0]).toBeGreaterThan(SPECIES.cat.personality.social[1] - 1)
    expect(SPECIES.squirrel.wanderRange[1]).toBeLessThan(SPECIES.dog.wanderRange[1])
    expect(SPECIES.cat.idleScale).toBeGreaterThan(SPECIES.squirrel.idleScale)
    expect(SPECIES.pigeon.flying).toBe(true)
    expect(all.filter((s) => s.flying)).toHaveLength(1)
  })

  it('unlisted zones get the default preference and higher cost', () => {
    expect(preference(SPECIES.dog, 'WATER')).toBe(DEFAULT_PREFERENCE)
    expect(zoneCost(SPECIES.dog)('PARK')).toBe(1)
    expect(zoneCost(SPECIES.dog)('ROAD')).toBeGreaterThan(zoneCost(SPECIES.dog)('SIDEWALK'))
  })

  it('the default spawn plan is the 22-animal MVP population', () => {
    expect(DEFAULT_SPAWN_PLAN.reduce((n, r) => n + r.count, 0)).toBe(22)
  })
})
