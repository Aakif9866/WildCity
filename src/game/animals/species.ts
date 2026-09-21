import type { ZoneKind } from '@/cities/types'
import type { DayPhase } from '@/game/time/dayPhase'
import { parseRig, type CoatPalette, type RigDef } from './rig'
import catRig from './rigs/cat.json'
import dogRig from './rigs/dog.json'
import monkeyRig from './rigs/monkey.json'
import pigeonRig from './rigs/pigeon.json'
import squirrelRig from './rigs/squirrel.json'
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
  /** Flying species travel in straight lines above obstacles instead of using ground navigation. */
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
  /** [min, max] metres of a typical wander hop: squirrels dart, monkeys roam. */
  wanderRange: [number, number]
  /** Multiplier on standing-around time: cats loaf, squirrels fidget. */
  idleScale: number
  /** Scales the procedural stride so small animals don't swing huge legs. */
  strideScale: number
  rig: RigDef
  /** Optional GLB. If it is missing or fails to load, the procedural rig is used. */
  modelUrl?: string
}

export const DEFAULT_PREFERENCE = 0.15

const dog = parseRig(dogRig)
const cat = parseRig(catRig)
const pigeon = parseRig(pigeonRig)
const monkey = parseRig(monkeyRig)
const squirrel = parseRig(squirrelRig)

export const SPECIES: Record<SpeciesId, SpeciesConfig> = {
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
    coats: dog.coats,
    needs: { hungerPerSec: 0.3, energyWalk: 0.18, energyRun: 1.1, restRegen: 2.2 },
    awareness: { fleeRadius: 3 },
    activity: { morning: 0.8, day: 1, evening: 0.7, night: 0.15 },
    foodZones: ['COMMERCIAL', 'SIDEWALK', 'RESIDENTIAL'],
    waterAffinity: 0.5,
    wanderRange: [6, 30],
    idleScale: 1,
    strideScale: 1,
    rig: dog,
    modelUrl: '/models/dog.glb',
  },
  cat: {
    id: 'cat',
    name: 'Cat',
    walkSpeed: 1.3,
    runSpeed: 6,
    radius: 0.25,
    turnRate: 9,
    flying: false,
    personality: { vigor: [30, 80], curiosity: [50, 95], social: [5, 40] },
    zonePreference: {
      RESIDENTIAL: 1,
      SIDEWALK: 0.6,
      TREE: 0.5,
      PARK: 0.4,
      COMMERCIAL: 0.4,
      ROAD: 0.05,
    },
    coats: cat.coats,
    needs: { hungerPerSec: 0.22, energyWalk: 0.14, energyRun: 1.2, restRegen: 2.0 },
    awareness: { fleeRadius: 6 },
    // Crepuscular: quiet in the heat of the day, busiest from evening through night.
    activity: { morning: 0.5, day: 0.25, evening: 0.9, night: 1 },
    foodZones: ['RESIDENTIAL', 'COMMERCIAL'],
    waterAffinity: 0.2,
    wanderRange: [4, 20],
    idleScale: 1.8,
    strideScale: 0.7,
    rig: cat,
  },
  pigeon: {
    id: 'pigeon',
    name: 'Pigeon',
    walkSpeed: 0.9,
    runSpeed: 6.5,
    radius: 0.15,
    turnRate: 10,
    flying: true,
    personality: { vigor: [40, 90], curiosity: [30, 70], social: [60, 95] },
    zonePreference: {
      BUILDING: 1,
      ROAD: 0.8,
      SIDEWALK: 0.7,
      COMMERCIAL: 0.6,
      PARK: 0.4,
      RESIDENTIAL: 0.4,
    },
    coats: pigeon.coats,
    needs: { hungerPerSec: 0.35, energyWalk: 0.1, energyRun: 0.5, restRegen: 2.5 },
    awareness: { fleeRadius: 7 },
    activity: { morning: 1, day: 0.7, evening: 0.5, night: 0.05 },
    foodZones: ['ROAD', 'SIDEWALK', 'COMMERCIAL'],
    waterAffinity: 0.4,
    wanderRange: [3, 25],
    idleScale: 0.8,
    strideScale: 0.35,
    rig: pigeon,
  },
  monkey: {
    id: 'monkey',
    name: 'Monkey',
    walkSpeed: 1.8,
    runSpeed: 5.5,
    radius: 0.3,
    turnRate: 8,
    flying: false,
    personality: { vigor: [50, 95], curiosity: [60, 100], social: [50, 90] },
    zonePreference: {
      TREE: 1,
      PARK: 0.8,
      RESIDENTIAL: 0.5,
      COMMERCIAL: 0.35,
      SIDEWALK: 0.3,
      ROAD: 0.1,
    },
    coats: monkey.coats,
    needs: { hungerPerSec: 0.35, energyWalk: 0.16, energyRun: 1.0, restRegen: 2.0 },
    awareness: { fleeRadius: 5 },
    activity: { morning: 0.8, day: 1, evening: 0.5, night: 0.05 },
    foodZones: ['TREE', 'PARK', 'COMMERCIAL'],
    waterAffinity: 0.4,
    wanderRange: [8, 35],
    idleScale: 0.8,
    strideScale: 1,
    rig: monkey,
  },
  squirrel: {
    id: 'squirrel',
    name: 'Squirrel',
    walkSpeed: 2,
    runSpeed: 6.5,
    radius: 0.15,
    turnRate: 12,
    flying: false,
    personality: { vigor: [60, 100], curiosity: [40, 80], social: [10, 50] },
    zonePreference: { TREE: 1, PARK: 0.8, RESIDENTIAL: 0.3, SIDEWALK: 0.2, ROAD: 0.05 },
    coats: squirrel.coats,
    needs: { hungerPerSec: 0.4, energyWalk: 0.12, energyRun: 0.9, restRegen: 2.4 },
    awareness: { fleeRadius: 8 },
    activity: { morning: 1, day: 0.8, evening: 0.6, night: 0.05 },
    foodZones: ['TREE', 'PARK'],
    waterAffinity: 0.2,
    wanderRange: [3, 12],
    idleScale: 0.4,
    strideScale: 0.35,
    rig: squirrel,
  },
}

export const preference = (s: SpeciesConfig, zone: ZoneKind): number =>
  s.zonePreference[zone] ?? DEFAULT_PREFERENCE

/** Route cost multiplier: 1 in a favourite zone, up to ~3 in one the species dislikes. */
export const zoneCost =
  (s: SpeciesConfig) =>
  (zone: ZoneKind): number =>
    1 + 2 * (1 - preference(s, zone))
