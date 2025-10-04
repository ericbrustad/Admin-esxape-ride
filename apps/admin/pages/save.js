// apps/admin/pages/api/save.js
import { upsertJson, joinPath } from '../../lib/github.js';

function isLegacyRoot(slug) {
  const v = String(slug ?? '').trim().toLowerCase();
  return v === '' || v === '(legacy root)' || v === 'legacy-root' || v === 'root';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { slug, config, missions, channel = 'published' } = req.body || {};
    const legacy = isLegacyRoot(slug);

    // Target base dir
    let base;
    if (legacy) {
      base = channel === 'draft' ? joinPath('public', 'draft') : 'public'; // legacy support
    } else {
      if (!slug || typeof slug !== 'string') return res.status(400).json({ error: 'Missing slug' });
      base = channel === 'draft'
        ? joinPath('public/games', slug, 'draft')
        : joinPath('public/games', slug);
    }

    const results = [];
    if (config)   results.push(await upsertJson(joinPath(base, 'config.json'),   config,   `save(config): ${slug || 'root'} [${channel}]`));
    if (missions) results.push(await upsertJson(joinPath(base, 'missions.json'), missions, `save(missions): ${slug || 'root'} [${channel}]`));

    return res.status(200).json({ ok: true, results });
  } catch (err) {
    console.error('save error:', err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
