import { SPECIES, zoneCost, preference, type SpeciesConfig } from '@/game/animals/species'
import { stepAlongPath } from '@/game/animals/locomotion'
import type { Animal, AnimalState, AnimationName } from '@/game/animals/types'
import type { NavGrid } from '@/game/navigation/NavGrid'
import type { World } from '@/game/world/World'
import type { Rng } from '@/utils/random'

export interface AIContext {
  world: World
  nav: NavGrid
  rng: Rng
}

type Handler = (a: Animal, s: SpeciesConfig, ctx: AIContext, dt: number) => void

export function enterState(a: Animal, state: AnimalState): void {
  a.state = state
  a.stateTime = 0
}

function planWander(a: Animal, s: SpeciesConfig, ctx: AIContext): boolean {
  const spot = ctx.nav.randomSpot(
    a.position.x,
    a.position.z,
    6,
    30,
    ctx.rng,
    (z) => preference(s, z) + 0.05,
  )
  if (!spot) return false
  const path = ctx.nav.findPath(a.position.x, a.position.z, spot[0], spot[1], zoneCost(s))
  if (!path) return false
  a.target = spot
  a.path = path
  a.pathIndex = 0
  return true
}

const idle: Handler = (a, s, ctx, dt) => {
  a.speed += (0 - a.speed) * (1 - Math.exp(-8 * dt))
  // Livelier individuals spend less time standing around.
  const wait = 1.5 + (1 - a.vigor / 100) * 4
  if (a.stateTime > wait && planWander(a, s, ctx)) enterState(a, 'WANDER')
  else if (a.stateTime > wait) a.stateTime = 0 // no route found; try again shortly
}

const wander: Handler = (a, s, ctx, dt) => {
  if (stepAlongPath(a, s, s.walkSpeed, dt, ctx.world) === 'arrived') {
    a.target = null
    a.path = []
    enterState(a, 'IDLE')
  }
}

// States without behaviour yet (added in Phase 4) fall back to idling so nothing can get stuck.
const HANDLERS: Partial<Record<AnimalState, Handler>> = { IDLE: idle, WANDER: wander }

function animationFor(a: Animal): AnimationName {
  if (a.speed > 3) return 'run'
  if (a.speed > 0.25) return 'walk'
  return 'idle'
}

export function updateAnimal(a: Animal, ctx: AIContext, dt: number): void {
  const s = SPECIES[a.species as keyof typeof SPECIES]
  if (!s) return
  a.stateTime += dt
  ;(HANDLERS[a.state] ?? idle)(a, s, ctx, dt)
  a.animation = animationFor(a)
}
