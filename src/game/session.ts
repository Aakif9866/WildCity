import type { CityData } from '@/cities/types'
import { createCameraRig, type CameraRig } from '@/game/camera/orbitRig'
import type { KeyboardMouseInput } from '@/game/input/KeyboardMouseInput'
import { spawnAnimals } from '@/game/animals/spawn'
import { DEFAULT_SPAWN_PLAN } from '@/game/animals/spawnPlan'
import type { AIContext } from '@/game/ai/fsm'
import { yawToward } from '@/game/ai/reactions'
import type { Animal } from '@/game/animals/types'
import {
  advanceClock,
  createClock,
  normalizeHour,
  START_HOUR,
  type GameClock,
} from '@/game/time/clock'
import { dayPhaseAt, type DayPhase } from '@/game/time/dayPhase'
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
  /** Time of day. `time.phase` is derived from the clock and read by the animal AI. */
  clock: GameClock
  time: { phase: DayPhase }
  /** What the atmosphere last applied (read by tests and the debug probe). */
  atmosphere: { lightIntensity: number; hemiIntensity: number; sky: string; stars: number }
  /** Simulation speed multiplier for animals (1 = real time). Handy for tests and profiling. */
  timeScale: number
  /** Set by the controller once the canvas exists. */
  input: KeyboardMouseInput | null
}

/** Explicit mutator: session is intentionally mutable game state, not React state. */
export function attachInput(session: GameSession, input: KeyboardMouseInput | null): void {
  session.input = input
}

/** Turn the orbit camera to look from the player towards a point (mutator: session is mutable game state). */
export function aimCameraAt(session: GameSession, x: number, z: number): void {
  session.camera.yaw = yawToward(session.player.x, session.player.z, x, z)
}

/** Everything the animal AI needs to know about the world this frame. */
export function aiContextOf(session: GameSession): AIContext {
  return {
    world: session.world,
    nav: session.nav,
    rng: session.rng,
    time: session.time,
    player: session.player,
    animals: session.animals,
  }
}

/** `?hour=<0-24>` lets a link (or test) start at a chosen time of day. */
export function startHourFromUrl(): number | undefined {
  try {
    const raw = new URLSearchParams(window.location.search).get('hour')
    const h = raw === null ? NaN : Number(raw)
    return Number.isFinite(h) ? normalizeHour(h) : undefined
  } catch {
    return undefined
  }
}

/** Keep the AI-facing phase in step with the clock. */
export function syncTime(session: GameSession): void {
  session.time.phase = dayPhaseAt(session.clock.hour)
}

/** Jump the clock (mutator: session is mutable game state). */
export function setHour(session: GameSession, hour: number): void {
  session.clock.hour = normalizeHour(hour)
  syncTime(session)
}

/** Advance the day/night clock by `dt` real seconds. */
export function tickClock(session: GameSession, dt: number): void {
  advanceClock(session.clock, dt)
  syncTime(session)
}

/** Record what the atmosphere applied this frame (mutator: session is mutable game state). */
export function recordAtmosphere(
  session: GameSession,
  values: { lightIntensity: number; hemiIntensity: number; sky: string; stars: number },
): void {
  Object.assign(session.atmosphere, values)
}

export function createSession(city: CityData, seed = 1234, startHour = START_HOUR): GameSession {
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
    clock: createClock(startHour),
    time: { phase: dayPhaseAt(startHour) },
    atmosphere: { lightIntensity: 0, hemiIntensity: 0, sky: '#000000', stars: 0 },
    timeScale: 1,
    input: null,
  }
}
