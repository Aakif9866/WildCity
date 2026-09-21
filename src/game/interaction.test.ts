import { describe, expect, it } from 'vitest'
import type { Animal } from '@/game/animals/types'
import { describeState, nearestAnimal } from './interaction'

const animal = (id: string, x: number, z: number): Animal =>
  ({ id, position: { x, y: 0, z }, state: 'IDLE', airborne: false }) as Animal

describe('nearestAnimal', () => {
  const animals = [animal('a', 10, 0), animal('b', 3, 0), animal('c', -2, 1)]
  it('returns the closest animal within range', () => {
    expect(nearestAnimal(animals, 0, 0, 5)?.id).toBe('c')
    expect(nearestAnimal(animals, 4, 0, 5)?.id).toBe('b')
  })
  it('returns null when nothing is in range', () => {
    expect(nearestAnimal(animals, 50, 50, 5)).toBeNull()
    expect(nearestAnimal([], 0, 0)).toBeNull()
  })
})

describe('describeState', () => {
  it('uses friendly labels and reports flying', () => {
    expect(describeState(animal('a', 0, 0))).toBe('Idle')
    expect(describeState({ ...animal('a', 0, 0), state: 'WANDER' })).toBe('Wandering')
    expect(describeState({ ...animal('a', 0, 0), airborne: true })).toBe('Flying')
  })
})
