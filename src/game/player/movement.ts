import type { InputFrame } from '@/game/input/types'
import type { World } from '@/game/world/World'

export interface PlayerState {
  x: number
  y: number
  z: number
  vx: number
  vz: number
  vy: number
  /** Facing angle; 0 faces -z, matching the camera yaw convention. */
  yaw: number
  grounded: boolean
  /** Horizontal speed, exposed for animation and for animals to react to running. */
  speed: number
}

export const PLAYER = {
  radius: 0.45,
  walkSpeed: 4.5,
  runSpeed: 8.5,
  groundAccel: 14,
  airAccel: 3,
  turnRate: 12,
  jumpVelocity: 7.5,
  gravity: 22,
  boundsMargin: 1.5,
} as const

export function createPlayer(x: number, z: number, yaw: number, world: World): PlayerState {
  return { x, y: world.heightAt(x, z), z, vx: 0, vz: 0, vy: 0, yaw, grounded: true, speed: 0 }
}

/** Shortest signed angle from a to b, in (-PI, PI]. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

/**
 * Advance the player one tick. Movement is relative to the camera yaw so W always means
 * "away from the camera". Collision and bounds are resolved after integration.
 */
export function stepPlayer(
  p: PlayerState,
  input: InputFrame,
  cameraYaw: number,
  dt: number,
  world: World,
): void {
  const sin = Math.sin(cameraYaw)
  const cos = Math.cos(cameraYaw)
  // forward = (-sin, -cos), right = (cos, -sin)
  let dx = -sin * input.moveY + cos * input.moveX
  let dz = -cos * input.moveY - sin * input.moveX
  const len = Math.hypot(dx, dz)
  const target = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed
  if (len > 0) {
    dx = (dx / len) * target
    dz = (dz / len) * target
  }

  const accel = p.grounded ? PLAYER.groundAccel : PLAYER.airAccel
  const k = 1 - Math.exp(-accel * dt)
  p.vx += (dx - p.vx) * k
  p.vz += (dz - p.vz) * k

  if (input.jump && p.grounded) {
    p.vy = PLAYER.jumpVelocity
    p.grounded = false
  }
  p.vy -= PLAYER.gravity * dt

  let nx = p.x + p.vx * dt
  let nz = p.z + p.vz * dt
  const resolved = world.resolveCircle(nx, nz, PLAYER.radius)
  nx = resolved.x
  nz = resolved.z
  ;[nx, nz] = world.clampToBounds(nx, nz, PLAYER.boundsMargin)
  if (resolved.hit) {
    // Kill the velocity component that pushed into the wall so we slide instead of jitter.
    const rx = nx - (p.x + p.vx * dt)
    const rz = nz - (p.z + p.vz * dt)
    const rl = Math.hypot(rx, rz)
    if (rl > 1e-6) {
      const nxn = rx / rl
      const nzn = rz / rl
      const into = p.vx * nxn + p.vz * nzn
      if (into < 0) {
        p.vx -= into * nxn
        p.vz -= into * nzn
      }
    }
  }
  p.x = nx
  p.z = nz

  p.y += p.vy * dt
  const ground = world.heightAt(p.x, p.z)
  if (p.y <= ground) {
    p.y = ground
    p.vy = 0
    p.grounded = true
  }

  p.speed = Math.hypot(p.vx, p.vz)
  if (p.speed > 0.4) {
    const want = Math.atan2(-p.vx, -p.vz)
    p.yaw += angleDelta(p.yaw, want) * (1 - Math.exp(-PLAYER.turnRate * dt))
  }
}

export const isMoving = (p: PlayerState): boolean => p.speed > 0.3
