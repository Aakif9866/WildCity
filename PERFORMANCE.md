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
