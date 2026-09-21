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

## In progress

Nothing.

## Next

- Phase 2 — player: WASD/run/jump, third-person camera, collision, bounds

## Known issues

- React pinned to 19.2.x due to R3F peer range (see ARCHITECTURE.md).
- Cloudflare Pages not yet connected (needs the user's Cloudflare account).
- Ground plane ends 200 m past the map edge; hidden by fog for now, a proper boundary comes in Phase 2.
- Camera is a temporary free orbit camera until Phase 2.
