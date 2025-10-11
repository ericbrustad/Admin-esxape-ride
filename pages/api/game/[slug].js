// pages/api/game/[slug].js
import { GAME_ENABLED } from '../../../lib/game-switch.js';

export const config = { api: { bodyParser: true } };

const {
  REPO_OWNER,
  REPO_NAME,
  GITHUB_TOKEN,
  GITHUB_BRANCH = 'main',
  GITHUB_BASE_DIR = '',
} = process.env;

const GH_ROOT = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents`;
function normBaseDir(s) { if (!s || s === '(empty)') return ''; return s.replace(/^\/+|\/+$/g, ''); }
const BASE_DIR = normBaseDir(GITHUB_BASE_DIR);
function joinPath(p) { const clean = p.replace(/^\/+/, ''); return BASE_DIR ? `${BASE_DIR}/${clean}` : clean; }

async function getContent(path) {
  const url = `${GH_ROOT}/${encodeURIComponent(path)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
  const r = await fetch(url, { headers: { Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': 'esx-admin', Accept: 'application/vnd.github+json' } });
  if (!r.ok) return null;
  const j = await r.json();
  const text = Buffer.from(j.content || '', j.encoding || 'base64').toString('utf8');
  return { text, sha: j.sha || null };
}
async function getFileSha(path) {
  const url = `${GH_ROOT}/${encodeURIComponent(path)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
  const r = await fetch(url, { headers: { Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': 'esx-admin', Accept: 'application/vnd.github+json' } });
  if (r.status === 200) { const j = await r.json(); return j.sha || null; }
  return null;
}
async function putFileWithRetry(path, contentText, message, attempts = 3) {
  const base = { message, content: Buffer.from(contentText, 'utf8').toString('base64'), branch: GITHUB_BRANCH };
  for (let i = 1; i <= attempts; i++) {
    const sha = await getFileSha(path);
    const body = sha ? { ...base, sha } : base;
    const url = `${GH_ROOT}/${encodeURIComponent(path)}`;
    const r = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'esx-admin',
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (r.ok) return r.json();
    if (r.status === 409 && i < attempts) { await new Promise(res => setTimeout(res, 150 * i)); continue; }
    const txt = await r.text();
    throw new Error(`GitHub PUT failed: ${r.status} ${txt}`);
  }
  throw new Error(`GitHub PUT failed after ${attempts} attempts (409)`);
}

export default async function handler(req, res) {
  try {
    if (!GAME_ENABLED) {
      return res.status(403).json({ ok: false, error: 'Game project disabled' });
    }
    if (req.method !== 'POST') return res.status(405).send('POST only');

    const slug = String(req.query.slug || '').trim();
    if (!slug) return res.status(400).json({ ok: false, error: 'Missing slug' });

    // load draft from Admin side
    const draftM = await getContent(joinPath(`public/games/${slug}/draft/missions.json`));
    const draftC = await getContent(joinPath(`public/games/${slug}/draft/config.json`));
    if (!draftM || !draftC) return res.status(404).json({ ok: false, error: 'Draft files not found' });

    const wrote = [];
    // publish ONLY to game/ (simplified)
    const gamePubM = joinPath(`game/public/games/${slug}/missions.json`);
    const gamePubC = joinPath(`game/public/games/${slug}/config.json`);
    await putFileWithRetry(gamePubM, draftM.text, `publish(${slug}): game missions.json`);
    await putFileWithRetry(gamePubC, draftC.text, `publish(${slug}): game config.json`);
    wrote.push(gamePubM, gamePubC);

    // optional: keep an index.json under root for admin lists (unchanged)

    let version = '';
    try { version = JSON.parse(draftM.text)?.version || ''; } catch {}
    res.json({ ok: true, slug, wrote, version });
  } catch (e) {
    res.status(500).send(String(e?.message || e));
  }
}
