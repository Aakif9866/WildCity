import type { NavGrid } from '@/game/navigation/NavGrid'
import type { World } from '@/game/world/World'
import type { Rng } from '@/utils/random'
import { randRange } from '@/utils/random'
import { preference, type SpeciesConfig } from './species'
import type { Animal, SpeciesId } from './types'

const inRange = (rng: Rng, [min, max]: [number, number]): number =>
  Math.round(randRange(rng, min, max))

export interface SpawnRequest {
  species: SpeciesConfig
  count: number
}

/**
 * Place animals in favourite zones, keeping a safe distance from the player's spawn so nothing
 * starts on top of them. Ground species need walkable cells; flyers can start on rooftops.
 */
export function spawnAnimals(
  requests: readonly SpawnRequest[],
  world: World,
  nav: NavGrid,
  rng: Rng,
  avoid: { x: number; z: number },
  minPlayerDistance = 15,
): Animal[] {
  const animals: Animal[] = []
  const counters = new Map<SpeciesId, number>()
  const pick = (s: SpeciesConfig) => {
    const weight = (z: Parameters<typeof preference>[1]): number => preference(s, z) ** 2
    const r = nav.halfSize * 0.95
    return s.flying
      ? nav.randomAirSpot(0, 0, 0, r, rng, weight, 40)
      : nav.randomSpot(0, 0, 0, r, rng, weight, 40)
  }

  for (const { species, count } of requests) {
    for (let i = 0; i < count; i++) {
      let pos = pick(species)
      for (
        let t = 0;
        pos && Math.hypot(pos[0] - avoid.x, pos[1] - avoid.z) < minPlayerDistance && t < 30;
        t++
      )
        pos = pick(species)
      if (!pos) continue // nowhere suitable found: skip rather than crash

      const n = (counters.get(species.id) ?? 0) + 1
      counters.set(species.id, n)
      const roof = species.flying ? (world.buildingAt(pos[0], pos[1])?.height ?? 0) : 0
      animals.push({
        id: `${species.id}-${n}`,
        species: species.id,
        coat: Math.floor(rng() * species.coats.length),
        position: { x: pos[0], y: roof || world.heightAt(pos[0], pos[1]), z: pos[1] },
        yaw: rng() * Math.PI * 2,
        speed: 0,
        state: 'IDLE',
        stateTime: rng() * 2,
        energy: randRange(rng, 60, 100),
        hunger: randRange(rng, 0, 40),
        vigor: inRange(rng, species.personality.vigor),
        curiosity: inRange(rng, species.personality.curiosity),
        social: inRange(rng, species.personality.social),
        target: null,
        targetKind: null,
        path: [],
        pathIndex: 0,
        animation: 'idle',
        cooldown: 0,
        airborne: false,
        attention: randRange(rng, 3, 12),
      })
    }
  }
  return animals
}
