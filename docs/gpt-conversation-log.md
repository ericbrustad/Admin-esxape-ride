# Operator ↔ GPT Debug Log

**Timestamp:** 2025-10-21T02:57:59Z

**You:** I'm seeing an "React has detected a change in the order of Hooks" warning when the admin dashboard loads. What steps should I take to fix this safely?

**GPT:** Ensure that hooks are called in the same order on every render. Avoid returning early before later hooks run or placing hooks inside conditional branches. Refactor any new logic (for example, replacing a `useMemo` added inside a conditional render with a derived value or moving it above the guard) so that the hook call sequence stays stable across renders.
