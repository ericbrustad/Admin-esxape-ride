// apps/admin/pages/api/games/index.js
// GET  -> list game slugs under public/games (monorepo-aware, with fallback)
// POST -> create a game (same effect as /api/create)

const API = process.env.GITHUB_API || 'https://api.github.com';

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}
function env() {
  const OWNER = required('REPO_OWNER');
  const REPO = required('REPO_NAME');
  const TOKEN = required('GITHUB_TOKEN');
  const BRANCH = process.env.GITHUB_BRANCH || 'main';
  const BASE_DIR = (process.env.GITHUB_BASE_DIR || '').replace(/^\/+|\/+$/g, '');
  return { OWNER, REPO, TOKEN, BRANCH, BASE_DIR };
}
function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'esxape-admin',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}
function jpath(...parts) {
  return parts.filter(Boolean).join('/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
}
async function ghGetJson(url, headers) {
  const r = await fetch(url, { headers, cache: 'no-store' });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  return { ok: r.ok, status: r.status, data, raw: text };
}

async function listSlugs() {
  const { OWNER, REPO, TOKEN, BRANCH, BASE_DIR } = env();
  const headers = authHeaders(TOKEN);

  const candidates = [];
  // Candidate 1: use configured base dir (recommended)
  candidates.push(jpath(BASE_DIR, 'public/games'));
  // Candidate 2: fallback for monorepo if base dir wasn't set
  if (!BASE_DIR || BASE_DIR !== 'apps/admin') {
    candidates.push('apps/admin/public/games');
  }
  // Candidate 3: legacy single-app root
  candidates.push('public/games');

  for (const rel of candidates) {
    const url = `${API}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(rel)}?ref=${encodeURIComponent(BRANCH)}`;
    const r = await ghGetJson(url, headers);
    if (r.ok && Array.isArray(r.data)) {
      return r.data.filter(x => x.type === 'dir').map(x => x.name);
    }
    if (r.status !== 404 && r.status !== 403) {
      // if we hit a real error, surface it instead of silently falling through
      throw new Error(`GitHub list ${rel} failed: ${r.status} ${r.raw || ''}`.slice(0, 300));
    }
  }
  return []; // nothing found
}

function slugify(s) {
  return String(s || '')
    .trim().toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
function genSlug() {
  const d = new Date(); const p = n => String(n).padStart(2, '0');
  return `game-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function titleFromSlug(slug) {
  return slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
async function ghPutFile(rel, contentString, message) {
  const { OWNER, REPO, TOKEN, BRANCH, BASE_DIR } = env();
  const path = jpath(BASE_DIR, rel);
  const url = `${API}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`;
  // get existing sha if any
  const getUrl = `${API}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(BRANCH)}`;
  const get = await ghGetJson(getUrl, authHeaders(TOKEN));
  const sha = get.ok && get.data && get.data.sha ? get.data.sha : undefined;

  const body = {
    message: message || `Update ${path}`,
    content: Buffer.from(contentString, 'utf8').toString('base64'),
    branch: BRANCH,
    ...(sha ? { sha } : {})
  };
  const put = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!put.ok) {
    const t = await put.text();
    throw new Error(`GitHub PUT ${path} failed: ${put.status} ${t}`.slice(0, 300));
  }
  return put.json();
}

async function createGame(slugInput, titleInput) {
  const slug = slugify(slugInput) || genSlug();
  const title = (titleInput || titleFromSlug(slug)).toString();

  const config = {
    game: { title, slug },
    theme: {
      missionDefault: {
        fontFamily: 'Inter, system-ui, Arial',
        fontSize: 18,
        textColor: '#e9eef2',
        backgroundColor: '#0b0c10'
      }
    }
  };
  const missions = {
    id: `${slug}-suite-1`,
    version: 1,
    missions: [
      { id: 'intro-1', role: 'intro', type: 'statement', title: 'Welcome',
        content: { text: 'Welcome to the game!', styleEnabled: false } },
      { id: 'final-1', role: 'final', type: 'statement', title: 'Finish',
        content: { text: 'Great job!', styleEnabled: false } }
    ]
  };

  const basePub   = jpath('public/games', slug);
  const baseDraft = jpath('public/games', slug, 'draft');

  const prettyCfg = JSON.stringify(config, null, 2) + '\n';
  const prettyMis = JSON.stringify(missions, null, 2) + '\n';

  const results = [];
  // published
  results.push(await ghPutFile(jpath(basePub,   'config.json'),   prettyCfg, `create(config): ${slug}`));
  results.push(await ghPutFile(jpath(basePub,   'missions.json'), prettyMis, `create(missions): ${slug}`));
  // draft
  results.push(await ghPutFile(jpath(baseDraft, 'config.json'),   prettyCfg, `create draft(config): ${slug}`));
  results.push(await ghPutFile(jpath(baseDraft, 'missions.json'), prettyMis, `create draft(missions): ${slug}`));

  return { slug, results };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const slugs = await listSlugs();
      return res.status(200).json({ slugs });
    }
    if (req.method === 'POST') {
      const { slug, title } = (req.body || {});
      const created = await createGame(slug, title);
      return res.status(200).json({ ok: true, slug: created.slug, results: created.results });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('api/games error:', err);
    const msg = (err && err.message) ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
}
