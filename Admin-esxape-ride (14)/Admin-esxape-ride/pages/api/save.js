// pages/api/save.js
// Save draft missions to Admin + mirror to Game. Robust against concurrent SHA changes.

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

async function getFileSha(path) {
  const url = `${GH_ROOT}/${encodeURIComponent(path)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'esx-admin',
    },
  });
  if (r.status === 200) {
    const j = await r.json();
    return j.sha || null;
  }
  return null;
}

async function putFileWithRetry(path, contentText, message, attempts = 4) {
  const base = {
    message,
    content: Buffer.from(contentText, 'utf8').toString('base64'),
    branch: GITHUB_BRANCH,
  };

  for (let i = 1; i <= attempts; i++) {
    const sha = await getFileSha(path);
    const body = sha ? { ...base, sha } : base;

    const url = `${GH_ROOT}/${encodeURIComponent(path)}`;
    const r = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'esx-admin',
      },
      body: JSON.stringify(body),
    });

    if (r.ok) return r.json();

    // 409/422 race → backoff and retry
    if ((r.status === 409 || r.status === 422) && i < attempts) {
      await new Promise(res => setTimeout(res, 150 * i));
      continue;
    }

    const txt = await r.text();
    throw new Error(`GitHub PUT failed: ${r.status} ${txt}`);
  }
  throw new Error(`GitHub PUT failed after ${attempts} attempts`);
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).send('POST only');

    const slug = String(req.query.slug || '').trim();
    const missions = req.body?.missions;
    if (!missions) return res.status(400).json({ ok: false, error: 'Missing missions payload' });

    const text = typeof missions === 'string' ? missions : JSON.stringify(missions, null, 2);
    const wrote = [];

    if (slug) {
      // Write sequentially (avoid SHA flapping)
      const rootDraft = joinPath(`public/games/${slug}/draft/missions.json`);
      const gameDraft = joinPath(`game/public/games/${slug}/draft/missions.json`);

      await putFileWithRetry(rootDraft, text, `save(draft missions): ${slug}`);
      wrote.push(rootDraft);

      await putFileWithRetry(gameDraft, text, `save(game draft missions): ${slug}`);
      wrote.push(gameDraft);
    } else {
      const root = joinPath(`public/draft/missions.json`);
      const game = joinPath(`game/public/draft/missions.json`);

      await putFileWithRetry(root, text, `save(legacy missions)`);
      wrote.push(root);

      await putFileWithRetry(game, text, `save(game legacy missions)`);
      wrote.push(game);
    }

    res.json({ ok: true, slug: slug || null, wrote });
  } catch (e) {
    res.status(500).send(String(e?.message || e));
  }
}
