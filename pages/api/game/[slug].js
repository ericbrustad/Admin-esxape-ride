// pages/api/game/[slug].js
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
  const r = await fetch(url, {
    headers: { Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': 'esx-admin', Accept: 'application/vnd.github+json' },
  });
  if (!r.ok) return null;
  const j = await r.json();
  const buf = Buffer.from(j.content || '', j.encoding || 'base64').toString('utf8');
  return { text: buf, sha: j.sha || null };
}

async function getFileSha(path) {
  const url = `${GH_ROOT}/${encodeURIComponent(path)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
  const r = await fetch(url, { headers: { Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': 'esx-admin', Accept: 'application/vnd.github+json' } });
  if (r.status === 200) { const j = await r.json(); return j.sha || null; }
  return null;
}

async function putFile(path, contentText, message) {
  const sha = await getFileSha(path);
  const body = {
    message,
    content: Buffer.from(contentText, 'utf8').toString('base64'),
    branch: GITHUB_BRANCH,
  };
  if (sha) body.sha = sha;

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
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`GitHub PUT failed: ${r.status} ${txt}`);
  }
  return r.json();
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).send('POST only');

    const slug = String(req.query.slug || '').trim();
    const channel = String(req.query.channel || 'published');
    const action = req.body?.action || 'publish';

    if (!slug) return res.status(400).json({ ok: false, error: 'Missing slug' });
    if (action !== 'publish' || channel !== 'published') {
      return res.status(400).json({ ok: false, error: 'Only publish to published channel is supported' });
    }

    // read latest DRAFT from root (source of truth)
    const draftM = await getContent(joinPath(`public/games/${slug}/draft/missions.json`));
    const draftC = await getContent(joinPath(`public/games/${slug}/draft/config.json`));
    if (!draftM || !draftC) {
      return res.status(404).json({ ok: false, error: 'Draft files not found' });
    }

    // write to published (root + game)
    const wrote = [];
    const targets = [
      joinPath(`public/games/${slug}/missions.json`),
      joinPath(`public/games/${slug}/config.json`),
      joinPath(`game/public/games/${slug}/missions.json`),
      joinPath(`game/public/games/${slug}/config.json`),
    ];

    for (const p of targets) {
      const text = p.endsWith('missions.json') ? draftM.text : draftC.text;
      await putFile(p, text, `publish(${slug}): ${p.includes('/game/') ? 'game' : 'root'} ${p.split('/').pop()}`);
      wrote.push(p);
    }

    // (optional) derive version from missions.json if present
    let version = '';
    try { version = JSON.parse(draftM.text)?.version || ''; } catch {}

    res.json({ ok: true, slug, wrote, version });
  } catch (e) {
    res.status(500).send(String(e && e.message ? e.message : e));
  }
}
