Device & Response UI Package
----------------------------
## Update Log
- 2025-10-20 — Assigned media tag counts & focused protection toggle. Commit: (pending, see merge SHA).
  - Direct links: `components/AssignedMediaTab.jsx`, `components/MediaPool.jsx`, `components/InlineMissionResponses.jsx`, `pages/index.jsx`
  - Notes: Moves Media Pool tags into the Assigned Media cards with usage counts, shrinks the selected response thumbnails, and pares the Settings tab down to the Not Protected indicator plus the enable/disable button.
- 2025-10-19 — Game client SSR route guard + loading reset. Commit: e006dccf842fa581e545cf9701ffa1e37d01eede.
  - Direct link: `game/pages/index.jsx`
  - Notes: Prevents the Next.js export crash by deferring slug/channel resolution to the client, resetting mission data while loading, and reusing the existing backpack/setup flows without touching the admin layout structure.
- 2025-10-18 — Mission trigger layout refinements and media tag surfacing. Commit: a75859d56fc6271675b58153efcbee2e3263e982.
  - Direct links: `pages/index.jsx`, `components/InlineMissionResponses.jsx`, `components/AssignedMediaTab.jsx`
  - Notes: Aligns mission editor controls with Save/Reset/Cancel expectations, renames Action Trigger copy, surfaces response media thumbnails above selectors, and mirrors Media Pool tags inside the Assigned Media tab.
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
