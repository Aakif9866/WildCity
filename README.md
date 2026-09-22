# WildCity

A lightweight browser-based 3D exploration and animal simulation game. Pick a real city, walk
through a simplified 3D version of a small area, and observe animals living inside it.

> Real-world geography + stylized lightweight 3D + believable animal behaviour + player exploration.

**Status:** Phase 0 (project foundation). See [PROGRESS.md](PROGRESS.md).

## Stack

React · TypeScript (strict) · Vite · Three.js · React Three Fiber · drei · Zustand · Tailwind CSS v4.
No backend, no database, no accounts. Everything runs in the browser.

## Getting started

Requires Node >= 20.19.

```bash
npm install
cp .env.example .env.local   # optional
npm run dev                  # http://localhost:5173
```

| Script            | Purpose                      |
| ----------------- | ---------------------------- |
| `npm run dev`     | Dev server                   |
| `npm run build`   | Typecheck + production build |
| `npm run preview` | Serve the production build   |
| `npm run lint`    | ESLint                       |
| `npm run format`  | Prettier (write)             |
| `npm test`        | Vitest                       |

## Adding a city

```bash
npm run city -- --id mumbai --name Mumbai --country India --lat 19.076 --lon 72.8777 --half 350 \
  --desc "Short blurb shown in the city list"
```

Downloads OpenStreetMap data for a square of `2 * half` metres, converts it, and writes
`public/cities/<id>/` plus the city index. Re-run with `--refresh` to re-download (the raw
download is cached in `data/raw/`). Pick an area with a mix of buildings, green space and water.
Map data (c) OpenStreetMap contributors (ODbL).

## Deployment

**Live:** https://wildcity.pages.dev (Cloudflare Pages, currently a manual CLI deploy — see below).

Deployed with Wrangler, since Railway's free-tier resource limit was already used up by other
projects on this account:

```bash
npm run build
npx wrangler pages deploy dist --project-name=wildcity --branch=main
```

This uploads whatever is in `dist/` right now; it does **not** watch the repo. Re-run it after any
change you want live. To switch to auto-deploy on every push instead, connect the GitHub repo in
the Cloudflare Pages dashboard: build command `npm run build`, output directory `dist`, environment
variable `NODE_VERSION=20.19.0` — then pushes to `main` deploy on their own and the manual command
above is no longer needed.

An unused `npm start` (`vite preview`) is also wired up so the same `dist/` build can run on a
Node host such as Railway if that's ever preferred; `vite.config.ts` sets `preview.allowedHosts`
so it works behind a reverse proxy.

## Conventions

- TypeScript strict, no `any`. Path alias `@/` -> `src/`.
- Game logic (`src/game`) never imports React or Three.js rendering code; rendering (`src/render`)
  reads from it.
- Zustand holds app-flow/UI state only, never per-frame simulation state.
- Behaviour is data-driven (species/city configs), not hardcoded in the engine.
- Comment the WHY, not the WHAT. Add dependencies only with a reason.

Docs: [ARCHITECTURE.md](ARCHITECTURE.md) · [GAME_DESIGN.md](GAME_DESIGN.md) ·
[PROGRESS.md](PROGRESS.md) · [PERFORMANCE.md](PERFORMANCE.md)
