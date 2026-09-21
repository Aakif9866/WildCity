import type { RigAnim } from './rig'
import type { AnimationName } from './types'

export interface Pose {
  x: number
  y: number
  z: number
  rx: number
  ry: number
  rz: number
}

export const newPose = (): Pose => ({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 })

/**
 * Procedural animation for one rig group. `phase` advances with distance travelled (so feet
 * match ground speed); `time` is wall time for ambient motion like tail wags. Writes into `out`
 * to avoid per-frame allocations. Offsets are relative to the group's pivot.
 */
export function poseFor(
  anim: RigAnim,
  animation: AnimationName,
  moveAmount: number,
  phase: number,
  time: number,
  out: Pose,
): Pose {
  out.x = out.y = out.z = out.rx = out.ry = out.rz = 0
  switch (anim) {
    case 'strideA':
    case 'strideB': {
      const p = anim === 'strideA' ? phase : phase + Math.PI
      out.z = Math.sin(p) * 0.13 * moveAmount
      out.y = Math.max(0, Math.cos(p)) * 0.07 * moveAmount
      break
    }
    case 'flapL':
    case 'flapR':
      if (animation === 'fly') out.rz = (anim === 'flapL' ? 1 : -1) * Math.sin(time * 26) * 0.9
      break
    case 'wag':
      out.ry = Math.sin(time * (animation === 'idle' ? 4 : 10)) * (animation === 'sleep' ? 0 : 0.45)
      break
    case 'head':
      if (animation === 'eat') out.rx = 0.5 + Math.sin(time * 7) * 0.2
      break
    default:
      break
  }
  return out
}
