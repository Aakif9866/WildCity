# Progress

## Completed

- **Phase 0 — Foundation**
  - Vite + React 19 + TypeScript (strict, `noUncheckedIndexedAccess`)
  - Three.js, React Three Fiber, drei, Zustand, Tailwind v4
  - ESLint (flat config) + Prettier, Vitest with a first unit test
  - Folder structure, `@/` alias, env config, placeholder city metadata
  - Docs: README, ARCHITECTURE, GAME_DESIGN, PERFORMANCE
  - Verified: `npm run dev` serves, `npm run lint`, `npm test` and `npm run build` pass

- **Phase 1 — 3D world** (branch `phase-1-world`)
  - City data format (`src/cities/types.ts`), deterministic demo city generator in that format
  - Render builders: buildings merged into one geometry, road/sidewalk ribbons, flat area fills,
    instanced trees. Whole city = **10 draw calls, ~26k triangles**
  - 2D geometry utils + PRNG with tests; browser smoke harness (`npm run smoke`, real Chrome)

- **Phase 2 — Player** (branch `phase-2-player`)
  - `World` query layer (spatial grid): building collision (circle vs polygon, slide response),
    zone lookup, bounds, camera ray clearance, height hook for future terrain
  - Camera-relative WASD, run, jump, gravity; third-person orbit camera with zoom and wall
    avoidance, kept separate from player logic
  - Device-agnostic `InputFrame` (keyboard + pointer lock, drag-look fallback) so touch can plug in later
  - Pause menu (Esc / pointer-lock loss), HUD hints, faint boundary walls
  - 31 unit tests; smoke: walk/run/jump/wall/bounds/pause all verified in Chrome

- **Phase 3 — First animal** (branch `phase-3-first-animal`)
  - `Animal` entity (all spec fields), `SpeciesConfig` as data, rig JSON per species
  - `NavGrid` (2 m cells): walkability with wall clearance, derived TREE zone, A* with per-species
    zone costs + line-of-sight smoothing, weighted random spot picking
  - Spawn rules (walkable, preferred zones, away from player), locomotion (turn-rate limited, slows in turns)
  - FSM skeleton (IDLE/WANDER; other states fall back to idle until Phase 4)
  - Rendering: merged procedural rig (few draw calls) **and** real GLB loading with animation
    mixer; `AnimalErrorBoundary` falls back to the procedural rig if a model is missing/corrupt
  - `npm run models` bakes rig JSON -> GLB (idle/walk/run clips) via `@gltf-transform/core`
  - 49 unit tests; smoke verifies the GLB is served, the dog wanders and never enters a building

- **Phase 4 — Animal AI** (branch `phase-4-animal-ai`)
  - Needs: hunger (rises) and energy (drains when moving, recovers resting), scaled by personality
  - Full FSM for IDLE, WANDER, MOVE_TO_TARGET, EAT, DRINK, REST, SLEEP, FLEE
    (INVESTIGATE/FOLLOW/INTERACT arrive in Phase 6)
  - `behaviourWeights`: pure weighted choice from needs, personality (vigor/curiosity/social),
    time-of-day activity and surroundings; hard needs override (starving -> food, exhausted -> rest)
  - Perception: flee distance depends on boldness, player speed, sleep; `cooldown` stops per-frame A* retries
  - `DayPhase` + per-species `activity` in place; session time is a fixed midday until Phase 9
  - Derived `moodOf` for the UI; `session.timeScale` for testing/profiling
  - 69 unit tests incl. a 10-minute population soak test; smoke covers hunger->eat, exhaustion->rest, flee

## In progress

Nothing.

## Next

- Phase 5 — multiple animals: cat, pigeon (flying), monkey, squirrel with species-specific behaviour

## Known issues

- React pinned to 19.2.x due to R3F peer range (see ARCHITECTURE.md).
- Cloudflare Pages not yet connected (needs the user's Cloudflare account).
- Trees have no collision (player and animals walk through them); the camera can sit inside a canopy.
- Dog GLB is generated from the same box rig (looks identical to the fallback); real art can replace it.
- Three.js logs a deprecation for `THREE.Clock` (from R3F internals) - harmless.
- Pointer lock can't be verified in headless Chrome; drag-look fallback is what smoke covers.
