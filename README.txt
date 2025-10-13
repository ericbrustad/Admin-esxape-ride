Admin Security Toggle
---------------------
- Set `ADMIN_PASSWORD_PROTECTED=0` (default) or `1` inside your environment configuration to control whether Basic Auth is required on first load.
- The admin header now includes a "Protected" indicator and toggle. When enabled it writes to `public/admin-protection.json` so the middleware immediately enforces passwords across the UI.
- Toggling requires valid Basic Auth credentials and mirrors the state into `game/public/admin-protection.json` for parity with the game bundle.

Device & Response UI Package
----------------------------
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

Update Notes
------------
- Commit `da75336` restored the admin device editor controls (Save & Close for new devices plus top-right Cancel/Close buttons)
  and confirms skins, themes, and password toggle options remain available. Direct link: `pages/index.jsx` in this repository.
- Commit `a3d8f08` records mission saves in the undo/redo history so edits can be reverted immediately after saving. Direct link:
  `pages/index.jsx` → `saveToList` in this repository.
- Commit `390ad54` adds local filesystem fallbacks for `/api/config` and `/api/games`, removes the duplicate `pages/index.js`
  entry, and fixes the admin hook order so the panel no longer crashes when data finishes loading. Direct links: `pages/api/config.js`,
  `pages/api/games.js`, and `pages/index.jsx`.
