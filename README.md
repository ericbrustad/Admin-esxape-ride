work - 2025-10-14 01:06:13 UTC

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
- If the browser fails to load, re-validate that only the listed packages are installed and rebuild the client bundle.

## Game Folder Status
- Target folder: `Game`
- Operational mode: **Off** (see `config/game/settings.json`).
- Do not enable the Game folder until AR QA approves the release.

## Update Log
- 2025-10-14: Switch toggle password confirmed, game folder set to off, and AR dependency guidance documented. Commit: `8ad5275`.

## Reference Links
- Repository path: `/workspace/Admin-esxape-ride`
- Branch: `work`
- Toggle configuration: `config/toggle.json`
- Game settings: `config/game/settings.json`
- AR dependency guidance: `docs/ar-dependencies.md`
