import { clamp } from '@/utils/math'
import type { World } from '@/game/world/World'

export interface CameraRig {
  yaw: number
  pitch: number
  /** Desired distance from the target (player zoom). */
  distance: number
  /** Actual distance after wall avoidance and smoothing. */
  actualDistance: number
  /** Smoothed look-at point. */
  tx: number
  ty: number
  tz: number
  /** Output camera position. */
  px: number
  py: number
  pz: number
}

export const CAMERA = {
  minDistance: 3,
  maxDistance: 16,
  minPitch: 0.05,
  maxPitch: 1.35,
  lookSensitivity: 0.0028,
  zoomSensitivity: 0.01,
  targetHeight: 1.5,
  followRate: 14,
  recoverRate: 5,
} as const

export function createCameraRig(yaw: number, tx: number, tz: number): CameraRig {
  return {
    yaw,
    pitch: 0.35,
    distance: 7,
    actualDistance: 7,
    tx,
    ty: CAMERA.targetHeight,
    tz,
    px: tx,
    py: 4,
    pz: tz + 7,
  }
}

/**
 * Orbit camera: pure state update so it can be tested and driven by any target (player, animal).
 * Mouse look is applied directly (no lag); only position follow and wall recovery are smoothed.
 */
export function updateCameraRig(
  rig: CameraRig,
  lookDX: number,
  lookDY: number,
  zoom: number,
  target: { x: number; y: number; z: number },
  dt: number,
  world: World,
  snap = false,
): void {
  rig.yaw -= lookDX * CAMERA.lookSensitivity
  rig.pitch = clamp(rig.pitch + lookDY * CAMERA.lookSensitivity, CAMERA.minPitch, CAMERA.maxPitch)
  rig.distance = clamp(
    rig.distance + zoom * CAMERA.zoomSensitivity,
    CAMERA.minDistance,
    CAMERA.maxDistance,
  )

  const follow = snap ? 1 : 1 - Math.exp(-CAMERA.followRate * dt)
  rig.tx += (target.x - rig.tx) * follow
  rig.ty += (target.y + CAMERA.targetHeight - rig.ty) * follow
  rig.tz += (target.z - rig.tz) * follow

  const cosP = Math.cos(rig.pitch)
  const dirX = Math.sin(rig.yaw) * cosP
  const dirY = Math.sin(rig.pitch)
  const dirZ = Math.cos(rig.yaw) * cosP

  const free = world.freeDistance(
    [rig.tx, rig.ty, rig.tz],
    [rig.tx + dirX * rig.distance, rig.ty + dirY * rig.distance, rig.tz + dirZ * rig.distance],
  )
  // Snap in instantly when a wall is in the way (never show the inside of a wall);
  // ease back out afterwards so the camera doesn't pop.
  if (free < rig.actualDistance || snap) rig.actualDistance = free
  else rig.actualDistance += (free - rig.actualDistance) * (1 - Math.exp(-CAMERA.recoverRate * dt))

  rig.px = rig.tx + dirX * rig.actualDistance
  rig.py = rig.ty + dirY * rig.actualDistance
  rig.pz = rig.tz + dirZ * rig.actualDistance
}
