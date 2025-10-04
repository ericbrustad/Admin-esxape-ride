import { listDirs } from '../../../lib/github.js';

// Try configured base dir first; fall back to common monorepo / legacy locations.
async function listWithFallback() {
  // primary path
  const primary = await listDirs('public/games');
  if (primary.length) return primary;

  // fallback monorepo (in case BASE_DIR wasn't set)
  try {
    const alt = await listDirs('apps/admin/public/games');
    if (alt.length) return alt;
  } catch {}
  // legacy single-app root
  try {
    const legacy = await listDirs('public/games');
    if (legacy.length) return legacy;
  } catch {}

  return [];
}

export default async function handler(_req, res) {
  try {
    const slugs = await listWithFallback();
    res.status(200).json({ slugs });
  } catch (err) {
    console.error('games list error:', err);
    res.status(500).json({ error: String(err?.message || err) });
  }
}
