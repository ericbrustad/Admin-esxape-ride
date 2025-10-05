// pages/api/media/delete.js
// Body: { path: "public/media/mediapool/<file>" } — deletes the file from repo (not from game config)

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
const BASE_DIR = normBaseDir(GITHUB_BASE_DIR || '');
function joinPath(p) { const clean = (p || '').replace(/^\/+/, ''); return BASE_DIR ? `${BASE_DIR}/${clean}` : clean; }

function assertMediapoolPath(rel) {
  if (!rel || !rel.startsWith('public/media/mediapool/')) throw new Error('Only mediapool files can be deleted');
  if (rel.includes('..')) throw new Error('Illegal path');
}

async function getSha(path) {
  const url = `${GH_ROOT}/${encodeURIComponent(path)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
  const r = await fetch(url, { headers: { Authorization:`Bearer ${GITHUB_TOKEN}`, Accept:'application/vnd.github+json' } });
  if (!r.ok) return null;
  const j = await r.json();
  return j.sha || null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'POST only' });
    const rel = String(req.body?.path || '');
    assertMediapoolPath(rel);
    const full = joinPath(rel);

    const sha = await getSha(full);
    if (!sha) return res.status(404).json({ ok:false, error:'File not found' });

    const url = `${GH_ROOT}/${encodeURIComponent(full)}`;
    const r = await fetch(url, {
      method:'DELETE',
      headers: { Authorization:`Bearer ${GITHUB_TOKEN}`, Accept:'application/vnd.github+json', 'Content-Type':'application/json' },
      body: JSON.stringify({ message:`delete ${rel}`, branch: GITHUB_BRANCH, sha }),
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ ok:false, error: t || 'Delete failed' });
    }
    return res.json({ ok:true, path: rel });
  } catch (e) {
    return res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
}
