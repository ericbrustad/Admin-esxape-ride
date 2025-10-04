import { bulkCommit, joinPath } from '../../lib/github.js';

function isLegacyRoot(slug) {
  const v = String(slug ?? '').trim().toLowerCase();
  return v === '' || v === '(legacy root)' || v === 'legacy-root' || v === 'root';
}
const pretty = obj => JSON.stringify(obj, null, 2) + '\n';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { slug, config, missions, channel = 'published' } = req.body || {};
    const legacy = isLegacyRoot(slug);

    let base;
    if (legacy) {
      base = channel === 'draft' ? joinPath('public', 'draft') : 'public';
    } else {
      if (!slug || typeof slug !== 'string') return res.status(400).json({ error: 'Missing slug' });
      base = channel === 'draft' ? joinPath('public/games', slug, 'draft') : joinPath('public/games', slug);
    }

    const files = [];
    if (config)   files.push({ path: joinPath(base, 'config.json'),   content: pretty(config) });
    if (missions) files.push({ path: joinPath(base, 'missions.json'), content: pretty(missions) });
    if (!files.length) return res.status(400).json({ error: 'Nothing to save' });

    const commit = await bulkCommit(files, `save ${legacy ? 'root' : slug} [${channel}]`);
    return res.status(200).json({ ok: true, slug: legacy ? '(root)' : slug, channel, wrote: files.map(f => f.path), commitUrl: commit.htmlUrl });
  } catch (err) {
    console.error('save error:', err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
