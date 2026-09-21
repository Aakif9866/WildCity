# Performance

Targets: 60 FPS on modern desktop, usable on mid-range phones. Measure before optimizing.

## Budgets (to be validated)

| Metric            | Target        |
| ----------------- | ------------- |
| Draw calls        | < 200         |
| Triangles         | < 300k        |
| Animal GLB        | < 300 KB each |
| Initial JS (gzip) | < 350 KB      |

## Baseline (Phase 0, placeholder scene)

| Chunk | Size (gzip) |
| ----- | ----------- |
| app   | 109 KB      |
| three | 187 KB      |
| CSS   | 2.4 KB      |

## Techniques planned

Instancing, shared materials/geometry, Draco/Meshopt, frustum culling, LOD, object pooling,
minimal shadows. Set `VITE_DEBUG_STATS=true` for an FPS overlay once implemented (Phase 10).

## Phase 1 (demo city, 500 m square)

10 draw calls, ~26k triangles, 10 geometries, 0 textures (measured via `window.__wildcity.renderInfo()`).
JS gzip: app 113 KB, three 192 KB.

## Phase 2

23 draw calls (city 10 + player 4 + boundary 4 + misc), ~26k triangles. Movement/collision cost is negligible (grid lookups).

## Phase 3

Nav grid: 250x250 cells built once at load (well under 1 s in tests). A* capped at 12k expansions (~ms). One dog = 4 meshes (GLB) — unmerged per-group; the procedural rig is the same 4 draws. dog.glb = 24 KB.

## Phase 5 (22 animals)

72 draw calls measured with the full population in view at spawn (city ~23 + animals). Worst case is roughly 23 + 22 x 5-6 = ~145, under the 200 budget. AI cost: ~27 us per animal update in the soak test, so ~0.6 ms/frame for 22 animals.
