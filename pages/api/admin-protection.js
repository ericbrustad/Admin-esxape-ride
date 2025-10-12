import fs from 'fs/promises';

const owner  = process.env.REPO_OWNER || process.env.GH_OWNER;
const repo   = process.env.REPO_NAME  || process.env.GITHUB_REPO || 'Admin-esxape-ride';
const token  = process.env.GITHUB_TOKEN;
const branch = process.env.GITHUB_BRANCH || 'main';
const baseDir = (process.env.GITHUB_BASE_DIR || '').replace(/^\/+|\/+$/g, '');

const USER = process.env.BASIC_AUTH_USER || 'Eric';
const PASS = process.env.BASIC_AUTH_PASS || 'someStrongPassword';
const DEFAULT_PROTECTED = (() => {
  const raw = process.env.ADMIN_PASSWORD_PROTECTED ?? process.env.ADMIN_PROTECTED ?? '0';
  return raw === '1' || String(raw).toLowerCase() === 'true';
})();

const TARGETS = [
  'public/admin-protection.json',
  'game/public/admin-protection.json',
];

function withBase(path) {
  return baseDir ? `${baseDir}/${path}` : path;
}

async function githubJson(url, init = {}) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers || {}),
  };
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text || res.statusText}`);
  }
  return res.json();
}

async function getGitHubFile(path) {
  if (!owner || !repo || !token) return null;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(withBase(path))}?ref=${branch}`;
  try {
    const json = await githubJson(url, { method: 'GET' });
    const text = Buffer.from(json.content || '', 'base64').toString('utf8');
    return { sha: json.sha, text };
  } catch (err) {
    if (String(err.message || '').startsWith('404')) return null;
    throw err;
  }
}

async function putGitHubFile(path, text, message) {
  if (!owner || !repo || !token) return null;
  const target = withBase(path);
  const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(target)}?ref=${branch}`;
  let sha;
  try {
    const current = await githubJson(getUrl, { method: 'GET' });
    sha = current.sha;
  } catch (err) {
    if (!String(err.message || '').startsWith('404')) throw err;
  }
  const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(target)}`;
  const body = {
    message,
    content: Buffer.from(text, 'utf8').toString('base64'),
    branch,
    ...(sha ? { sha } : {}),
  };
  await githubJson(putUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function readLocalFallback() {
  try {
    const raw = await fs.readFile('public/admin-protection.json', 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return { protected: DEFAULT_PROTECTED, updatedAt: null };
  }
}

async function getProtectionState() {
  try {
    const primary = await getGitHubFile(TARGETS[0]);
    if (primary && primary.text) {
      return JSON.parse(primary.text);
    }
  } catch (err) {
    // fall back to local file if GitHub lookup fails
  }
  return readLocalFallback();
}

function parseAuth(header = '') {
  const [scheme, encoded] = header.split(' ');
  if (scheme !== 'Basic' || !encoded) return null;
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    if (idx < 0) return null;
    return { user: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
  } catch (err) {
    return null;
  }
}

async function requireAuth(req, res) {
  const creds = parseAuth(req.headers.authorization || '');
  if (!creds || creds.user !== USER || creds.pass !== PASS) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Esx Admin"');
    res.status(401).send('Auth required');
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    try {
      const state = await getProtectionState();
      const sanitized = {
        protected: !!state.protected,
        updatedAt: state.updatedAt || null,
      };
      return res.status(200).json({ ok: true, ...sanitized });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  }

  if (req.method === 'POST') {
    if (!(await requireAuth(req, res))) return;
    try {
      const nextProtected = req.body?.protected;
      if (typeof nextProtected !== 'boolean') {
        return res.status(400).json({ ok: false, error: 'protected boolean required' });
      }
      const payload = {
        protected: nextProtected,
        updatedAt: new Date().toISOString(),
      };
      const text = JSON.stringify(payload, null, 2);
      const message = `admin protection ${nextProtected ? 'enabled' : 'disabled'}`;

      if (owner && repo && token) {
        for (const path of TARGETS) {
          await putGitHubFile(path, text, message);
        }
      } else {
        await fs.writeFile('public/admin-protection.json', text, 'utf8').catch(() => {});
        await fs.writeFile('game/public/admin-protection.json', text, 'utf8').catch(() => {});
      }

      return res.status(200).json({ ok: true, ...payload });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end();
}
