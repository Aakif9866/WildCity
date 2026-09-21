import type { Rng } from '@/utils/random'
import { randRange } from '@/utils/random'
import type { NavGrid } from '@/game/navigation/NavGrid'
import { preference, type SpeciesConfig } from './species'
import type { Animal, SpeciesId } from './types'

const inRange = (rng: Rng, [min, max]: [number, number]): number =>
  Math.round(randRange(rng, min, max))

export interface SpawnRequest {
  species: SpeciesConfig
  count: number
}

/**
 * Place animals on walkable ground, preferring each species' favourite zones and keeping a
 * safe distance from the player's spawn so nothing starts on top of them.
 */
export function spawnAnimals(
  requests: readonly SpawnRequest[],
  nav: NavGrid,
  rng: Rng,
  avoid: { x: number; z: number },
  minPlayerDistance = 15,
): Animal[] {
  const animals: Animal[] = []
  const counters = new Map<SpeciesId, number>()
  for (const { species, count } of requests) {
    for (let i = 0; i < count; i++) {
      const spot = nav.randomSpot(
        0,
        0,
        0,
        nav.halfSize * 0.95,
        rng,
        (z) => preference(species, z) ** 2,
        40,
      )
      let pos = spot
      for (
        let tries = 0;
        pos && Math.hypot(pos[0] - avoid.x, pos[1] - avoid.z) < minPlayerDistance && tries < 30;
        tries++
      ) {
        pos = nav.randomSpot(
          0,
          0,
          0,
          nav.halfSize * 0.95,
          rng,
          (z) => preference(species, z) ** 2,
          40,
        )
      }
      if (!pos) continue // nowhere walkable found: skip rather than crash
      const n = (counters.get(species.id) ?? 0) + 1
      counters.set(species.id, n)
      animals.push({
        id: `${species.id}-${n}`,
        species: species.id,
        coat: Math.floor(rng() * species.coats.length),
        position: { x: pos[0], y: 0, z: pos[1] },
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
      })
    }
  }
  return animals
}
