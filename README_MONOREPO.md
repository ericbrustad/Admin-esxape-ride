# Esxape Monorepo (Admin + Game)

This repo hosts two Next.js apps:

- `apps/admin` — Admin console to create games, missions, power-ups, and map.
- `apps/game`  — Player-facing game that reads the published JSON from `public/games/...`.

## Vercel projects

Create **two** Vercel projects pointing to this GitHub repo:

1) **Admin project**
   - Root Directory: `apps/admin`
   - Framework Preset: Next.js
   - Environment Variables:
     - `REPO_OWNER`, `REPO_NAME`, `GITHUB_TOKEN` — used for saving/reading JSON in GitHub
     - `BASIC_AUTH_USER`, `BASIC_AUTH_PASS` — for simple basic auth (middleware.js)
     - `NEXT_PUBLIC_GAME_ORIGIN` — set to your game domain, e.g. `https://esxaperide.com`

2) **Game project**
   - Root Directory: `apps/game`
   - Framework Preset: Next.js
   - No special env vars required (optional: `NEXT_PUBLIC_DEFAULT_SLUG`)
   - Build copies data from `apps/admin/public/` into `apps/game/public/` so the game can read `/games/<slug>/...`

## Local dev
- Install once from monorepo root: `npm i`
- Then you can run each app:
  - `cd apps/admin && npm run dev`
  - `cd apps/game  && npm run dev`
