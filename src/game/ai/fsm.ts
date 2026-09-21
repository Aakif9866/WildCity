import { stepAlongPath } from '@/game/animals/locomotion'
import { preference, SPECIES, zoneCost, type SpeciesConfig } from '@/game/animals/species'
import type { Animal, AnimalState, AnimationName, TargetKind } from '@/game/animals/types'
import type { NavGrid } from '@/game/navigation/NavGrid'
import type { DayPhase } from '@/game/time/dayPhase'
import type { World } from '@/game/world/World'
import { pickWeighted, randRange, type Rng } from '@/utils/random'
import { behaviourWeights, type BehaviourKind } from './behaviour'
import { updateNeeds } from './needs'
import { distanceToPlayer, fleeDistance, isThreatened, type PlayerView } from './perception'

export interface AIContext {
  world: World
  nav: NavGrid
  rng: Rng
  time: { phase: DayPhase }
  player: PlayerView | null
  /** All animals, for social behaviour. */
  animals: readonly Animal[]
}

type Handler = (a: Animal, s: SpeciesConfig, ctx: AIContext, dt: number) => void

export function enterState(a: Animal, state: AnimalState): void {
  a.state = state
  a.stateTime = 0
}

const stop = (a: Animal, dt: number): void => {
  a.speed += (0 - a.speed) * (1 - Math.exp(-8 * dt))
}

function clearPlan(a: Animal): void {
  a.target = null
  a.targetKind = null
  a.path = []
  a.pathIndex = 0
}

/** Route to (x, z), snapping to the nearest walkable cell. Returns false if unreachable. */
function planTo(
  a: Animal,
  s: SpeciesConfig,
  ctx: AIContext,
  x: number,
  z: number,
  kind: TargetKind,
): boolean {
  const goal = ctx.nav.nearestWalkable(x, z, 8)
  if (!goal) return false
  const path = ctx.nav.findPath(a.position.x, a.position.z, goal[0], goal[1], zoneCost(s))
  if (!path) return false
  a.target = goal
  a.targetKind = kind
  a.path = path
  a.pathIndex = 0
  return true
}

const NEAR_WATER = 4

/** Try to start a behaviour. Returns false if it couldn't be set up (no spot / no route). */
export function startBehaviour(
  kind: BehaviourKind,
  a: Animal,
  s: SpeciesConfig,
  ctx: AIContext,
): boolean {
  const { nav, rng } = ctx
  const px = a.position.x
  const pz = a.position.z
  switch (kind) {
    case 'idle':
      enterState(a, 'IDLE')
      return true
    case 'rest':
      clearPlan(a)
      enterState(a, 'REST')
      return true
    case 'sleep':
      clearPlan(a)
      enterState(a, 'SLEEP')
      return true
    case 'wander': {
      const spot = nav.randomSpot(px, pz, 6, 30, rng, (z) => preference(s, z) + 0.05)
      if (!spot || !planTo(a, s, ctx, spot[0], spot[1], 'spot')) return false
      enterState(a, 'WANDER')
      return true
    }
    case 'goto_zone': {
      const spot = nav.randomSpot(px, pz, 20, 70, rng, (z) => preference(s, z) ** 3, 20)
      if (!spot || !planTo(a, s, ctx, spot[0], spot[1], 'spot')) return false
      enterState(a, 'MOVE_TO_TARGET')
      return true
    }
    case 'food': {
      const spot = nav.randomSpot(
        px,
        pz,
        8,
        70,
        rng,
        (z) => (s.foodZones.includes(z) ? 1 : 0.02),
        24,
      )
      if (!spot || !planTo(a, s, ctx, spot[0], spot[1], 'food')) return false
      enterState(a, 'MOVE_TO_TARGET')
      return true
    }
    case 'water': {
      const spot = nav.randomSpotWhere(
        px,
        pz,
        8,
        80,
        rng,
        (x, z) => nav.directionToZone(x, z, 'WATER', NEAR_WATER) !== null,
        200, // the shore is a thin ring, so it takes many samples to land on it
      )
      if (!spot || !planTo(a, s, ctx, spot[0], spot[1], 'water')) return false
      enterState(a, 'MOVE_TO_TARGET')
      return true
    }
    case 'friend': {
      const friend = nearestFriend(a, ctx, 60)
      if (!friend) return false
      const off = randRange(rng, 1.5, 3.5)
      const ang = rng() * Math.PI * 2
      if (
        !planTo(
          a,
          s,
          ctx,
          friend.position.x + Math.cos(ang) * off,
          friend.position.z + Math.sin(ang) * off,
          'friend',
        )
      )
        return false
      enterState(a, 'MOVE_TO_TARGET')
      return true
    }
  }
}

function nearestFriend(a: Animal, ctx: AIContext, radius: number): Animal | null {
  let best: Animal | null = null
  let bestD = radius
  for (const o of ctx.animals) {
    if (o === a || o.species !== a.species) continue
    const d = Math.hypot(o.position.x - a.position.x, o.position.z - a.position.z)
    if (d < bestD) {
      bestD = d
      best = o
    }
  }
  return best
}

/** Pick what to do next: hard needs override, otherwise personality/needs/time-weighted choice. */
export function decide(a: Animal, s: SpeciesConfig, ctx: AIContext): void {
  const forced: BehaviourKind | null = a.energy < 10 ? 'rest' : a.hunger > 85 ? 'food' : null
  if (forced && startBehaviour(forced, a, s, ctx)) return

  const w = behaviourWeights(a, s, {
    phase: ctx.time.phase,
    waterNearby:
      s.waterAffinity > 0 &&
      ctx.nav.directionToZone(a.position.x, a.position.z, 'WATER', 60) !== null,
    friendNearby: nearestFriend(a, ctx, 50) !== null,
  })
  const kinds = Object.keys(w) as BehaviourKind[]
  // A behaviour that can't be set up (no route) is dropped and we try the next best, then idle.
  const remaining = [...kinds]
  for (let tries = 0; tries < 3 && remaining.length > 0; tries++) {
    const pick = pickWeighted(ctx.rng, remaining, (k) => w[k])
    if (!pick) break
    if (startBehaviour(pick, a, s, ctx)) return
    remaining.splice(remaining.indexOf(pick), 1)
  }
  enterState(a, 'IDLE')
  a.cooldown = 1
}

function startFlee(a: Animal, s: SpeciesConfig, ctx: AIContext): void {
  const player = ctx.player
  if (!player) return
  const away = Math.atan2(a.position.z - player.z, a.position.x - player.x)
  for (const jitter of [0, 0.7, -0.7, 1.4, -1.4]) {
    const ang = away + jitter
    const dist = randRange(ctx.rng, 14, 22)
    if (
      planTo(
        a,
        s,
        ctx,
        a.position.x + Math.cos(ang) * dist,
        a.position.z + Math.sin(ang) * dist,
        'flee',
      )
    ) {
      enterState(a, 'FLEE')
      return
    }
  }
  a.cooldown = 0.6 // cornered: don't retry A* every frame
}

const idle: Handler = (a, s, ctx, dt) => {
  stop(a, dt)
  // Livelier individuals spend less time standing around.
  const wait = 1.5 + (1 - a.vigor / 100) * 4
  if (a.stateTime > wait && a.cooldown <= 0) decide(a, s, ctx)
}

const walking: Handler = (a, s, ctx, dt) => {
  if (a.energy < 8) {
    clearPlan(a)
    enterState(a, 'REST')
    return
  }
  const hurry = a.targetKind === 'food' && a.hunger > 75 ? 1.3 : 1
  if (stepAlongPath(a, s, s.walkSpeed * hurry, dt, ctx.world) !== 'arrived') return

  const kind = a.targetKind
  clearPlan(a)
  if (kind === 'food') enterState(a, 'EAT')
  else if (kind === 'water') {
    const dir = ctx.nav.directionToZone(a.position.x, a.position.z, 'WATER', NEAR_WATER + 2)
    if (dir !== null) a.yaw = dir
    enterState(a, 'DRINK')
  } else enterState(a, 'IDLE')
}

const eat: Handler = (a, _s, _ctx, dt) => {
  stop(a, dt)
  if (a.stateTime > 4 && (a.hunger < 8 || a.stateTime > 9)) enterState(a, 'IDLE')
}

const drink: Handler = (a, _s, _ctx, dt) => {
  stop(a, dt)
  if (a.stateTime > 4) enterState(a, 'IDLE')
}

const rest: Handler = (a, _s, _ctx, dt) => {
  stop(a, dt)
  if (a.energy >= 75 || a.stateTime > 30) enterState(a, 'IDLE')
}

const sleep: Handler = (a, s, ctx, dt) => {
  stop(a, dt)
  const act = s.activity[ctx.time.phase]
  if (a.stateTime > 10 && act >= 0.5 && a.energy > 50) enterState(a, 'IDLE')
}

const flee: Handler = (a, s, ctx, dt) => {
  if (stepAlongPath(a, s, s.runSpeed, dt, ctx.world) === 'arrived' || a.stateTime > 12) {
    const p = ctx.player
    clearPlan(a)
    // Still too close? Keep running; otherwise calm down.
    if (p && distanceToPlayer(a, p) < fleeDistance(a, s, p) * 1.4) startFlee(a, s, ctx)
    if (a.state === 'FLEE' && a.path.length === 0) enterState(a, 'IDLE')
  }
}

// INVESTIGATE / FOLLOW / INTERACT arrive with player interaction (Phase 6); until then they idle.
const HANDLERS: Partial<Record<AnimalState, Handler>> = {
  IDLE: idle,
  WANDER: walking,
  MOVE_TO_TARGET: walking,
  EAT: eat,
  DRINK: drink,
  REST: rest,
  SLEEP: sleep,
  FLEE: flee,
}

function animationFor(a: Animal): AnimationName {
  if (a.state === 'EAT' || a.state === 'DRINK') return 'eat'
  if (a.state === 'SLEEP') return 'sleep'
  if (a.speed > 3) return 'run'
  if (a.speed > 0.25) return 'walk'
  return 'idle'
}

export function updateAnimal(a: Animal, ctx: AIContext, dt: number): void {
  const s = SPECIES[a.species as keyof typeof SPECIES]
  if (!s) return
  a.stateTime += dt
  a.cooldown = Math.max(0, a.cooldown - dt)
  updateNeeds(a, s, dt)

  if (a.state !== 'FLEE' && a.cooldown <= 0 && isThreatened(a, s, ctx.player)) startFlee(a, s, ctx)
  if (a.state !== 'FLEE' || a.path.length > 0 || a.stateTime > 0)
    (HANDLERS[a.state] ?? idle)(a, s, ctx, dt)
  a.animation = animationFor(a)
}
