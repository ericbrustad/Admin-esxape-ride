// src/lib/github.js
// Monorepo-aware GitHub helpers with single-commit support

const API = process.env.GITHUB_API || 'https://api.github.com';

export function joinPath(...parts) {
  return parts.filter(Boolean).join('/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
}

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function env() {
  const OWNER = required('REPO_OWNER');
  const REPO = required('REPO_NAME');
  const TOKEN = required('GITHUB_TOKEN');
  const BRANCH = process.env.GITHUB_BRANCH || 'main';
  const BASE_DIR = (process.env.GITHUB_BASE_DIR || '').replace(/^\/+|\/+$/g, ''); // e.g., apps/admin
  return { OWNER, REPO, TOKEN, BRANCH, BASE_DIR };
}

function headers() {
  const { TOKEN } = env();
  return {
    Authorization: `Bearer ${TOKEN}`,
    'User-Agent': 'esxape-admin',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/** List directories at relPath. */
export async function listDirs(relPath) {
  const { OWNER, REPO, BRANCH, BASE_DIR } = env();
  const path = joinPath(BASE_DIR, relPath);
  const url = `${API}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(BRANCH)}`;
  const r = await fetch(url, { headers: headers(), cache: 'no-store' });
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`GitHub list ${path} failed: ${r.status} ${await r.text()}`);
  const data = await r.json();
  return Array.isArray(data) ? data.filter(d => d.type === 'dir').map(d => d.name) : [];
}

/** Read JSON file. Returns null if missing. */
export async function readJson(relPath) {
  const { OWNER, REPO, BRANCH, BASE_DIR } = env();
  const path = joinPath(BASE_DIR, relPath);
  const url = `${API}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(BRANCH)}`;
  const r = await fetch(url, { headers: headers(), cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub GET ${path} failed: ${r.status} ${await r.text()}`);
  const data = await r.json();
  const buf = Buffer.from(data.content || '', 'base64');
  try { return JSON.parse(buf.toString('utf8')); } catch { return null; }
}

/** Commit multiple files in ONE commit (git data API). */
export async function bulkCommit(files, message) {
  const { OWNER, REPO, BRANCH, BASE_DIR } = env();

  // current ref
  const refUrl = `${API}/repos/${OWNER}/${REPO}/git/refs/heads/${encodeURIComponent(BRANCH)}`;
  const refRes = await fetch(refUrl, { headers: headers() });
  if (!refRes.ok) throw new Error(`GET ref failed: ${refRes.status} ${await refRes.text()}`);
  const ref = await refRes.json();
  const baseCommitSha = ref.object.sha;

  // base tree
  const commitUrl = `${API}/repos/${OWNER}/${REPO}/git/commits/${baseCommitSha}`;
  const commitRes = await fetch(commitUrl, { headers: headers() });
  if (!commitRes.ok) throw new Error(`GET commit failed: ${commitRes.status} ${await commitRes.text()}`);
  const baseCommit = await commitRes.json();
  const baseTreeSha = baseCommit.tree.sha;

  // create new tree
  const tree = files.map(f => ({
    path: joinPath(BASE_DIR, f.path),
    mode: '100644',
    type: 'blob',
    content: f.content,
  }));
  const treeRes = await fetch(`${API}/repos/${OWNER}/${REPO}/git/trees`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: baseTreeSha, tree }),
  });
  if (!treeRes.ok) throw new Error(`POST tree failed: ${treeRes.status} ${await treeRes.text()}`);
  const newTree = await treeRes.json();

  // create commit
  const newCommitRes = await fetch(`${API}/repos/${OWNER}/${REPO}/git/commits`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: message || 'Update', tree: newTree.sha, parents: [baseCommitSha] }),
  });
  if (!newCommitRes.ok) throw new Error(`POST commit failed: ${newCommitRes.status} ${await newCommitRes.text()}`);
  const newCommit = await newCommitRes.json();

  // update ref
  const updateRes = await fetch(refUrl, {
    method: 'PATCH',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: newCommit.sha, force: false }),
  });
  if (!updateRes.ok) throw new Error(`PATCH ref failed: ${updateRes.status} ${await updateRes.text()}`);

  return {
    sha: newCommit.sha,
    htmlUrl: `https://github.com/${OWNER}/${REPO}/commit/${newCommit.sha}`,
    files: files.map(f => f.path),
  };
}
