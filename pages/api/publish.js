// pages/api/publish.js
import { readJson, bulkCommitMixed, joinPath } from '../../lib/github.js';

const pretty = obj => JSON.stringify(obj, null, 2) + '\n';

// try to read config+missions from a base path
async function readPair(base) {
  const cfg = await readJson(joinPath(base, 'config.json'));
  const mis = await readJson(joinPath(base, 'missions.json'));
  return { cfg, mis };
}

function isLegacySlug(s) {
  const v = String(s || '').trim().toLowerCase();
  return !v || v === '(legacy root)' || v === 'legacy-root' || v === 'root';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { slug: rawSlug } = req.body || {};
    const slugProvided = !!rawSlug;
    const legacy = isLegacySlug(rawSlug);
    const slug = legacy ? '' : String(rawSlug).trim();

    // Candidate paths to check, in order:
    // 1) public/games/<slug>/draft
    // 2) public/games/<slug>          (published fallback)
    // 3) public/draft                 (legacy root draft)
    // 4) public                       (legacy root published)
    const candidates = [];

    if (!legacy) {
      candidates.push(joinPath('public/games', slug, 'draft'));
      candidates.push(joinPath('public/games', slug));
    }
    // legacy (or fallback)
    candidates.push(joinPath('public', 'draft'));
    candidates.push('public');

    let usedBase = null;
    let cfg = null, mis = null;

    for (const base of candidates) {
      const r = await readPair(base);
      if (r.cfg || r.mis) {
        usedBase = base;
        cfg = r.cfg;
        mis = r.mis;
        break;
      }
    }

    if (!cfg && !mis) {
      return res.status(404).json({ ok:false, error: 'No draft or published content found at any expected path', tried: candidates });
    }

    // Prepare files to write: Admin published (public/games/slug) + mirror into game/public/games/slug
    const files = [];
    if (cfg) {
      // destination under admin published path (if we have a slug) else write to root public
      const adminDest = legacy ? 'public' : joinPath('public/games', slug);
      files.push({ path: joinPath(adminDest, 'config.json'), content: pretty(cfg) });
      // always mirror into game/public/games/<slug> if slug exists
      if (!legacy) files.push({ repoPath: joinPath('game/public/games', slug, 'config.json'), content: pretty(cfg) });
    }
    if (mis) {
      const adminDest = legacy ? 'public' : joinPath('public/games', slug);
      files.push({ path: joinPath(adminDest, 'missions.json'), content: pretty(mis) });
      if (!legacy) files.push({ repoPath: joinPath('game/public/games', slug, 'missions.json'), content: pretty(mis) });
    }

    const commit = await bulkCommitMixed(files, `publish ${legacy ? '(root)' : slug} (+ mirror to game/)`);

    return res.status(200).json({
      ok: true,
      slug: legacy ? '(root)' : slug,
      usedBase,
      wrote: files.map(f => f.repoPath || f.path),
      commitUrl: commit.htmlUrl,
    });

  } catch (err) {
    console.error('publish error:', err);
    return res.status(500).json({ ok:false, error: String(err?.message || err) });
  }
}
