# Admin-esxape-ride — Full Admin Build (Next.js)

This is a **complete** Admin app you can deploy to Vercel.

## What’s inside

- Next.js 14 (pages router), fully **client-only** admin UI to avoid SSR issues.
- **TEST** tab with a persistent **Game origin** field and mixed-content warning.
- **MAP** tab (react-leaflet) that shows missions/powerups with `lat`,`lng` (+ radius rings).
- Mission **re-ordering** (↑ / ↓) and **custom appearance** editor with full font/color dropdowns.
- GitHub API routes (`/api/games`, `/api/save`, `/api/publish`, `/api/load`) using **single-commit** writes to reduce deploy churn.

## Required environment variables (Vercel → Admin project)

- `REPO_OWNER` — your GitHub user/org
- `REPO_NAME` — repository name (this repo)
- `GITHUB_TOKEN` — token with **Contents: Read & write** permission to this repo
- `GITHUB_BRANCH` — branch to write to (e.g., `main`)
- `GITHUB_BASE_DIR` — base path for this app in the repo; set to empty string if this project is at repo root; set to `apps/admin` if it lives there
- `NEXT_PUBLIC_GAME_ORIGIN` — (optional) default Game domain; can be overridden in the TEST tab

## Local dev

```bash
npm i
npm run dev
```

## Deploy (Vercel)

Create a Vercel project pointing to this repo (root directory = repo root). Add the env vars above, then deploy.

