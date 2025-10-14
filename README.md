work branch - 2025-10-14 02:10:53 UTC

# Operations README
- **Review this README before making any changes or deployments.**
- Confirm the switch toggle remains OFF after every maintenance window.

## Switch Toggle Control
- Configuration file: `config/toggle.json`
- Password: `AR-Toggle-Guard-2025!`
- Default state: **Off**
- Verification: Integrity check completed and confirmed OFF prior to this update.
- Reminder: Leave the switch OFF unless an authorized override is in effect.

## Browser Load Remediation
- All tracked dependencies are text-based JavaScript packages; no binary assets are included.
- Follow the non-binary AR dependency guidance in `docs/ar-dependencies.md` to keep the experience stable.
- `.npmrc` enforces `optional=false` so optional binaries like `canvas` are never downloaded during installs.
- Ensure Node.js 20+ and npm 9+ are available before installing dependencies so peer checks succeed without rebuild attempts.
- If the browser fails to load, re-validate that only the listed packages are installed and rebuild the client bundle.

## Game Folder Status
- Target folder: `Game`
- Operational mode: **Off** (see `config/game/settings.json`).
- Do not enable the Game folder until AR QA approves the release.

## Update Log
- 2025-10-14 01:06 UTC: Switch toggle password confirmed, game folder set to off, and AR dependency guidance documented. Commit: `8ad5275`. Reference: `config/toggle.json`, `config/game/settings.json`, `docs/ar-dependencies.md`.
- 2025-10-14 01:11 UTC: Locked `mind-ar` dependency to an available release to restore install reliability. Commit: `959fde5`. Reference: `package.json`, `docs/ar-dependencies.md`. Branch: `work`.
- 2025-10-14 01:18 UTC: Repointed the `mind-ar` dependency to the pure JavaScript `mind-ar-js` alias to bypass the binary `canvas` build failure encountered during deployment. Commit: `d555437`. Reference: `package.json`, `docs/ar-dependencies.md`. Deployment note: See `docs/ar-dependencies.md` for the alias install command.
- 2025-10-14 01:25 UTC: Restored the official `mind-ar` package at `^1.2.2`, pinned React 18.2 peer dependencies, and set minimum Node/npm versions to keep installs compatible with the build environment. Commit: `c99f41a`. Reference: `package.json`, `docs/ar-dependencies.md`, `config/toggle.json`, `config/game/settings.json`.
- 2025-10-14 01:34 UTC: Locked `@react-three/fiber` to `^8.15.17` so React 18.2 remains compatible with Expo tooling, reconfirmed the switch/Game OFF status, and updated AR dependency guidance. Commit: `fbe6560`. Reference: `package.json`, `docs/ar-dependencies.md`, `config/toggle.json`, `config/game/settings.json`.
- 2025-10-14 01:45 UTC: Disabled optional dependency downloads with `.npmrc`, revalidated OFF states, and expanded AR guidance with install guardrails. Commit: `(detailed in prior deployment logs)`. Reference: `.npmrc`, `README.md`, `docs/ar-dependencies.md`, `config/toggle.json`, `config/game/settings.json`.
- 2025-10-14 01:51 UTC: Introduced a local `canvas` stub override to prevent native builds, updated AR guidance, and revalidated OFF states post-override. Commit: `(previous HEAD)`. Reference: `package.json`, `stubs/canvas/`, `docs/ar-dependencies.md`, `config/toggle.json`, `config/game/settings.json`, `README.md`.
- 2025-10-14 02:00 UTC: Added `next@^14.2.5` to align with Vercel's framework detection, refreshed AR guidance, and reconfirmed switch/Game OFF states. Commit: `"Add Next dependency for Vercel detection" (current HEAD)`. Reference: `package.json`, `docs/ar-dependencies.md`, `config/toggle.json`, `config/game/settings.json`, `README.md`.
- 2025-10-14 02:10:53 UTC: Established a minimal Next.js app structure with operations dashboard, documented build alignment, and reconfirmed OFF safeguards. Commit: 48cfa9f. Reference: app/, package.json, .eslintrc.json, docs/ar-dependencies.md, config/*.json.
> **Reminder:** Review this README after pulling updates to confirm switch status and dependency references.

## Reference Links
- Repository path: `/workspace/Admin-esxape-ride`
- Branch: `work` (PR: new submission)
- Direct link to branch: `https://github.com/ericbrustad/Admin-esxape-ride/tree/work`
- Toggle configuration: `config/toggle.json`
- Game settings: `config/game/settings.json`
- AR dependency guidance: `docs/ar-dependencies.md`
