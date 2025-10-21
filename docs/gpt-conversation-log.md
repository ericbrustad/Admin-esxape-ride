# Operator ↔ GPT Debug Log

**Timestamp:** 2025-10-21T02:57:59Z

**You:** I'm seeing an "React has detected a change in the order of Hooks" warning when the admin dashboard loads. What steps should I take to fix this safely?

**GPT:** Ensure that hooks are called in the same order on every render. Avoid returning early before later hooks run or placing hooks inside conditional branches. Refactor any new logic (for example, replacing a `useMemo` added inside a conditional render with a derived value or moving it above the guard) so that the hook call sequence stays stable across renders.

---

**Timestamp:** 2025-10-21T09:52:41Z

**You:** Can you locate every binary file in the project and give me a GitHub-friendly workaround for managing them?

**GPT:** Inventoried all tracked binaries with a new `npm run list:binaries` helper, published the file list in `docs/binary-asset-guide.md`, and documented a Git LFS-based workflow plus `.gitattributes` guards to keep media assets manageable on GitHub.

---

**Timestamp:** 2025-10-21T12:08:00Z

**You:** The binary audit isn't enough—ensure no new binaries are committed and explain how to keep any required media hidden from GitHub.

**GPT:** Added an allowlisted inventory with failing verification scripts, expanded the binary guide with external-storage workflows, and deduplicated the settings snapshot so repo metadata stays at the bottom of the page.
---

**Timestamp:** 2025-10-21T15:30:00Z

**You:** Remove every tracked binary asset, restructure the media pool so uploads route into the right type (with an "Other" tab), and log repository metadata at the bottom of Settings after verifying the app.

**GPT:** Purged PNG/SVG/MP3 assets from git, replaced them with a manifest-driven media catalog that highlights external or missing files, rewired `/api/list-media` and the upload API to rely on text metadata, and ensured the Settings snapshot keeps repo, branch, commit, deployment, and timestamps anchored at the footer.
