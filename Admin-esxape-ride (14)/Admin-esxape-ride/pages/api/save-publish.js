// pages/api/save-publish.js
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

async function putFileWithRetry(path, contentText, message, attempts = 3) {
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
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'esx-admin',
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (r.ok) return r.json();
    if (r.status === 409 && i < attempts) {
      await new Promise((res) => setTimeout(res, 150 * i));
      continue;
    }
    const txt = await r.text();
    throw new Error(`GitHub PUT failed: ${r.status} ${txt}`);
  }
  throw new Error(`GitHub PUT failed after ${attempts} attempts (409)`);
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).send('POST only');

    const slug = String(req.query.slug || '').trim();
    const missions = req.body?.missions;
    const configObj = req.body?.config;

    if (!slug) return res.status(400).json({ ok: false, error: 'Missing slug' });
    if (!missions || !configObj) return res.status(400).json({ ok: false, error: 'Missing missions/config' });

    const missionsText = typeof missions === 'string' ? missions : JSON.stringify(missions, null, 2);
    const configText = typeof configObj === 'string' ? configObj : JSON.stringify(configObj, null, 2);

    const wrote = [];

    // Draft (Admin root)
    const rootDraftM = joinPath(`public/games/${slug}/draft/missions.json`);
    const rootDraftC = joinPath(`public/games/${slug}/draft/config.json`);
    await putFileWithRetry(rootDraftM, missionsText, `save+publish(draft missions): ${slug}`);
    await putFileWithRetry(rootDraftC, configText, `save+publish(draft config): ${slug}`);
    wrote.push(rootDraftM, rootDraftC);

    // Draft (Game) for TEST channel
    const gameDraftM = joinPath(`game/public/games/${slug}/draft/missions.json`);
    const gameDraftC = joinPath(`game/public/games/${slug}/draft/config.json`);
    await putFileWithRetry(gameDraftM, missionsText, `save+publish(game draft missions): ${slug}`);
    await putFileWithRetry(gameDraftC, configText, `save+publish(game draft config): ${slug}`);
    wrote.push(gameDraftM, gameDraftC);

    // PUBLISHED (Game live)
    const gamePubM = joinPath(`game/public/games/${slug}/missions.json`);
    const gamePubC = joinPath(`game/public/games/${slug}/config.json`);
    await putFileWithRetry(gamePubM, missionsText, `publish(${slug}): game missions.json`);
    await putFileWithRetry(gamePubC, configText, `publish(${slug}): game config.json`);
    wrote.push(gamePubM, gamePubC);

    let version = '';
    try { version = JSON.parse(missionsText)?.version || ''; } catch {}

    res.json({ ok: true, slug, wrote, version });
  } catch (e) {
    res.status(500).send(String(e?.message || e));
  }
}
