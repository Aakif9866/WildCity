import type { CityData } from '@/cities/types'
import { createCameraRig, type CameraRig } from '@/game/camera/orbitRig'
import type { KeyboardMouseInput } from '@/game/input/KeyboardMouseInput'
import { createPlayer, type PlayerState } from '@/game/player/movement'
import { World } from '@/game/world/World'

/**
 * Everything mutable that changes every frame. Deliberately NOT in Zustand: updating React
 * state 60x/s would re-render the UI for no reason. React only sees coarse events.
 */
export interface GameSession {
  city: CityData
  world: World
  player: PlayerState
  camera: CameraRig
  /** Set by the controller once the canvas exists. */
  input: KeyboardMouseInput | null
}

/** Explicit mutator: session is intentionally mutable game state, not React state. */
export function attachInput(session: GameSession, input: KeyboardMouseInput | null): void {
  session.input = input
}

export function createSession(city: CityData): GameSession {
  const world = new World(city)
  const { x, z, yaw } = city.metadata.spawn
  return {
    city,
    world,
    player: createPlayer(x, z, yaw, world),
    camera: createCameraRig(yaw, x, z),
    input: null,
  }
}
