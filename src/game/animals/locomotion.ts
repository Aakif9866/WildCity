import { angleDelta } from '@/game/player/movement'
import type { World } from '@/game/world/World'
import type { SpeciesConfig } from './species'
import type { Animal } from './types'

export type MoveResult = 'moving' | 'arrived'

/**
 * Walk an animal along its current path. Speed eases in/out and drops in sharp turns so
 * movement looks organic. Collision resolution is a safety net; the nav grid already keeps
 * paths clear of walls.
 */
export function stepAlongPath(
  a: Animal,
  s: SpeciesConfig,
  targetSpeed: number,
  dt: number,
  world: World,
): MoveResult {
  const wp = a.path[a.pathIndex]
  if (!wp) {
    a.speed += (0 - a.speed) * (1 - Math.exp(-8 * dt))
    return 'arrived'
  }
  const last = a.pathIndex === a.path.length - 1
  const dx = wp[0] - a.position.x
  const dz = wp[1] - a.position.z
  const dist = Math.hypot(dx, dz)
  if (dist < (last ? 0.4 : 0.8)) {
    a.pathIndex++
    return a.pathIndex >= a.path.length ? 'arrived' : 'moving'
  }

  const want = Math.atan2(-dx, -dz)
  const diff = angleDelta(a.yaw, want)
  const maxTurn = s.turnRate * dt
  a.yaw += Math.max(-maxTurn, Math.min(maxTurn, diff))

  const align = Math.max(0.2, Math.cos(Math.min(Math.abs(diff), Math.PI / 2)))
  const desired = targetSpeed * (Math.abs(diff) > 1 ? align * 0.5 : 1)
  a.speed += (desired - a.speed) * (1 - Math.exp(-6 * dt))

  const step = Math.min(a.speed * dt, dist)
  let x = a.position.x - Math.sin(a.yaw) * step
  let z = a.position.z - Math.cos(a.yaw) * step
  const r = world.resolveCircle(x, z, s.radius)
  ;[x, z] = world.clampToBounds(r.x, r.z, 1)
  a.position.x = x
  a.position.z = z
  a.position.y = world.heightAt(x, z)
  return 'moving'
}

const CRUISE_ALTITUDE = 4.5
const VERTICAL_SPEED = 3.2

/** Height of whatever a flyer would land on at (x, z): a rooftop or the ground. */
export const landingHeight = (world: World, x: number, z: number): number =>
  world.buildingAt(x, z)?.height ?? world.heightAt(x, z)

/**
 * Fly in a straight line to the first waypoint: climb to cruise altitude for longer trips,
 * descend on approach, and land (clearing `airborne`) at the goal. Flyers cross buildings freely.
 */
export function stepFlying(
  a: Animal,
  s: SpeciesConfig,
  targetSpeed: number,
  dt: number,
  world: World,
): MoveResult {
  const wp = a.path[a.pathIndex]
  if (!wp) return 'arrived'
  const dx = wp[0] - a.position.x
  const dz = wp[1] - a.position.z
  const dist = Math.hypot(dx, dz)
  const groundY = landingHeight(world, wp[0], wp[1])

  const desired = dist > 7 ? groundY + CRUISE_ALTITUDE : groundY
  const dy = Math.max(-VERTICAL_SPEED * dt, Math.min(VERTICAL_SPEED * dt, desired - a.position.y))
  a.position.y += dy

  if (dist < 0.5) {
    // Above the goal: finish descending, then land.
    a.speed += (0 - a.speed) * (1 - Math.exp(-8 * dt))
    if (a.position.y - groundY < 0.05) {
      a.position.y = groundY
      a.airborne = false
      a.pathIndex++
      return 'arrived'
    }
    return 'moving'
  }

  const want = Math.atan2(-dx, -dz)
  const diff = angleDelta(a.yaw, want)
  const maxTurn = s.turnRate * dt
  a.yaw += Math.max(-maxTurn, Math.min(maxTurn, diff))
  // Slow while barely off the ground (take-off) so the climb-out is visible.
  const takeoff = a.position.y < 0.6 && dist > 7 ? 0.45 : 1
  a.speed += (targetSpeed * takeoff - a.speed) * (1 - Math.exp(-4 * dt))

  const step = Math.min(a.speed * dt, dist)
  const [x, z] = world.clampToBounds(
    a.position.x - Math.sin(a.yaw) * step,
    a.position.z - Math.cos(a.yaw) * step,
    1,
  )
  a.position.x = x
  a.position.z = z
  return 'moving'
}

/** If something interrupted a flight, settle the bird back onto whatever is below it. */
export function settleToGround(a: Animal, dt: number, world: World): void {
  const groundY = landingHeight(world, a.position.x, a.position.z)
  a.position.y = Math.max(groundY, a.position.y - VERTICAL_SPEED * dt)
  if (a.position.y - groundY < 0.05) a.airborne = false
}
