Device & Response UI Package
----------------------------
## Update Log
- 2025-10-14 — Admin password switch locked off in UI & API. Commit: abdaadb670605dda0912e29d49f6ab1e7fdfc799.
  - Direct link: `pages/api/admin-protection.js`
  - Direct link: `pages/index.jsx`
  - Notes: Forces admin protection endpoints to return a locked-off state and disables the dashboard toggle so the password switch stays off.
- 2025-10-15 — Export admin appearance helpers for UI theming. Commit: 26a69fd4208aed4fe0368bf62170261684299bb3.
  - Direct link: `lib/admin-shared.js`
  - Notes: Adds normalizeTone, appearanceBackgroundStyle, and surfaceStylesFromAppearance exports so the dashboard can theme itself without build warnings.
- 2025-10-13 — Admin password protection API fix. Commit: 6ff58c6ee5795a7ee78809f83e5d6b0ffa597ead.
  - Direct link: `pages/api/admin-protection.js`
  - Notes: Restores the admin password toggle endpoint and always keeps the game password state off.

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
