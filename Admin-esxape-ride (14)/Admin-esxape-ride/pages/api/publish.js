// pages/api/publish.js
import { readJson, bulkCommitMixed, joinPath } from '../../lib/github.js';

const pretty = obj => JSON.stringify(obj, null, 2) + '\n';

// read pair (config + missions) from a base path (returns objects or null)
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
    const legacy = isLegacySlug(rawSlug);
    const slug = legacy ? '' : String(rawSlug).trim();

    // Candidate paths to check (ordered)
    const candidates = [];
    if (!legacy) {
      candidates.push(joinPath('public/games', slug, 'draft'));
      candidates.push(joinPath('public/games', slug));
    }
    candidates.push(joinPath('public', 'draft'));
    candidates.push('public');

    let usedBase = null;
    let cfg = null;
    let mis = null;

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

    // If we have a config but no missions, create a safe empty missions file
    if (cfg && !mis) {
      mis = { missions: [] };
    }

    // Ensure we always write both files in the published destination
    const files = [];

    // Admin destination: published path (if sluged) or public root for legacy
    const adminDest = legacy ? 'public' : joinPath('public/games', slug);

    if (cfg) {
      files.push({ path: joinPath(adminDest, 'config.json'), content: pretty(cfg) });
      if (!legacy) files.push({ repoPath: joinPath('game/public/games', slug, 'config.json'), content: pretty(cfg) });
    }
    if (mis) {
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
