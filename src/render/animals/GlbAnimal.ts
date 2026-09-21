import {
  AnimationMixer,
  LoopRepeat,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
} from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { SPECIES } from '@/game/animals/species'
import type { Animal, AnimationName } from '@/game/animals/types'
import type { AnimalVisual } from './AnimalVisual'

/** Animal drawn from a loaded GLB, driven by its animation clips (idle/walk/run/...). */
export class GlbAnimal implements AnimalVisual {
  readonly root: Object3D
  private readonly mixer: AnimationMixer
  private readonly actions = new Map<string, AnimationAction>()
  private current: AnimationAction | null = null
  private currentName = ''
  private sleep = 0

  constructor(scene: Object3D, clips: AnimationClip[]) {
    this.root = clone(scene) // per-instance copy; geometry/materials stay shared
    this.mixer = new AnimationMixer(this.root)
    for (const clip of clips) {
      const action = this.mixer.clipAction(clip)
      action.setLoop(LoopRepeat, Infinity)
      this.actions.set(clip.name.toLowerCase(), action)
    }
  }

  private pick(name: AnimationName): AnimationAction | null {
    return (
      this.actions.get(name) ??
      this.actions.get('idle') ??
      this.actions.values().next().value ??
      null
    )
  }

  update(a: Animal, _time: number, dt: number): void {
    this.root.position.set(a.position.x, a.position.y, a.position.z)
    this.root.rotation.y = a.yaw
    this.sleep += ((a.animation === 'sleep' ? 1 : 0) - this.sleep) * Math.min(1, dt * 4)
    this.root.scale.y = 1 - 0.4 * this.sleep

    const next = this.pick(a.animation)
    if (next && next !== this.current) {
      next.reset().fadeIn(0.2).play()
      this.current?.fadeOut(0.2)
      this.current = next
      this.currentName = a.animation
    }
    // Keep foot speed roughly matched to ground speed.
    if (this.current && (this.currentName === 'walk' || this.currentName === 'run')) {
      const ref =
        this.currentName === 'run'
          ? SPECIES[a.species as keyof typeof SPECIES].runSpeed
          : SPECIES[a.species as keyof typeof SPECIES].walkSpeed
      this.current.timeScale = Math.max(0.4, a.speed / ref)
    } else if (this.current) this.current.timeScale = 1
    this.mixer.update(dt)
  }

  dispose(): void {
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.root)
  }
}
