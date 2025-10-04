// pages/api/save.js
export const config = { api: { bodyParser: true } };

const {
  REPO_OWNER,
  REPO_NAME,
  GITHUB_TOKEN,
  GITHUB_BRANCH = 'main',
  GITHUB_BASE_DIR = '',
} = process.env;

const GH_ROOT = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents`;

function normBaseDir(s) {
  if (!s || s === '(empty)') return '';
  return s.replace(/^\/+|\/+$/g, '');
}
const BASE_DIR = normBaseDir(GITHUB_BASE_DIR);

function joinPath(p) {
  const clean = p.replace(/^\/+/, '');
  return BASE_DIR ? `${BASE_DIR}/${clean}` : clean;
}

async function getFileSha(path) {
  const url = `${GH_ROOT}/${encodeURIComponent(path)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      'User-Agent': 'esx-admin',
      Accept: 'application/vnd.github+json',
    },
  });
  if (r.status === 200) {
    const j = await r.json();
    return j.sha || null;
  }
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
    const missions = req.body?.missions;
    if (!missions) return res.status(400).json({ ok: false, error: 'Missing missions payload' });

    const text = typeof missions === 'string' ? missions : JSON.stringify(missions, null, 2);
    const wrote = [];

    if (slug) {
      // DRAFT targets (root + game)
      const rootDraft = joinPath(`public/games/${slug}/draft/missions.json`);
      const gameDraft = joinPath(`game/public/games/${slug}/draft/missions.json`);
      await putFile(rootDraft, text, `save(draft missions): ${slug}`);
      await putFile(gameDraft, text, `save(game draft missions): ${slug}`);
      wrote.push(rootDraft, gameDraft);
    } else {
      // Legacy root (no slug)
      const root = joinPath(`public/missions.json`);
      const game = joinPath(`game/public/missions.json`);
      await putFile(root, text, `save(legacy missions)`);
      await putFile(game, text, `save(game legacy missions)`);
      wrote.push(root, game);
    }

    res.json({ ok: true, slug: slug || null, wrote });
  } catch (e) {
    res.status(500).send(String(e && e.message ? e.message : e));
  }
}
