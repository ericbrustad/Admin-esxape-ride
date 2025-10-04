// pages/api/load.js
import { readJson, joinPath } from '../../src/lib/github';

export default async function handler(req, res) {
  try {
    const { slug = '', channel = 'published' } = req.query;
    let base;
    if (!slug || slug === '(legacy root)' || slug === 'root') {
      base = channel === 'draft' ? joinPath('public', 'draft') : 'public';
    } else {
      base = channel === 'draft' ? joinPath('public/games', slug, 'draft') : joinPath('public/games', slug);
    }
    const config = await readJson(joinPath(base, 'config.json'));
    const missions = await readJson(joinPath(base, 'missions.json'));
    res.status(200).json({ ok: true, config, missions });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
