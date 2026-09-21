import { SPECIES } from './species'
import type { SpawnRequest } from './spawn'

/** Default population (22 animals). Data, not logic: tune here (or per city later). */
export const DEFAULT_SPAWN_PLAN: SpawnRequest[] = [
  { species: SPECIES.dog, count: 4 },
  { species: SPECIES.cat, count: 3 },
  { species: SPECIES.pigeon, count: 8 },
  { species: SPECIES.monkey, count: 3 },
  { species: SPECIES.squirrel, count: 4 },
]
