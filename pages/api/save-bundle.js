// pages/api/save-bundle.js
// Safely write missions.json + config.json (admin + game copies) in sequence
// to avoid GitHub 409 "expected <sha>" conflicts.

const owner  = process.env.REPO_OWNER;
const repo   = process.env.REPO_NAME;
const branch = process.env.GITHUB_BRANCH || 'main';
const token  = process.env.GITHUB_TOKEN;

async function ghJson(url, init = {}) {
  const r = await fetch(url, {
    ...init,
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      ...(init.headers || {}),
    },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (j && (j.message || j.error)) || `${r.status}`;
    throw new Error(`${r.status} ${msg}`);
  }
  return j;
}

async function getSha(path) {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
    const j = await ghJson(url, { method: 'GET' });
    return j.sha || null;
  } catch (e) {
    if (String(e.message || '').startsWith('404')) return null; // file doesn't exist yet
    throw e;
  }
}

async function putFile(path, content, message) {
  const b64 = Buffer.from(content, 'utf8').toString('base64');
  let attempt = 0;
  while (attempt < 3) {
    attempt += 1;
    const sha = await getSha(path);
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
      const body = { message, content: b64, branch, ...(sha ? { sha } : {}) };
      return await ghJson(url, { method: 'PUT', body: JSON.stringify(body) });
    } catch (e) {
      if (String(e.message || '').startsWith('409')) {
        await new Promise(r => setTimeout(r, 400 * attempt));
        continue;
      }
      throw e;
    }
  }
  throw new Error('409 Conflict after retries');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  try {
    // Accept blank/missing slug as default — be forgiving like the codex branch did.
    const rawSlug = (req.query.slug || '').toString().trim();
    const normalized = rawSlug.toLowerCase();
    const isDefault = !rawSlug || normalized === 'default' || normalized === 'root' || normalized === 'legacy-root';
    const slug = isDefault ? 'default' : rawSlug;

    const { missions, config } = req.body || {};
    if (!missions || !config) return res.status(400).json({ error: 'Missing missions/config' });

    const msg = `save-bundle(${slug}) ${new Date().toISOString()}`;

    // Always write the per-game paths (so every game — including 'default' — has a per-game copy).
    const paths = {
      mAdmin: `public/games/${slug}/draft/missions.json`,
      cAdmin: `public/games/${slug}/draft/config.json`,
      mGame:  `game/public/games/${slug}/draft/missions.json`,
      cGame:  `game/public/games/${slug}/draft/config.json`,
    };

    await putFile(paths.mAdmin, JSON.stringify(missions, null, 2), `${msg} missions(admin)`);
    await putFile(paths.cAdmin, JSON.stringify(config,   null, 2), `${msg} config(admin)`);
    await putFile(paths.mGame,  JSON.stringify(missions, null, 2), `${msg} missions(game)`);
    await putFile(paths.cGame,  JSON.stringify(config,   null, 2), `${msg} config(game)`);

    // For compatibility with older codepaths, if this is the default game also write legacy top-level drafts
    if (isDefault) {
      const legacy = {
        mAdmin: 'public/draft/missions.json',
        cAdmin: 'public/draft/config.json',
        mGame:  'game/public/draft/missions.json',
        cGame:  'game/public/draft/config.json',
      };
      await putFile(legacy.mAdmin, JSON.stringify(missions, null, 2), `${msg} missions(admin legacy)`);
      await putFile(legacy.cAdmin, JSON.stringify(config,   null, 2), `${msg} config(admin legacy)`);
      await putFile(legacy.mGame,  JSON.stringify(missions, null, 2), `${msg} missions(game legacy)`);
      await putFile(legacy.cGame,  JSON.stringify(config,   null, 2), `${msg} config(game legacy)`);
      Object.assign(paths, {
        legacyMAdmin: legacy.mAdmin,
        legacyCAdmin: legacy.cAdmin,
        legacyMGame: legacy.mGame,
        legacyCGame: legacy.cGame,
      });
    }

    // Return null slug for default to match previous behavior
    res.status(200).json({ ok: true, slug: isDefault ? null : slug, wrote: Object.values(paths) });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
}
