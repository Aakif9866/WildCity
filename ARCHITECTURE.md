# Architecture

```
Browser -> React -> React Three Fiber -> Three.js -> Game systems
```

Everything runs client-side. No backend, database or auth in the MVP.

## Layers

| Folder                | Responsibility                                                        |
| --------------------- | --------------------------------------------------------------------- |
| `src/game/`           | Pure simulation logic (no React/Three rendering). Unit-testable.      |
| `src/game/world`      | World model, coordinate conversion, zones                             |
| `src/game/player`     | Player movement, collision                                            |
| `src/game/animals`    | Animal entity, species configs                                        |
| `src/game/ai`         | Finite-state machine, behaviour selection                             |
| `src/game/navigation` | Nav graph + A*                                                        |
| `src/game/time`       | Day/night clock                                                       |
| `src/cities/`         | City data loading/parsing (generic; no city-specific code)            |
| `src/render/`         | R3F components; read from `game/`, hold no rules                      |
| `src/state/`          | Zustand stores for app flow and UI                                    |
| `src/ui/`             | HTML overlays (menu, HUD, animal panel)                               |
| `src/config/`         | Build-time env access                                                 |
| `src/utils/`          | Small pure helpers                                                    |
| `public/cities/<id>/` | City data files (metadata, roads, buildings, zones) served statically |
| `public/models/`      | GLB animal models (Draco/Meshopt compressed)                          |

Most `game/` folders are empty placeholders until their phase.

## Frame loop (Phase 2)

`PlayerController` (render) -> `input.poll()` -> `stepPlayer` (game/player) -> `updateCameraRig`
(game/camera) -> write Three camera. Rules live in `game/`; the component only wires them to
`useFrame`. `GameSession` (game/session.ts) holds the mutable per-frame state outside React.

`World` (game/world) is the single query layer: `resolveCircle` (collision), `zoneAt`, `freeDistance`
(camera clearance), `heightAt` (terrain hook, flat for now).

## Animals (Phase 3)

`Animal` (data) is advanced by `updateAnimal` (game/ai/fsm.ts: state handlers) using `NavGrid`
(pathfinding) and `stepAlongPath` (locomotion). Species behave differently through
`SpeciesConfig` data, not code branches. Rendering goes through the `AnimalVisual` interface:
`ProceduralAnimal` (merged boxes, driven by `poseFor`) or `GlbAnimal` (clips via AnimationMixer),
chosen per species by `modelUrl` with an error boundary falling back to procedural.

## Animal AI (Phase 4)

Each tick: `updateNeeds` -> flee check (`perception`) -> state handler. When idle, `decide` either
applies a hard override (starving / exhausted) or samples from `behaviourWeights` (pure; needs x
personality x time-of-day x surroundings). `startBehaviour` sets up a plan (A* route + `targetKind`);
on arrival the handler picks the follow-up state from `targetKind` (food -> EAT, water -> DRINK).
Failed plans set `cooldown` so a cornered animal doesn't re-run A* every frame.

## Species and flight (Phase 5)

A species is one `SpeciesConfig` entry + one rig JSON; no engine branches per species. The only
structural difference is `flying`: flyers plan a straight line (`planFlight`) instead of an A* route,
climb to cruise altitude on longer trips, and land on whatever is below the goal (rooftop or
ground). Short hops between walkable spots stay on foot. `airborne` marks an active flight and
drives the wing-flap animation; `settleToGround` guarantees a bird never hovers if its plan is cleared.

## Interaction (Phase 6)

`reactions.ts` (pure) decides whether a noticed player triggers FOLLOW/INVESTIGATE. The controller
finds the nearest animal ~5x/s and pushes only changes to Zustand (`promptAnimalId`, `panelAnimalId`,
`followAnimalId`, `observedId`); UI panels sample live animal values at 4 Hz. Follow mode simply
swaps the camera target from the player to the animal in `PlayerController`.

## City data pipeline (Phase 7)

```
Overpass API --(npm run city, build time)--> data/raw/<id>.json (git-ignored cache)
   -> convertOverpass (src/cities/osm)      pure + unit-tested
   -> public/cities/<id>/{metadata,roads,buildings,zones}.json  + public/cities/index.json
   -> runtime: loadCity -> parseCityData (validate) -> createSession -> World/NavGrid/animals
```

Adding a city = run the script with new coordinates; no engine change. Runtime errors are typed
(`CityLoadError`, `CityDataError`) and surface as a friendly menu message with recovery options.
OSM data is (c) OpenStreetMap contributors, ODbL: `metadata.attribution` is displayed in-game.

## Time of day (Phase 9)

`session.clock` (game hour) is advanced by `TimeSystem`; `syncTime` derives `session.time.phase` for
the animal AI (activity schedules) and `Atmosphere` turns `lightingAt(hour)` into three.js light,
sky and fog values every frame. `lightingAt` is pure, so weather can later wrap it (scale
intensities, desaturate colours) without touching the renderer.

## Key decisions

- **Simulation outside React.** Per-frame state (player, animals) lives in plain modules/refs and is
  advanced in `useFrame`. Zustand is only for coarse state (menu, pause, selected animal) so the
  game never re-renders React per tick.
- **Cities are data.** Each city is a folder of JSON. The engine consumes a generic `City` shape;
  adding a city means adding data, not code. OSM -> local metres conversion is a pure function.
- **Species are data.** New animals are added through config (stats, zone preferences, activity
  schedule), reusing one FSM.
- **Lightweight physics.** Custom capsule-vs-footprint collision and heightfield ground instead of a
  physics engine, unless measurements show a clear need.
- **Instancing and shared geometry/materials** for buildings, trees and roads.
- **Camera separated from player** so mobile/touch input can drive both later via an input layer.

## Dependency note

`react`/`react-dom` are pinned to `~19.2` because `@react-three/fiber@9.7` requires `react <19.3`.
Revisit when R3F widens its peer range.
