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
