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

## In progress

Nothing.

## Next

- Phase 3 — first animal: GLB loading, animation, wandering dog

## Known issues

- React pinned to 19.2.x due to R3F peer range (see ARCHITECTURE.md).
- Cloudflare Pages not yet connected (needs the user's Cloudflare account).
- Trees have no collision (player walks through them).
- Pointer lock can't be verified in headless Chrome; drag-look fallback is what smoke covers.
