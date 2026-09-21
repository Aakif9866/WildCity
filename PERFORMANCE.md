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
