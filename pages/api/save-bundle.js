// pages/api/save-bundle.js
// Safely write missions.json + config.json (admin + game copies) in sequence
// to avoid GitHub 409 "expected <sha>" conflicts.
import { GAME_ENABLED } from '../../lib/game-switch.js';

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
    const slug = (req.query.slug || '').toString().trim();
    const { missions, config } = req.body || {};
    if (!slug) return res.status(400).json({ error: 'Missing slug' });
    if (!missions || !config) return res.status(400).json({ error: 'Missing missions/config' });

    const msg = `save-bundle(${slug}) ${new Date().toISOString()}`;
    const paths = {
      mAdmin: `public/games/${slug}/draft/missions.json`,
      cAdmin: `public/games/${slug}/draft/config.json`,
      mGame:  `game/public/games/${slug}/draft/missions.json`,
      cGame:  `game/public/games/${slug}/draft/config.json`,
    };

    const wrote = [];

    await putFile(paths.mAdmin, JSON.stringify(missions, null, 2), `${msg} missions(admin)`);
    wrote.push(paths.mAdmin);
    await putFile(paths.cAdmin, JSON.stringify(config,   null, 2), `${msg} config(admin)`);
    wrote.push(paths.cAdmin);

    if (GAME_ENABLED) {
      await putFile(paths.mGame,  JSON.stringify(missions, null, 2), `${msg} missions(game)`);
      wrote.push(paths.mGame);
      await putFile(paths.cGame,  JSON.stringify(config,   null, 2), `${msg} config(game)`);
      wrote.push(paths.cGame);
    }

    res.status(200).json({ ok: true, wrote });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
}
