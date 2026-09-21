import type { Animal, AnimalState } from '@/game/animals/types'

/** How close the player must be to inspect an animal with E. */
export const INTERACT_RANGE = 5
/** The inspect panel closes if the player wanders this far from the animal. */
export const PANEL_CLOSE_RANGE = 16

/** Nearest animal within `range` metres (horizontal distance), or null. */
export function nearestAnimal(
  animals: readonly Animal[],
  x: number,
  z: number,
  range = INTERACT_RANGE,
): Animal | null {
  let best: Animal | null = null
  let bestD = range
  for (const a of animals) {
    const d = Math.hypot(a.position.x - x, a.position.z - z)
    if (d < bestD) {
      bestD = d
      best = a
    }
  }
  return best
}

const STATE_LABEL: Record<AnimalState, string> = {
  IDLE: 'Idle',
  WANDER: 'Wandering',
  MOVE_TO_TARGET: 'Heading somewhere',
  EAT: 'Eating',
  DRINK: 'Drinking',
  REST: 'Resting',
  SLEEP: 'Sleeping',
  FLEE: 'Fleeing',
  INVESTIGATE: 'Investigating',
  FOLLOW: 'Following you',
  INTERACT: 'Interacting',
}

export const describeState = (a: Animal): string => (a.airborne ? 'Flying' : STATE_LABEL[a.state])
