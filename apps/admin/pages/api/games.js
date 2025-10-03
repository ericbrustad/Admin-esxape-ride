// apps/admin/pages/api/games.js
import { listDirs } from '../../lib/github';

export default async function handler(_req, res) {
  try {
    // Under monorepo base: apps/admin/public/games/
    const slugs = await listDirs('public/games');
    return res.status(200).json({ slugs });
  } catch (err) {
    console.error('games error:', err);
    return res.status(500).json({ error: String(err && err.message || err) });
  }
}
