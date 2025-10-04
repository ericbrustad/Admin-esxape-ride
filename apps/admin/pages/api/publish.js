import { readJson, bulkCommit, joinPath } from '../../lib/github.js';

function isLegacyRoot(slug) {
  const v = String(slug ?? '').trim().toLowerCase();
  return v === '' || v === '(legacy root)' || v === 'legacy-root' || v === 'root';
}
const pretty = obj => JSON.stringify(obj, null, 2) + '\n';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { slug } = req.body || {};
    const legacy = isLegacyRoot(slug);

    const src = legacy ? joinPath('public', 'draft') : joinPath('public/games', slug, 'draft');
    const dst = legacy ? 'public' : joinPath('public/games', slug);

    const cfg = await readJson(joinPath(src, 'config.json'));
    const mis = await readJson(joinPath(src, 'missions.json'));
    if (!cfg && !mis) return res.status(400).json({ ok: false, error: 'Nothing to publish (draft empty)' });

    const files = [];
    if (cfg) files.push({ path: joinPath(dst, 'config.json'),   content: pretty(cfg) });
    if (mis) files.push({ path: joinPath(dst, 'missions.json'), content: pretty(mis) });

    const commit = await bulkCommit(files, `publish ${legacy ? 'root' : slug}`);
    return res.status(200).json({ ok: true, slug: legacy ? '(root)' : slug, wrote: files.map(f => f.path), commitUrl: commit.htmlUrl });
  } catch (err) {
    console.error('publish error:', err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
