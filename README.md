# work branch – 2025-10-14 23:19 UTC

> Please review this README for update history and direct resource links.

## Update Log
- **Note:** Resolved mission editor crashes by initializing assigned media structures, normalizing acceptable answers, and providing empty attachments for new missions. Applied the same safety defaults to the default game bundle.
  - **Files:** `public/draft/missions.json`, `public/games/default/draft/missions.json`
  - **Update SHA:** `HEAD` (use `git rev-parse HEAD` to capture the specific hash after pulling)
  - **Direct Link:** `public/draft/missions.json`
- **Note:** Disabled game folder and password toggles by default across bundle configs to match current requirements.
  - **Files:** `public/draft/config.json`, `public/games/default/draft/config.json`
  - **Update SHA:** `HEAD`
  - **Direct Link:** `public/draft/config.json`
- **Note:** Added a media pool placeholder directory so assigned media tabs load without filesystem errors.
  - **Files:** `public/media/mediapool/.gitkeep`
  - **Update SHA:** `HEAD`
  - **Direct Link:** `public/media/mediapool/`

## Locating These Updates
- Mission definitions: `public/draft/missions.json`
- Default bundle missions: `public/games/default/draft/missions.json`
- Bundle configuration defaults: `public/draft/config.json`
- Media pool directory: `public/media/mediapool/`

