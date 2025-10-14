# Esxape Ride — Project Memory

(Last updated: 2025-10-14)

## Architecture
- Repo: Admin-esxape-ride
- Admin at repo root (Vercel: admin-esxape-ride)
- Game in /game (Vercel: game-esxape-ride)
- Admin ENV: NEXT_PUBLIC_GAME_ORIGIN=https://game.esxaperide.com, GITHUB_* (owner, name, branch=main, token, base_dir='')
- Game ENV: may use NEXT_PUBLIC_GAME_ORIGIN for own links
- Game mirroring can be toggled in the repo's `.env` file. Leave `GAME_ENABLED`/`NEXT_PUBLIC_GAME_ENABLED` at `0` (default) to keep the mirror off, or set them to `1` when you intentionally sync to /game.
- Deployment: `.vercelignore` keeps the /game app out of builds until you remove or edit the guard.

## Save / Publish
- Save All -> Admin draft only:
  public/games/<slug>/draft/{missions.json, config.json}
- Publish -> makes live + writes to Game:
  Admin: public/games/<slug>/{missions.json, config.json}
  Game:  game/public/games/<slug>/{missions.json, config.json}
- Handles 409 with retry; shows "Saving…" and redeploy notes

## Media (global pool)
- Binary assets are no longer committed. The media folders exist with README placeholders so GitHub deployments stay lightweight.
- When you need real art, upload via the admin interface or commit your own files under `public/media` and `game/public/media` before enabling the game mirror.
- Placeholder URLs (https://placehold.co) are injected into configs so editors render without 404s.
- Drag & drop + chooser remain supported for new uploads.
- "Key" column = human-readable statement of what pin the icon is for.

### Default bundles
- The historic bundle metadata remains in configs but now points at https://placehold.co placeholders.
- Provide your own PNG/JPG assets when you're ready to brand the experience.

## Missions
- Types: multiple_choice, short_answer, statement, video, geofence_image, geofence_video, ar_image, ar_video, stored_statement
- stored_statement: template with #mXX# tags to insert prior answers
- short_answer: “Also Accept” may be blank
- Correct/Wrong tickers: image/video/gif/statement (+optional audio)
  - Correct: can deploy Reward device or Clue
  - Wrong: can deploy Punishment device or time delay
- Photo Opportunity mission: statement + camera with overlay from /media/overlays; saves to Photos pocket

## Map & Devices
- Overview map: missions + devices on one map
- Click behavior:
  - placing new device -> set its location
  - selected device -> move it
  - none selected -> move nearest pin
- Address search (Nominatim), radius slider, duplicate/delete
- Pins numbered by order; icons from Media icon lists
- Device edit panel shows thumbnail left of title

## Backpack
- Pockets: Video, Audio, Rewards, Utilities (Devices), Photos
- Items have thumbnail + title; can preview, use/remove

## Data stored
- Splash: first name, last name, email, cell
- Gameplay: Q/A, points, items collected, stored values, photos
- For end-game email/SMS and later marketing

## UI invariants
- Look stays the same
- Mission editor overlay on right, Close & Save at top and bottom
- Missions list on left with numbering, arrows, duplicate, delete
- Test tab with iframe + open full window
- Appearance controls: font, sizes, colors, opacities, bg image, alignments (default vertical top)

## Deploy feedback & errors
- "Saving…" with short delay to cover redeploy window
- Auto-retry on 409 ETag mismatch


## Recent Updates
- 2025-10-13 — Added Mission 004: Riverfront Relay sample scenario mirrored in `public/games/004` and `game/public/games/004`.
  Includes new scavenger-hunt style missions and adventure-themed config for testing multi-stop flows.
