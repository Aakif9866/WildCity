import type { SpeciesConfig } from '@/game/animals/species'
import type { Animal } from '@/game/animals/types'
import type { Rng } from '@/utils/random'
import { distanceToPlayer, fleeDistance, isThreatened, type PlayerView } from './perception'

export type Reaction = 'follow' | 'investigate'

/**
 * Decide whether an animal that has noticed the player does something about it. Sociable dogs
 * tend to tag along, curious cats/monkeys come to look, and "ignore" species never do.
 */
export function chooseReaction(
  a: Animal,
  s: SpeciesConfig,
  player: PlayerView,
  rng: Rng,
): Reaction | null {
  const { style, detectionRadius } = s.reaction
  if (style === 'ignore') return null
  if (distanceToPlayer(a, player) > detectionRadius) return null
  if (isThreatened(a, s, player)) return null
  const p = style === 'follow' ? (a.social / 100) * 0.8 : (a.curiosity / 100) * 0.7
  return rng() < p ? style : null
}

/**
 * How close this animal is willing to come. Wary individuals keep further away: never inside
 * the distance that would spook them.
 */
export function standoffDistance(a: Animal, s: SpeciesConfig): number {
  return Math.max(2.5, fleeDistance(a, s, { x: 0, z: 0, speed: 1 }) * 1.3 + 1)
}

/** Yaw (0 = -z) that faces from (fx, fz) towards (tx, tz). */
export const yawToward = (fx: number, fz: number, tx: number, tz: number): number =>
  Math.atan2(-(tx - fx), -(tz - fz))
