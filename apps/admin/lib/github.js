// apps/admin/lib/github.js
// Monorepo-aware GitHub Contents API helpers (ESM)

const API = process.env.GITHUB_API || 'https://api.github.com';

export function joinPath(...parts) {
  return parts
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '');
}

function getEnv(strict = true) {
  const OWNER = process.env.REPO_OWNER || '';
  const REPO = process.env.REPO_NAME || '';
  const TOKEN = process.env.GITHUB_TOKEN || '';
  const BRANCH = process.env.GITHUB_BRANCH || 'main';
  const BASE_DIR = (process.env.GITHUB_BASE_DIR || '').replace(/^\/+|\/+$/g, ''); // e.g. 'apps/admin'
  if (strict) {
    const missing = [];
    if (!OWNER) missing.push('REPO_OWNER');
    if (!REPO) missing.push('REPO_NAME');
    if (!TOKEN) missing.push('GITHUB_TOKEN');
    if (missing.length) throw new Error(`Missing env: ${missing.join(', ')}`);
  }
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

export async function ghGet(relPath) {
  const { OWNER, REPO, TOKEN, BRANCH, BASE_DIR } = getEnv(true);
  const path = joinPath(BASE_DIR, relPath);
  const url = `${API}/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}?ref=${encodeURIComponent(BRANCH)}`;
  const r = await fetch(url, { headers: authHeaders(TOKEN), cache: 'no-store' });
  if (r.status === 404) return { status: 404, data: null };
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`GitHub GET ${path} failed: ${r.status} ${text}`);
  }
  const data = await r.json();
  return { status: 200, data };
}

export async function ghPut(relPath, content, message, sha) {
  const { OWNER, REPO, TOKEN, BRANCH, BASE_DIR } = getEnv(true);
  const path = joinPath(BASE_DIR, relPath);
  const url = `${API}/repos/${OWNER}/${REPO}/contents/${encodeURI(path)}`;
  const contentBase64 = Buffer.isBuffer(content)
    ? content.toString('base64')
    : Buffer.from(String(content), 'utf8').toString('base64');

  const body = {
    message: message || `Update ${path}`,
    content: contentBase64,
    branch: BRANCH,
    ...(sha ? { sha } : {}),
  };

  const r = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(TOKEN), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`GitHub PUT ${path} failed: ${r.status} ${text}`);
  }
  return r.json();
}

export async function upsertJson(relPath, json, message) {
  const pretty = JSON.stringify(json, null, 2) + '\n';
  const existing = await ghGet(relPath); // 404 = create
  const sha = existing.status === 200 && existing.data && existing.data.sha ? existing.data.sha : undefined;
  return ghPut(relPath, pretty, message, sha);
}

export async function listDirs(relPath) {
  const res = await ghGet(relPath);
  if (res.status !== 200 || !Array.isArray(res.data)) return [];
  return res.data.filter((x) => x.type === 'dir').map((x) => x.name);
}

export function getEnvSnapshot() {
  const { OWNER, REPO, TOKEN, BRANCH, BASE_DIR } = getEnv(false);
  return { OWNER: !!OWNER, REPO: !!REPO, TOKEN: !!TOKEN, BRANCH, BASE_DIR };
}
