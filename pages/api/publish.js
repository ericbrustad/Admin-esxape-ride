// pages/api/publish.js
import { readJson, bulkCommitMixed, joinPath } from '../../lib/github.js';

const pretty = obj => JSON.stringify(obj, null, 2) + '\n';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { slug } = req.body || {};
    if (!slug || typeof slug !== 'string') return res.status(400).json({ error: 'Missing slug' });

    const draftBase = joinPath('public/games', slug, 'draft');
    const cfg = await readJson(joinPath(draftBase, 'config.json'));
    const mis = await readJson(joinPath(draftBase, 'missions.json'));
    if (!cfg && !mis) return res.status(400).json({ ok: false, error: 'Nothing to publish (draft is empty)' });

    const files = [];
    if (cfg) {
      files.push({ path: joinPath('public/games', slug, 'config.json'), content: pretty(cfg) }); // Admin published
      files.push({ repoPath: joinPath('game/public/games', slug, 'config.json'), content: pretty(cfg) }); // Game mirror
    }
    if (mis) {
      files.push({ path: joinPath('public/games', slug, 'missions.json'), content: pretty(mis) });
      files.push({ repoPath: joinPath('game/public/games', slug, 'missions.json'), content: pretty(mis) });
    }

    const commit = await bulkCommitMixed(files, `publish ${slug} (+ mirror to game/)`);
    return res.status(200).json({ ok: true, slug, wrote: files.map(f => f.repoPath || f.path), commitUrl: commit.htmlUrl });
  } catch (err) {
    console.error('publish error:', err);
    return res.status(500).json({ ok:false, error: String(err?.message || err) });
  }
}
