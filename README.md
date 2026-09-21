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

## Deployment (Cloudflare Pages)

Connect the GitHub repo in Cloudflare Pages with: build command `npm run build`, output directory
`dist`, environment variable `NODE_VERSION=20.19.0`. Pushes to the main branch deploy automatically.

## Conventions

- TypeScript strict, no `any`. Path alias `@/` -> `src/`.
- Game logic (`src/game`) never imports React or Three.js rendering code; rendering (`src/render`)
  reads from it.
- Zustand holds app-flow/UI state only, never per-frame simulation state.
- Behaviour is data-driven (species/city configs), not hardcoded in the engine.
- Comment the WHY, not the WHAT. Add dependencies only with a reason.

Docs: [ARCHITECTURE.md](ARCHITECTURE.md) · [GAME_DESIGN.md](GAME_DESIGN.md) ·
[PROGRESS.md](PROGRESS.md) · [PERFORMANCE.md](PERFORMANCE.md)
