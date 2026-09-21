# Performance

Targets: 60 FPS on a reasonably modern desktop, usable on mid-range phones. Rule: measure first,
optimize only what the numbers justify, and re-measure.

## How to measure

| Tool                                                 | What it tells you                                                                                                                                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run bench`                                      | CPU cost of the game logic in Node: city parse, world/nav build, animal AI per frame, A*, collision/zone queries, for every city                                                                                                |
| `npm run perf`                                       | Real Chrome: bundle sizes (raw/gzip/brotli), time to menu, click-to-world load time, heap, draw calls, triangles, frame pacing, long tasks, enter/quit leak check. `PERF_MENU_WAIT=1500` simulates a player pausing on the menu |
| `?stats` (or F3 in-game, or `VITE_DEBUG_STATS=true`) | Live fps / frame ms / draw calls / triangles / pixel ratio / heap. **Use this on a real device**: headless Chrome renders in software, so its FPS says nothing about a GPU                                                      |
| `?quality=fixed`                                     | Disables adaptive resolution, for reproducible measurements                                                                                                                                                                     |
| `window.__wildcity.renderInfo()`                     | Draw calls / triangles / geometries / textures (with `?debug`)                                                                                                                                                                  |

## Budgets

| Metric                                | Target       | Now                                               |
| ------------------------------------- | ------------ | ------------------------------------------------- |
| Draw calls                            | < 200        | 25-53 (worst case with every animal visible ~145) |
| Triangles                             | < 300k       | 10k-59k                                           |
| JS+CSS needed to show the menu (gzip) | < 100 KB     | ~78 KB                                            |
| JS heap while playing                 | < 100 MB     | 15-19 MB                                          |
| Animal AI, 22 animals                 | < 1 ms/frame | 0.006-0.018 ms/frame avg, 0.46 ms worst           |

## Measurements (Phase 10)

CPU benchmark (`npm run bench`, Node, one laptop; compare, don't trust across machines):

| City      | Buildings | Roads | Nav grid build | AI 22 animals / frame | A* avg / max  | zoneAt  | resolveCircle |
| --------- | --------- | ----- | -------------- | --------------------- | ------------- | ------- | ------------- |
| Demo      | 156       | 6     | 34 ms          | 0.016 ms              | 0.04 / 0.4 ms | 0.35 us | 0.66 us       |
| Hyderabad | 188       | 92    | 109 ms         | 0.006 ms              | 0.02 / 0.2 ms | 0.89 us | 0.32 us       |
| Bengaluru | 32        | 237   | 312 ms         | 0.008 ms              | 0.02 / 0.2 ms | 1.99 us | 1.76 us       |
| London    | 192       | 543   | 257 ms         | 0.010 ms              | 0.02 / 0.3 ms | 2.17 us | 1.14 us       |

**Conclusion: game logic is not a bottleneck.** The only visible CPU cost is the one-off nav-grid
build at load (dominated by `zoneAt` on road-heavy cities).

Browser, before -> after Phase 10 (headless Chrome, software GL):

|                                            | Before                                            | After              |
| ------------------------------------------ | ------------------------------------------------- | ------------------ |
| JS+CSS to show the menu (gzip)             | 333.8 KB (3 files)                                | **78 KB (1 file)** |
| Total JS+CSS after Explore (gzip / brotli) | 333.8 / 262.4 KB                                  | 329.5 / 275.9 KB   |
| Time to menu                               | 100-250 ms                                        | 77-104 ms          |
| London triangles                           | 73.1k                                             | **58.5k (-20%)**   |
| Bengaluru triangles                        | 58.6k                                             | **46.6k (-21%)**   |
| JS heap (loaded / after running)           | 15-17 / 15-20 MB                                  | 15-19 / 16-19 MB   |
| Leak check, 4 enter/quit cycles (London)   | 45 geometries, 1 texture, heap noisy not climbing | same               |
| Draw calls                                 | 25-53                                             | 25-53              |

**Load time (click -> world), and a regression I introduced and fixed.** Making the 3D stack lazy first
_regressed_ click-to-world by ~300 ms (A/B against the Phase 9 build, same script, run alternately:
Hyderabad 425 -> 745 ms, London 418 -> 723 ms). Cause, found by toggling one change at a time and tracing
resource timing: the chunks were prefetched in time, but `React.lazy` + `<Suspense fallback>` commits a
fallback and React then throttles the reveal by ~300 ms. Fix: import the module explicitly while the
loading screen is up and mount it directly (no Suspense). Final alternating A/B (2 runs each, ms):

| City      | Phase 9 baseline | Phase 10 (fixed) |
| --------- | ---------------- | ---------------- |
| Hyderabad | 388 / 396        | 395 / 417        |
| Bengaluru | 606 / 623        | 574 / 626        |
| London    | 570 / 578        | 397 / 541        |

So load time is unchanged (within run-to-run noise) while the menu needs ~77% fewer bytes.

## What changed, and why

- **Lazy-loaded the 3D stack.** three.js + R3F + rendering code was 60% of the download and blocked the
  menu. The menu now ships alone; the 3D chunk is prefetched 800 ms after the menu appears. Total
  bytes are unchanged (brotli is ~13 KB _worse_ because separate files compress slightly less), the
  gain is _when_ they are needed.
- **Open-ended tree trunks.** Trees were 80-87% of triangles in London/Bengaluru (40 triangles
  each); the trunk's end caps were never visible. -10 triangles per tree, no visual change.
- **Removed `@react-three/drei`.** It was used in one place (`useGLTF`); R3F's `useLoader` +
  three's `GLTFLoader` does the same for -7.7 KB gzip and one less dependency tree. Add it back if
  a drei helper is ever needed (`npm i @react-three/drei`).
- **Adaptive resolution** (`src/game/quality.ts`): steps the pixel ratio 0.6-2 by average frame time
  with hysteresis (down above 26 ms, up below 13 ms, 3 s cooldown). Unit-tested for convergence;
  it exists for weak mobile GPUs, which I cannot measure here.
- **Stats overlay** so real-device numbers can be collected.

## Measured, and deliberately NOT changed

- **Nav-grid build.** I tried skipping the collision query for cells far from buildings (result
  identical to the reference on all four cities): 312 ms -> 312 ms. Not the bottleneck, reverted.
  The cost is `zoneAt`; ~0.1-0.3 s once per load is not worth a rewrite.
- **Instancing the animals.** Draw calls are 25-53. Not a problem.
- **Draco / Meshopt.** The only model is 24 KB (4 KB gzip). A decoder would cost more than it saves.
- **Tree distance culling.** Would need per-instance culling; benefit unproven without a GPU.
- **Software-GL FPS did not change** when triangles dropped 20% (London 13.3 -> 13.2 fps), so in that
  environment the limit is not vertex work. Whether the triangle cut helps a real GPU is unmeasured.

## Known limits / next steps

- Real-device FPS is unmeasured. Run `?stats` on target hardware (a mid-range phone, a laptop iGPU) and
  record it here before spending more effort.
- If London-class scenes are slow on a device: distance-cull tree instances, then lower crown detail.
- The nav-grid build runs on the main thread; move it to a worker if cities grow well past 700 m.
