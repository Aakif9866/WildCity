import { clamp } from '@/utils/math'
import type { SpeciesConfig } from '@/game/animals/species'
import type { Animal } from '@/game/animals/types'

export interface PlayerView {
  x: number
  z: number
  speed: number
}

/** Bold, curious, social individuals tolerate people; shy ones bolt early. 0.3 .. 1.3 */
export const boldness = (a: Animal): number => clamp(1.3 - (a.curiosity + a.social) / 200, 0.3, 1.3)

/**
 * Distance at which the player scares this animal right now. A running player is more
 * threatening than a slow one; sleeping animals are harder to spook.
 */
export function fleeDistance(a: Animal, s: SpeciesConfig, player: PlayerView): number {
  const motion = player.speed > 6 ? 1.8 : player.speed > 0.5 ? 1 : 0.6
  const sleepy = a.state === 'SLEEP' ? 0.6 : 1
  return s.awareness.fleeRadius * boldness(a) * motion * sleepy
}

export const distanceToPlayer = (a: Animal, player: PlayerView): number =>
  Math.hypot(a.position.x - player.x, a.position.z - player.z)

export const isThreatened = (a: Animal, s: SpeciesConfig, player: PlayerView | null): boolean =>
  player !== null && distanceToPlayer(a, player) < fleeDistance(a, s, player)
