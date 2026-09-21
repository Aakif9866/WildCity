import type { Object3D } from 'three'
import type { Animal } from '@/game/animals/types'

/** Anything that can draw an animal: procedural boxes today, a GLB when one is available. */
export interface AnimalVisual {
  root: Object3D
  update(animal: Animal, time: number, dt: number): void
  dispose(): void
}
