import { settleToGround, stepAlongPath, stepFlying } from '@/game/animals/locomotion'
import { preference, SPECIES, zoneCost, type SpeciesConfig } from '@/game/animals/species'
import type { Animal, AnimalState, AnimationName, TargetKind } from '@/game/animals/types'
import type { ZoneKind } from '@/cities/types'
import type { NavGrid } from '@/game/navigation/NavGrid'
import type { DayPhase } from '@/game/time/dayPhase'
import type { World } from '@/game/world/World'
import { pickWeighted, randRange, type Rng } from '@/utils/random'
import { behaviourWeights, type BehaviourKind } from './behaviour'
import { updateNeeds } from './needs'
import { distanceToPlayer, fleeDistance, isThreatened, type PlayerView } from './perception'
import { chooseReaction, standoffDistance, yawToward } from './reactions'
import { angleDelta } from '@/game/player/movement'

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

function planGround(
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
  a.airborne = false
  return true
}

/** Flyers hop on foot for short trips between walkable spots, and fly for everything else. */
function planFlight(
  a: Animal,
  s: SpeciesConfig,
  ctx: AIContext,
  x: number,
  z: number,
  kind: TargetKind,
): boolean {
  const [gx, gz] = ctx.world.clampToBounds(x, z, 3)
  if (ctx.world.zoneAt(gx, gz) === 'WATER') return false
  const onGround = !a.airborne && a.position.y < 0.3
  const shortHop = Math.hypot(gx - a.position.x, gz - a.position.z) < 10
  if (
    onGround &&
    shortHop &&
    ctx.nav.isWalkable(gx, gz) &&
    ctx.nav.isWalkable(a.position.x, a.position.z)
  )
    return planGround(a, s, ctx, gx, gz, kind)
  a.target = [gx, gz]
  a.targetKind = kind
  a.path = [[gx, gz]]
  a.pathIndex = 0
  a.airborne = true
  return true
}

/** Route to (x, z). Returns false if unreachable. */
function planTo(
  a: Animal,
  s: SpeciesConfig,
  ctx: AIContext,
  x: number,
  z: number,
  kind: TargetKind,
): boolean {
  return s.flying ? planFlight(a, s, ctx, x, z, kind) : planGround(a, s, ctx, x, z, kind)
}

/** Move along the current plan on foot or by air. */
function move(a: Animal, s: SpeciesConfig, ctx: AIContext, groundSpeed: number, dt: number) {
  return a.airborne
    ? stepFlying(a, s, s.runSpeed * 0.75, dt, ctx.world)
    : stepAlongPath(a, s, groundSpeed, dt, ctx.world)
}

/** Sample a spot the species can actually reach: any open air for flyers, walkable ground otherwise. */
function pickSpot(
  s: SpeciesConfig,
  ctx: AIContext,
  a: Animal,
  minR: number,
  maxR: number,
  weight: (z: ZoneKind) => number,
  tries?: number,
) {
  const sample = s.flying ? ctx.nav.randomAirSpot.bind(ctx.nav) : ctx.nav.randomSpot.bind(ctx.nav)
  return sample(a.position.x, a.position.z, minR, maxR, ctx.rng, weight, tries)
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
      const spot = pickSpot(
        s,
        ctx,
        a,
        s.wanderRange[0],
        s.wanderRange[1],
        (z) => preference(s, z) + 0.05,
      )
      if (!spot || !planTo(a, s, ctx, spot[0], spot[1], 'spot')) return false
      enterState(a, 'WANDER')
      return true
    }
    case 'goto_zone': {
      const spot = pickSpot(s, ctx, a, 20, 70, (z) => preference(s, z) ** 3, 20)
      if (!spot || !planTo(a, s, ctx, spot[0], spot[1], 'spot')) return false
      enterState(a, 'MOVE_TO_TARGET')
      return true
    }
    case 'food': {
      const spot = pickSpot(s, ctx, a, 8, 70, (z) => (s.foodZones.includes(z) ? 1 : 0.02), 24)
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

export function startFlee(a: Animal, s: SpeciesConfig, ctx: AIContext): void {
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
  // Notice the player: turn to look at them while they are close by.
  if (
    ctx.player &&
    s.reaction.style !== 'ignore' &&
    distanceToPlayer(a, ctx.player) < s.reaction.detectionRadius * 0.6
  )
    facePlayer(a, s, ctx, dt)
  // Livelier individuals spend less time standing around.
  const wait = (1.5 + (1 - a.vigor / 100) * 4) * s.idleScale
  if (a.stateTime > wait && a.cooldown <= 0) decide(a, s, ctx)
}

const walking: Handler = (a, s, ctx, dt) => {
  if (a.energy < 8) {
    clearPlan(a)
    enterState(a, 'REST')
    return
  }
  const hurry = a.targetKind === 'food' && a.hunger > 75 ? 1.3 : 1
  if (move(a, s, ctx, s.walkSpeed * hurry, dt) !== 'arrived') return

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

// Animals nap in bouts: even a species that is inactive all day (cats) wakes now and then
// instead of being frozen for hours.
const NAP_LIMIT = 60

const sleep: Handler = (a, s, ctx, dt) => {
  stop(a, dt)
  const act = s.activity[ctx.time.phase]
  const rested = a.energy > 50
  if (a.stateTime > 10 && rested && (act >= 0.5 || a.stateTime > NAP_LIMIT)) enterState(a, 'IDLE')
}

const flee: Handler = (a, s, ctx, dt) => {
  if (move(a, s, ctx, s.runSpeed, dt) === 'arrived' || a.stateTime > 12) {
    const p = ctx.player
    clearPlan(a)
    // Still too close? Keep running; otherwise calm down.
    if (p && distanceToPlayer(a, p) < fleeDistance(a, s, p) * 1.4) startFlee(a, s, ctx)
    if (a.state === 'FLEE' && a.path.length === 0) enterState(a, 'IDLE')
  }
}

/** Turn in place to face the player (looking at them). */
function facePlayer(a: Animal, s: SpeciesConfig, ctx: AIContext, dt: number): void {
  const p = ctx.player
  if (!p) return
  const want = yawToward(a.position.x, a.position.z, p.x, p.z)
  const maxTurn = s.turnRate * dt
  a.yaw += Math.max(-maxTurn, Math.min(maxTurn, angleDelta(a.yaw, want)))
}

const ATTENTION_AFTER = { investigate: 25, follow: 40, interact: 20 }

/** Plan a route to a point `standoff` metres from the player, on the animal's side. */
function planToPlayer(a: Animal, s: SpeciesConfig, ctx: AIContext, standoff: number): boolean {
  const p = ctx.player
  if (!p) return false
  const dx = a.position.x - p.x
  const dz = a.position.z - p.z
  const d = Math.hypot(dx, dz) || 1
  return planTo(a, s, ctx, p.x + (dx / d) * standoff, p.z + (dz / d) * standoff, 'player')
}

function startReaction(
  kind: 'follow' | 'investigate',
  a: Animal,
  s: SpeciesConfig,
  ctx: AIContext,
): boolean {
  if (!planToPlayer(a, s, ctx, kind === 'follow' ? 3 : standoffDistance(a, s))) return false
  enterState(a, kind === 'follow' ? 'FOLLOW' : 'INVESTIGATE')
  return true
}

const investigate: Handler = (a, s, ctx, dt) => {
  const p = ctx.player
  const done = (): void => {
    clearPlan(a)
    a.attention = ATTENTION_AFTER.investigate
    enterState(a, 'IDLE')
  }
  if (!p || a.stateTime > 25) return done()
  if (a.path.length > 0) {
    // Player walked off? Re-aim, but not every frame.
    if (
      a.target &&
      Math.hypot(a.target[0] - p.x, a.target[1] - p.z) > standoffDistance(a, s) + 5 &&
      a.cooldown <= 0
    ) {
      if (!planToPlayer(a, s, ctx, standoffDistance(a, s))) return done()
      a.cooldown = 1
    }
    if (move(a, s, ctx, s.walkSpeed * 1.15, dt) === 'arrived') {
      clearPlan(a)
      a.stateTime = 0 // start the "looking at you" timer
    }
    return
  }
  stop(a, dt)
  facePlayer(a, s, ctx, dt)
  if (a.stateTime > 4 + a.curiosity / 25) done()
}

/** Match the player's pace, and hurry in proportion to how far behind we've fallen. */
const followSpeed = (s: SpeciesConfig, playerSpeed: number, gap: number): number =>
  Math.min(s.runSpeed, Math.max(s.walkSpeed * 1.25, playerSpeed * 1.1 + Math.max(0, gap - 4) * 0.6))

const follow: Handler = (a, s, ctx, dt) => {
  const p = ctx.player
  if (!p || a.stateTime > 40 || distanceToPlayer(a, p) > 30 || a.energy < 15) {
    clearPlan(a)
    a.attention = ATTENTION_AFTER.follow
    enterState(a, 'IDLE')
    return
  }
  const d = distanceToPlayer(a, p)
  if (d > 3.6) {
    if ((a.path.length === 0 || a.cooldown <= 0) && planToPlayer(a, s, ctx, 3)) a.cooldown = 0.8
    if (a.path.length > 0) move(a, s, ctx, followSpeed(s, p.speed, d), dt)
  } else {
    clearPlan(a)
    stop(a, dt)
    facePlayer(a, s, ctx, dt)
  }
}

const interact: Handler = (a, s, ctx, dt) => {
  stop(a, dt)
  facePlayer(a, s, ctx, dt)
  if (a.stateTime > 4.5) {
    a.attention = ATTENTION_AFTER.interact
    enterState(a, 'IDLE')
  }
}

export interface InteractionResult {
  accepted: boolean
  message: string
}

const ACCEPT_LINES: Record<string, string> = {
  dog: 'Wags its tail and leans in for attention.',
  cat: 'Sniffs your hand, then allows a scratch.',
  pigeon: 'Coos softly and pecks near your feet.',
  monkey: 'Chatters curiously and inspects your hands.',
  squirrel: 'Freezes, tail twitching, and lets you watch it.',
}

/**
 * The player reaches out to an animal. Trusting (curious + sociable) individuals accept;
 * shy ones retreat. Sleeping or already-frightened animals are left alone.
 */
export function interactWithAnimal(a: Animal, ctx: AIContext): InteractionResult {
  const s = SPECIES[a.species]
  if (a.state === 'SLEEP')
    return { accepted: false, message: 'It is fast asleep. Better not disturb it.' }
  if (a.state === 'FLEE') return { accepted: false, message: 'It is too frightened to come near.' }
  const trust = (a.curiosity + a.social) / 200
  if (ctx.rng() < 0.25 + 0.75 * trust) {
    clearPlan(a)
    enterState(a, 'INTERACT')
    return { accepted: true, message: ACCEPT_LINES[a.species] ?? 'It accepts your company.' }
  }
  startFlee(a, s, ctx)
  return { accepted: false, message: 'It does not trust you yet and backs away.' }
}

const HANDLERS: Partial<Record<AnimalState, Handler>> = {
  IDLE: idle,
  WANDER: walking,
  MOVE_TO_TARGET: walking,
  EAT: eat,
  DRINK: drink,
  REST: rest,
  SLEEP: sleep,
  FLEE: flee,
  INVESTIGATE: investigate,
  FOLLOW: follow,
  INTERACT: interact,
}

function animationFor(a: Animal): AnimationName {
  if (a.airborne) return 'fly'
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
  a.attention -= dt
  updateNeeds(a, s, dt)
  // A flight cut short by a state change (e.g. sudden exhaustion) must still end on the ground.
  if (a.airborne && a.path.length === 0) settleToGround(a, dt, ctx.world)

  if (a.state !== 'FLEE' && a.cooldown <= 0 && isThreatened(a, s, ctx.player)) startFlee(a, s, ctx)
  if (a.attention <= 0 && ctx.player && (a.state === 'IDLE' || a.state === 'WANDER')) {
    const reaction = chooseReaction(a, s, ctx.player, ctx.rng)
    // Not interested (or no route): look again soon rather than every frame.
    if (!reaction || !startReaction(reaction, a, s, ctx)) a.attention = 4
  }
  ;(HANDLERS[a.state] ?? idle)(a, s, ctx, dt)
  a.animation = animationFor(a)
}
