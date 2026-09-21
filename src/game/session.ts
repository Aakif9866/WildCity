import type { CityData } from '@/cities/types'
import { createCameraRig, type CameraRig } from '@/game/camera/orbitRig'
import type { KeyboardMouseInput } from '@/game/input/KeyboardMouseInput'
import { spawnAnimals } from '@/game/animals/spawn'
import { DEFAULT_SPAWN_PLAN } from '@/game/animals/spawnPlan'
import type { Animal } from '@/game/animals/types'
import type { DayPhase } from '@/game/time/dayPhase'
import { NavGrid } from '@/game/navigation/NavGrid'
import { createPlayer, type PlayerState } from '@/game/player/movement'
import { World } from '@/game/world/World'
import { mulberry32, type Rng } from '@/utils/random'

/**
 * Everything mutable that changes every frame. Deliberately NOT in Zustand: updating React
 * state 60x/s would re-render the UI for no reason. React only sees coarse events.
 */
export interface GameSession {
  city: CityData
  world: World
  nav: NavGrid
  player: PlayerState
  camera: CameraRig
  animals: Animal[]
  rng: Rng
  /** Time of day; a fixed midday until the day/night clock arrives (Phase 9). */
  time: { phase: DayPhase }
  /** Simulation speed multiplier for animals (1 = real time). Handy for tests and profiling. */
  timeScale: number
  /** Set by the controller once the canvas exists. */
  input: KeyboardMouseInput | null
}

/** Explicit mutator: session is intentionally mutable game state, not React state. */
export function attachInput(session: GameSession, input: KeyboardMouseInput | null): void {
  session.input = input
}

export function createSession(city: CityData, seed = 1234): GameSession {
  const world = new World(city)
  const nav = new NavGrid(world)
  const rng = mulberry32(seed)
  const { x, z, yaw } = city.metadata.spawn
  return {
    city,
    world,
    nav,
    player: createPlayer(x, z, yaw, world),
    camera: createCameraRig(yaw, x, z),
    animals: spawnAnimals(DEFAULT_SPAWN_PLAN, world, nav, rng, { x, z }),
    rng,
    time: { phase: 'day' },
    timeScale: 1,
    input: null,
  }
}
