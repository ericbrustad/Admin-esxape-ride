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

const MEDIA_FOLDERS = new Set(['uploads', 'bundles', 'icons', 'covers', 'mediapool', 'overlays', 'skins']);

function normalizePath(rel) {
  const clean = String(rel || '').trim();
  if (!clean) throw new Error('Missing path');
  if (clean.includes('..')) throw new Error('Illegal path');
  if (!clean.startsWith('public/media/')) throw new Error('Only media assets can be deleted');
  const [, , folder, ...rest] = clean.split('/');
  if (!folder || !MEDIA_FOLDERS.has(folder)) {
    throw new Error('Folder not allowed for deletion');
  }
  if (!rest.length) throw new Error('Invalid file path');
  return {
    rel: clean,
    folder,
  };
}

async function getSha(path) {
  const url = `${GH_ROOT}/${encodeURIComponent(path)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
  const r = await fetch(url, { headers: { Authorization:`Bearer ${GITHUB_TOKEN}`, Accept:'application/vnd.github+json' } });
  if (!r.ok) return null;
  const j = await r.json();
  return j.sha || null;
}

async function fetchFileInfo(fullPath) {
  const url = `${GH_ROOT}/${encodeURIComponent(fullPath)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
  const r = await fetch(url, { headers: { Authorization:`Bearer ${GITHUB_TOKEN}`, Accept:'application/vnd.github+json' } });
  if (r.status === 404) return null;
  if (!r.ok) {
    const text = await r.text();
    throw new Error(text || `Failed to load ${fullPath}`);
  }
  return r.json();
}

function decodeContent(content, encoding = 'base64') {
  if (!content) return '';
  if (encoding !== 'base64') return content;
  return Buffer.from(content, 'base64').toString('utf8');
}

async function updateMediapoolIndex(removeRelPath) {
  const indexRel = 'public/media/mediapool/index.json';
  const indexFull = joinPath(indexRel);
  const info = await fetchFileInfo(indexFull);
  if (!info) return { updated: false, removedTags: [] };

  const raw = decodeContent(info.content, info.encoding);
  let json;
  try {
    json = raw ? JSON.parse(raw) : { items: [] };
  } catch {
    json = { items: [] };
  }
  const items = Array.isArray(json.items) ? json.items : [];
  const servedPath = `/${removeRelPath.replace(/^public\//, '')}`;
  let changed = false;
  const removedTags = new Set();
  const nextItems = items.filter((item) => {
    if (!item) return false;
    const url = String(item.url || '').trim();
    const match = url === servedPath;
    if (match) {
      if (Array.isArray(item.tags)) {
        item.tags.forEach((tag) => {
          const value = String(tag || '').trim();
          if (value) removedTags.add(value);
        });
      }
      changed = true;
      return false;
    }
    return true;
  });

  if (!changed) return { updated: false, removedTags: Array.from(removedTags) };

  const body = JSON.stringify({ items: nextItems }, null, 2);
  const putUrl = `${GH_ROOT}/${encodeURIComponent(indexFull)}`;
  const putRes = await fetch(putUrl, {
    method: 'PUT',
    headers: { Authorization:`Bearer ${GITHUB_TOKEN}`, Accept:'application/vnd.github+json', 'Content-Type':'application/json' },
    body: JSON.stringify({
      message: `update mediapool index (remove ${servedPath})`,
      content: Buffer.from(body, 'utf8').toString('base64'),
      branch: GITHUB_BRANCH,
      sha: info.sha,
    }),
  });
  if (!putRes.ok) {
    const txt = await putRes.text();
    throw new Error(txt || 'Failed to update mediapool index');
  }
  return { updated: true, removedTags: Array.from(removedTags) };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'POST only' });
    const input = normalizePath(req.body?.path);
    const rel = input.rel;
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

    let removedTags = [];
    if (input.folder === 'mediapool') {
      try {
        const result = await updateMediapoolIndex(rel);
        removedTags = result.removedTags || [];
      } catch (err) {
        // surface a warning but do not fail the delete
        return res.json({ ok:true, path: rel, removedTags, warning: String(err?.message || err) });
      }
    }

    return res.json({ ok:true, path: rel, removedTags });
  } catch (e) {
    return res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
}
