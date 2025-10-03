// apps/admin/lib/github.js
const API = process.env.GITHUB_API || 'https://api.github.com';

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const OWNER = required('REPO_OWNER');
const REPO = required('REPO_NAME');
const TOKEN = required('GITHUB_TOKEN');
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const BASE_DIR = (process.env.GITHUB_BASE_DIR || '').replace(/^\/+|\/+$/g, ''); // e.g., 'apps/admin'

function joinPath(...parts) {
  return parts
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '');
}

function authHeaders() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    'User-Agent': 'esxape-admin',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function ghGet(relPath) {
  const path = joinPath(BASE_DIR, relPath);
  const url = `${API}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(BRANCH)}`;
  const r = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
  if (r.status === 404) return { status: 404, data: null };
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`GitHub GET ${path} failed: ${r.status} ${text}`);
  }
  const data = await r.json();
  return { status: 200, data };
}

async function ghPut(relPath, contentBuffer, message, sha) {
  const path = joinPath(BASE_DIR, relPath);
  const url = `${API}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`;
  const body = {
    message: message || `Update ${path}`,
    content: contentBuffer.toString('base64'),
    branch: BRANCH,
    ...(sha ? { sha } : {}),
  };
  const r = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`GitHub PUT ${path} failed: ${r.status} ${text}`);
  }
  return r.json();
}

async function upsertJson(relPath, json, message) {
  const content = Buffer.from(JSON.stringify(json, null, 2) + '\n');
  const existing = await ghGet(relPath); // 404 is fine — means create
  const sha = existing.status === 200 && existing.data && existing.data.sha ? existing.data.sha : undefined;
  return ghPut(relPath, content, message, sha);
}

async function listDirs(relPath) {
  const res = await ghGet(relPath);
  if (res.status !== 200 || !Array.isArray(res.data)) return [];
  return res.data.filter((x) => x.type === 'dir').map((x) => x.name);
}

module.exports = {
  OWNER, REPO, BRANCH, BASE_DIR,
  ghGet, ghPut, upsertJson, listDirs, joinPath,
};
