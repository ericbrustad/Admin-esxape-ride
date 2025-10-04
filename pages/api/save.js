// pages/api/save.js
// Uses bulkCommitMixed to write draft (and optional published) + mirror to /game/public/games/<slug>/draft
import { joinPath, bulkCommitMixed } from '../../lib/github.js';

const pretty = obj => JSON.stringify(obj, null, 2) + '\n';

function isLegacy(slug) {
  const s = String(slug || '').trim().toLowerCase();
  return s === '' || s === '(legacy root)' || s === 'legacy-root' || s === 'root';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const slug = body.slug;
    const config = body.config;
    const missions = body.missions;
    const channel = body.channel || 'draft'; // default to draft saves
    if (!slug && !isLegacy(slug)) return res.status(400).json({ ok:false, error: 'Missing slug' });

    // determine base dir(s)
    let adminBase, gameBase;
    if (isLegacy(slug)) {
      adminBase = channel === 'draft' ? joinPath('public', 'draft') : 'public';
      gameBase = null; // legacy root mirroring not supported for game root
    } else {
      adminBase = channel === 'draft' ? joinPath('public/games', slug, 'draft') : joinPath('public/games', slug);
      gameBase = joinPath('game/public/games', slug, channel === 'draft' ? 'draft' : '');
    }

    const files = [];
    if (config) {
      files.push({ path: joinPath(adminBase, 'config.json'), content: pretty(config) });
      if (gameBase) files.push({ repoPath: joinPath(gameBase, 'config.json'), content: pretty(config) });
    }
    if (missions) {
      files.push({ path: joinPath(adminBase, 'missions.json'), content: pretty(missions) });
      if (gameBase) files.push({ repoPath: joinPath(gameBase, 'missions.json'), content: pretty(missions) });
    }

    if (!files.length) return res.status(400).json({ ok:false, error: 'Nothing to save' });

    // Single commit for all files
    const commit = await bulkCommitMixed(files, `save ${slug || 'root'} [${channel}]`);
    return res.status(200).json({ ok:true, wrote: files.map(f => f.repoPath || f.path), commitUrl: commit.htmlUrl });
  } catch (err) {
    console.error('save error:', err);
    return res.status(500).json({ ok:false, error: String(err?.message || err) });
  }
}
