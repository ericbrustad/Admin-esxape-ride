# 002-Master — 2025-10-14 17:35 UTC

> Please review this README for update details before making additional changes.

## Summary
- Password protection notification visibility is now managed within the settings configuration so it only surfaces on the settings screen.
- Reward media icons have been reclassified as assigned media tags, matching the handling of other tag-based assets.
- Default toggles for the game folder and password protection remain off to reflect the current administrative requirements.

## Configuration Updates
- **Settings relocation:** Added a `settings.passwordProtection` block with `enabled` defaulted to `false` and a `notificationVisibility` flag set to `"settings-only"` in both `public/draft/config.json` and `public/games/default/draft/config.json`.
- **Game folder state:** Introduced explicit `game.folderEnabled` and `settings.gameFolder.enabled` flags, both defaulting to `false`.

## Media Tag Adjustments
- Reward icons were moved from the media pool into `media.assigned.tagKeys`, ensuring the assigned media tab sources those assets just like other tags.
- The icon catalog now exposes reward icons inside `icons.tags` with a `type` of `reward` so they can be reused consistently by any tag-aware UI.

## References
- Direct link (draft config): `public/draft/config.json`
- Direct link (default game draft config): `public/games/default/draft/config.json`
- Commit reference: `HEAD (branch 002-Master)` — run `git rev-parse HEAD` after pulling to capture the precise SHA for archival records.

## Maintenance Notes
- These changes fulfill the requirement to keep the password toggle and game folder disabled by default.
- Test and debug the admin interface after syncing to confirm no warnings appear outside of settings for password protection.
- For future updates, retain this README at the top level and append new dated sections so that update history remains sequential.
