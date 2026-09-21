import type { Vec2 } from '@/cities/types'

export type SpeciesId = 'dog' | 'cat' | 'pigeon' | 'monkey' | 'squirrel'

export type AnimalState =
  | 'IDLE'
  | 'WANDER'
  | 'MOVE_TO_TARGET'
  | 'EAT'
  | 'DRINK'
  | 'REST'
  | 'SLEEP'
  | 'FLEE'
  | 'INVESTIGATE'
  | 'FOLLOW'
  | 'INTERACT'

export type TargetKind = 'food' | 'water' | 'spot' | 'friend' | 'flee'

/** Visual animation the renderer should show; derived from state + speed by the AI layer. */
export type AnimationName = 'idle' | 'walk' | 'run' | 'eat' | 'sleep' | 'fly'

export interface Animal {
  id: string
  species: SpeciesId
  /** Index into the species coat palette. */
  coat: number
  position: { x: number; y: number; z: number }
  /** Facing angle; 0 faces -z (same convention as the player and camera). */
  yaw: number
  /** Current ground speed in m/s. */
  speed: number
  state: AnimalState
  /** Seconds spent in the current state. */
  stateTime: number
  /** 0..100, drains while active, recovers while resting. */
  energy: number
  /** 0..100, grows over time; high = wants food. */
  hunger: number
  // Personality: fixed per individual, drawn from species ranges.
  vigor: number
  curiosity: number
  social: number
  target: Vec2 | null
  /** Why the animal is heading to `target`; decides what happens on arrival. */
  targetKind: TargetKind | null
  path: Vec2[]
  pathIndex: number
  animation: AnimationName
  /** Seconds until the animal may plan again after a failed plan (prevents per-frame A* retries). */
  cooldown: number
}
