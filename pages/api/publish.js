// pages/api/publish.js
// Admin is at repo root. Publish now mirrors to game/public/games/<slug> in the same commit.
// Falls back from draft -> published if draft is empty.
import { readJson, bulkCommitMixed, joinPath } from '../../lib/github.js';

const pretty = obj => JSON.stringify(obj, null, 2) + '\n';

async function readPair(base) {
  const cfg = await readJson(joinPath(base, 'config.json'));
  const mis = await readJson(joinPath(base, 'missions.json'));
  return { cfg, mis };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { slug } = req.body || {};
    if (!slug || typeof slug !== 'string') return res.status(400).json({ error: 'Missing slug' });

    // 1) Try draft
    const draftBase = joinPath('public/games', slug, 'draft');
    let { cfg, mis } = await readPair(draftBase);

    // 2) Fall back to already-published if draft missing
    if (!cfg && !mis) {
      const pubBase = joinPath('public/games', slug);
      const r = await readPair(pubBase);
      cfg = r.cfg; mis = r.mis;
    }

    if (!cfg && !mis) {
      return res.status(400).json({ ok:false, error: 'Nothing to publish (no draft or published content found)' });
    }

    // 3) Write Admin published AND mirror to Game public
    const files = [];
    if (cfg) {
      files.push({ path: joinPath('public/games', slug, 'config.json'), content: pretty(cfg) });
      files.push({ repoPath: joinPath('game/public/games', slug, 'config.json'), content: pretty(cfg) });
    }
    if (mis) {
      files.push({ path: joinPath('public/games', slug, 'missions.json'), content: pretty(mis) });
      files.push({ repoPath: joinPath('game/public/games', slug, 'missions.json'), content: pretty(mis) });
    }

    const commit = await bulkCommitMixed(files, `publish ${slug} (+ mirror to game/)`);
    return res.status(200).json({ ok:true, slug, wrote: files.map(f => f.repoPath || f.path), commitUrl: commit.htmlUrl });
  } catch (err) {
    console.error('publish error:', err);
    return res.status(500).json({ ok:false, error: String(err?.message || err) });
  }
}
