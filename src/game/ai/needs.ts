import { clamp } from '@/utils/math'
import type { SpeciesConfig } from '@/game/animals/species'
import type { Animal } from '@/game/animals/types'

/**
 * Advance hunger and energy. Personality matters: energetic individuals tire slower and get
 * hungry a bit faster (they burn more). Resting/sleeping recovers energy; eating cuts hunger.
 */
export function updateNeeds(a: Animal, s: SpeciesConfig, dt: number): void {
  const vigor = a.vigor / 100
  a.hunger = clamp(a.hunger + s.needs.hungerPerSec * (0.8 + vigor * 0.4) * dt, 0, 100)

  const tiredness = 1.4 - vigor * 0.8 // vigor 0 -> 1.4x drain, vigor 1 -> 0.6x
  if (a.state === 'REST') a.energy += s.needs.restRegen * dt
  else if (a.state === 'SLEEP') a.energy += s.needs.restRegen * 1.5 * dt
  else if (a.speed > 3) a.energy -= s.needs.energyRun * tiredness * dt
  else if (a.speed > 0.25) a.energy -= s.needs.energyWalk * tiredness * dt
  a.energy = clamp(a.energy, 0, 100)

  if (a.state === 'EAT') a.hunger = clamp(a.hunger - 9 * dt, 0, 100)
}

export type Mood = 'Scared' | 'Hungry' | 'Sleepy' | 'Tired' | 'Curious' | 'Playful' | 'Content'

/** Human-readable mood for the UI, derived (never stored) so it can't drift out of sync. */
export function moodOf(a: Animal): Mood {
  if (a.state === 'FLEE') return 'Scared'
  if (a.state === 'SLEEP') return 'Sleepy'
  if (a.hunger > 70) return 'Hungry'
  if (a.energy < 25) return 'Tired'
  if (a.state === 'INVESTIGATE' || (a.curiosity > 70 && a.state === 'WANDER')) return 'Curious'
  if (a.state === 'FOLLOW' || a.state === 'INTERACT' || (a.vigor > 70 && a.energy > 70))
    return 'Playful'
  return 'Content'
}
