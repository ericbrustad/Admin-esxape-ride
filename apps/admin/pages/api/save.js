// apps/admin/pages/api/save.js
import { upsertJson, joinPath } from '../../lib/github';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { slug, config, missions, channel = 'published' } = req.body || {};
    if (!slug || typeof slug !== 'string') return res.status(400).json({ error: 'Missing slug' });

    // Paths under monorepo base: apps/admin/public/games/<slug>/(draft/)?*.json
    const base = channel === 'draft'
      ? joinPath('public/games', slug, 'draft')
      : joinPath('public/games', slug);

    const results = [];
    if (config) {
      results.push(await upsertJson(joinPath(base, 'config.json'), config, `save(config): ${slug} [${channel}]`));
    }
    if (missions) {
      results.push(await upsertJson(joinPath(base, 'missions.json'), missions, `save(missions): ${slug} [${channel}]`));
    }

    return res.status(200).json({ ok: true, results });
  } catch (err) {
    console.error('save error:', err);
    return res.status(500).json({ error: String(err && err.message || err) });
  }
}
