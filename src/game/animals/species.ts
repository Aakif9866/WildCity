import type { ZoneKind } from '@/cities/types'
import type { DayPhase } from '@/game/time/dayPhase'
import { parseRig, type CoatPalette, type RigDef } from './rig'
import dogRig from './rigs/dog.json'
import type { SpeciesId } from './types'

export interface SpeciesConfig {
  id: SpeciesId
  name: string
  walkSpeed: number
  runSpeed: number
  /** Collision radius in metres. */
  radius: number
  /** Radians/second the animal can turn. */
  turnRate: number
  /** Flying species ignore ground navigation (Phase 5). */
  flying: boolean
  /** Inclusive [min, max] ranges each individual's personality is drawn from (0..100). */
  personality: { vigor: [number, number]; curiosity: [number, number]; social: [number, number] }
  /** How much this species likes each zone, 0..1. Missing zones default to DEFAULT_PREFERENCE. */
  zonePreference: Partial<Record<ZoneKind, number>>
  /** Convenience alias of rig.coats. */
  coats: CoatPalette[]
  needs: {
    /** Hunger points gained per second (0..100 scale). */
    hungerPerSec: number
    /** Energy points lost per second while walking / running. */
    energyWalk: number
    energyRun: number
    /** Energy points regained per second while resting (sleeping is 1.5x). */
    restRegen: number
  }
  awareness: {
    /** Base distance at which a walking player scares this species (before personality). */
    fleeRadius: number
  }
  /** How active the species is in each phase of the day, 0..1. Low values make it sleep. */
  activity: Record<DayPhase, number>
  /** Zones where this species finds food. */
  foodZones: ZoneKind[]
  /** 0..1: how much it likes visiting water. */
  waterAffinity: number
  rig: RigDef
  /** Optional GLB. If it is missing or fails to load, the procedural rig is used. */
  modelUrl?: string
}

export const DEFAULT_PREFERENCE = 0.15

const dogParsed = parseRig(dogRig)

export const SPECIES: Record<'dog', SpeciesConfig> = {
  dog: {
    id: 'dog',
    name: 'Dog',
    walkSpeed: 1.6,
    runSpeed: 5.5,
    radius: 0.35,
    turnRate: 7,
    flying: false,
    personality: { vigor: [40, 90], curiosity: [30, 85], social: [50, 95] },
    zonePreference: {
      PARK: 1,
      TREE: 0.8,
      SIDEWALK: 0.6,
      RESIDENTIAL: 0.5,
      COMMERCIAL: 0.3,
      ROAD: 0.1,
    },
    coats: dogParsed.coats,
    needs: { hungerPerSec: 0.3, energyWalk: 0.18, energyRun: 1.1, restRegen: 2.2 },
    awareness: { fleeRadius: 3 },
    activity: { morning: 0.8, day: 1, evening: 0.7, night: 0.15 },
    foodZones: ['COMMERCIAL', 'SIDEWALK', 'RESIDENTIAL'],
    waterAffinity: 0.5,
    rig: dogParsed,
    modelUrl: '/models/dog.glb',
  },
}

export const preference = (s: SpeciesConfig, zone: ZoneKind): number =>
  s.zonePreference[zone] ?? DEFAULT_PREFERENCE

/** Route cost multiplier: 1 in a favourite zone, up to ~3 in one the species dislikes. */
export const zoneCost =
  (s: SpeciesConfig) =>
  (zone: ZoneKind): number =>
    1 + 2 * (1 - preference(s, zone))
