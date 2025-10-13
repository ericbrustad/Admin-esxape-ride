// pages/api/config.js
// -------------------
import path from 'node:path';
import { promises as fs } from 'node:fs';

const GH = 'https://api.github.com';
const owner  = process.env.REPO_OWNER;
const repo   = process.env.REPO_NAME;
const token  = process.env.GITHUB_TOKEN;
const branch = process.env.REPO_BRANCH || 'main';

const hasGitHubConfig = !!(owner && repo && token);

const authHeaders = {
  'User-Agent': 'esx-admin',
  Accept: 'application/vnd.github+json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function getRemoteFile(relPath) {
  const url = `${GH}/repos/${owner}/${repo}/contents/${encodeURIComponent(relPath)}?ref=${branch}`;
  const res = await fetch(url, { headers: authHeaders });
  if (!res.ok) return null;
  const json = await res.json();
  const text = Buffer.from(json.content || '', 'base64').toString('utf8');
  return { sha: json.sha, text };
}

async function getLocalFile(relPath) {
  const abs = path.join(process.cwd(), relPath);
  try {
    const text = await fs.readFile(abs, 'utf8');
    return { sha: null, text };
  } catch {
    return null;
  }
}

async function getFile(relPath) {
  return hasGitHubConfig ? getRemoteFile(relPath) : getLocalFile(relPath);
}

export default async function handler(req, res) {
  try {
    const slug = (req.query.slug || '').toString().trim();
    const path = slug
      ? `public/games/${slug}/config.json`
      : `public/config.json`;

    const file = await getFile(path);
    if (!file) return res.status(200).json({}); // client merges defaults
    try {
      return res.status(200).json(JSON.parse(file.text || '{}'));
    } catch (err) {
      console.error('config parse failed:', err);
      return res.status(500).json({ ok: false, error: 'Invalid config JSON' });
    }
  } catch (e) {
    return res.status(500).send(String(e.message || e));
  }
}
