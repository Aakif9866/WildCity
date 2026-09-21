import { SPECIES } from './species'
import type { SpawnRequest } from './spawn'

/** Default population. Data, not logic: tune here (or per city later). */
export const DEFAULT_SPAWN_PLAN: SpawnRequest[] = [{ species: SPECIES.dog, count: 1 }]
