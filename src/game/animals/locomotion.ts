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
