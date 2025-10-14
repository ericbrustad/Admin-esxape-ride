Branch work — 2025-10-14 21:27:31Z
Device & Response UI Package
----------------------------
## Update Log
- 2025-10-14 — Save & Publish polish + mission/media crash fix. Commit: 9070d1e1f29cd810a96624809cc1d449a2f352bf.
  - Direct link: `pages/index.jsx`
  - Notes: Locks the main header action to “Save & Publish” with a live cover thumbnail, rebuilds the Game Settings cover picker with drag & drop/upload/media pool options alongside the title, and adds defensive mission plus assigned-media logic to eliminate the client-side exception while data is loading.
- 2025-10-14 — Admin deck header realignment & crash guards. Commit: f2d360052ce8e62c7d763e0d5cee3f734a5765d8.
  - Direct link: `pages/index.jsx`
  - Notes: Moves SETTINGS/MISSIONS/DEVICES/TEXT/ASSIGNED MEDIA/MEDIA POOL and the 💾 Save control beside the Admin Control Deck
    heading, removes the "View missions.json" shortcut, and hardens mission creation plus Assigned Media interactions against
    null-config crashes.
- 2025-10-14 — Assigned media tagging & mission header adjustments. Commit: 9f79b6d3fa3dbe6560da34d9d37f77d3e1d4be5f.
  - Direct links: `components/AssignedMediaTab.jsx`, `components/MediaPool.jsx`, `pages/index.jsx`
  - Notes: Surfaced media tags within the Assigned Media tab (for icons, devices, rewards, and penalties), hardened tag lookups to eliminate the browser error in the assigned media view, and moved the mission title input into the overlay header while keeping the mission ID read-only next to Save & Close.
- 2025-10-14 — Assigned media theming + usage counters polish. Commit: 106ba00d859442d0b4e9add2dd76b53ef16121ab.
  - Direct links: `components/AssignedMediaTab.jsx`, `components/MediaPool.jsx`
  - Notes: Swapped the assigned-media overview and media pool cards to rely on global appearance variables, added per-section item/use totals, and ensured media previews only render when a file is actually in use (with safety guards on the Open action).
- 2025-10-14 — Mission/device editors and assigned media summary refresh. Commit: 1ef03a49facc444ce13b37412e076e9dd2e585d9.
  - Direct links: `pages/index.jsx`, `components/AssignedMediaTab.jsx`
  - Notes: Added floating Save/Cancel controls to mission and device editors, introduced a header cover-image window with drag/drop/import options, and moved media usage counts into the Assigned Media tab with per-type summaries.
- 2025-10-17 — Set Starfield Dawn as default admin skin and bump package version. Commit: 4fb54669263a320fa227306c4bf9b25e35f910dc.
  - Direct links: `pages/index.jsx`, `lib/admin-shared.js`, `package.json`
  - Notes: Aligns default UI loadout with the Starfield Dawn preset from branch codex/update-admin-ui-skins-with-textures-huhqvs and increments the package version to 1.2.1 so downstream bundles catch the theme refresh.
- 2025-10-16 — Device editor map controls realignment. Commit: 974ddf67a4a52d773578de28d015c9ff6f455f64.
  - Direct link: `pages/index.jsx`
  - Notes: Keeps the device radius slider and ring selector anchored above the map while grouping Save, Cancel, and Close in the editor header.
- 2025-10-13 — Admin password protection API fix. Commit: 6ff58c6ee5795a7ee78809f83e5d6b0ffa597ead.
  - Direct link: `pages/api/admin-protection.js`
  - Notes: Restores the admin password toggle endpoint and always keeps the game password state off.
- 2025-10-14 — Admin UI theme helpers + assets. Commit: 860691231af6542e34489ab4cd7ef64fcae63634.
  - Direct link: `lib/admin-shared.js`
  - Direct link: `public/media/skins/`
  - Notes: Re-exports tone helpers so the admin password switch loads without build errors and ships the 12 themed skin backgrounds so the default skin stays legible while the game-side password remains disabled.
- 2025-10-15 — Admin basic auth obeys toggle. Commit: b9d9bbffb5254cbd710aa5545454370d4ec1cb48.
  - Direct link: `middleware.js`
  - Notes: Middleware now checks `/admin-protection.json` before challenging, allowing the password switch to disable prompts while keeping caching for quick reads.

Files included (drop into your Next.js project or use as reference):

/components
  - DevicesList.jsx            // Updated device list with up/down, full-row select, thumbnail, inline editor with Trigger ticker & target dropdown
  - InlineMissionResponses.jsx // Updated mission response editor with "Mark as Trigger" switch and preview badge
  - MissionListItem.jsx        // Small mission list item that displays response marker and thumbnail

AppDemo.jsx                   // Simple demo usage of components (not part of your app; for reference)

How to use:
- Copy files into your project's components/ folder.
- Import DevicesList where you render the Device sidebar.
  Example: import DevicesList from '../components/DevicesList'
- Import InlineMissionResponses where you manage mission editor responses.
  Example: import InlineMissionResponses from '../components/InlineMissionResponses'

Notes:
- The components are intentionally self-contained and use inline styles for easy drop-in.
- They expect the parent to handle persistence (saving to missions.json/config).
- The 'Trigger Target' dropdown uses a `triggerDevices` prop; if empty it shows 'None available'.
- The DevicesList inline editor provides a 'Triggered Device (ticker)' input per your request.

If you want, I can:
- Integrate these components into your actual pages/index.jsx and wire up your existing state/handlers.
- Convert styles to your project's theme or CSS modules.
- Add accessible keyboard support for reordering and selection.
