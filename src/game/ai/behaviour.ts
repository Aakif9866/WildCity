import type { SpeciesConfig } from '@/game/animals/species'
import type { Animal } from '@/game/animals/types'
import type { DayPhase } from '@/game/time/dayPhase'
import { clamp } from '@/utils/math'

export type BehaviourKind =
  'idle' | 'wander' | 'goto_zone' | 'food' | 'water' | 'rest' | 'sleep' | 'friend'

export interface BehaviourSituation {
  phase: DayPhase
  /** True if water is reachable nearby. */
  waterNearby: boolean
  /** True if another animal of the same species is nearby. */
  friendNearby: boolean
}

const smooth = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/**
 * Relative desirability of each behaviour for this individual right now. Pure and side-effect
 * free so tests can assert that personality, needs and time of day actually change behaviour.
 */
export function behaviourWeights(
  a: Animal,
  s: SpeciesConfig,
  sit: BehaviourSituation,
): Record<BehaviourKind, number> {
  const act = s.activity[sit.phase]
  const vigor = a.vigor / 100
  const tired = smooth(60, 15, a.energy) // 0 when rested -> 1 when exhausted
  const hungry = smooth(35, 70, a.hunger)

  return {
    wander: (0.25 + vigor) * act * (1 - tired * 0.8),
    idle: (1.3 - vigor) * (1.2 - act * 0.5),
    goto_zone: (0.15 + a.curiosity / 100) * act * (1 - tired * 0.8),
    friend: sit.friendNearby ? (a.social / 100) * act : 0,
    food: hungry * 4,
    water: sit.waterNearby ? 0.25 * s.waterAffinity * act : 0,
    rest: 0.05 + tired * 3,
    // Only really sleeps when the species is inactive in this phase of the day.
    sleep: act < 0.3 ? (0.3 - act) * 12 * (0.4 + (1 - a.energy / 100)) : 0,
  }
}
