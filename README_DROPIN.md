# Toolchain Drop-in (Node 22 + pnpm 9) — 2025-10-23T17:52:29.148809Z

Place **all files** at the **repo root** (same folder as `pnpm-workspace.yaml` / `turbo.json`).

Files included:
- `.npmrc` — hardened registry/timeouts and engine strictness
- `.nvmrc` — pins Node 22.11.0
- `package.json` (root) — adds engines, packageManager, Volta pins, and `vercel:info`
- `tools/vercel-info.mjs` — prints Node/Corepack/pnpm during build (warns if Node < 22)

## Vercel settings (both Admin & Game projects)
Install Command:
```
npm run vercel:info && corepack disable || true && npm i -g pnpm@9.11.0 && pnpm -v && pnpm install --fetch-retries=5 --fetch-timeout=60000 --network-concurrency=1
```
Env vars:
```
NPM_CONFIG_REGISTRY = https://registry.npmjs.org/
NODE_OPTIONS        = --dns-result-order=ipv4first
```
Node.js Version: **22.x (LTS)**
Root Directory:
- Admin → `apps/admin`
- Game  → `apps/game-web`

Then Redeploy with **Clear build cache**.

## One code fix to apply in your repo
Open `apps/admin/pages/index.jsx` and change the ref lines:
```diff
- if (pnpmShimLoggedRef.current) return;
+ if (initialConversationLoggedRef.current) return;

...

- pnpmShimLoggedRef.current = true;
+ initialConversationLoggedRef.current = true;
```
