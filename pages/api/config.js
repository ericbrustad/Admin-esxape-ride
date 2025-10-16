// pages/api/config.js
// -------------------
import { promises as fs } from 'fs';
import path from 'path';

const GH = 'https://api.github.com';
const owner  = process.env.REPO_OWNER;
const repo   = process.env.REPO_NAME;
const token  = process.env.GITHUB_TOKEN;
const branch = process.env.REPO_BRANCH || 'main';

const baseHeaders = {
  'User-Agent': 'esx-admin',
  Accept: 'application/vnd.github+json',
};
const authHeaders = token
  ? { ...baseHeaders, Authorization: `Bearer ${token}` }
  : baseHeaders;

async function getFile(relPath) {
  if (!owner || !repo) return null;
  try {
    const url = `${GH}/repos/${owner}/${repo}/contents/${encodeURIComponent(relPath)}?ref=${branch}`;
    const res = await fetch(url, { headers: authHeaders });
    if (!res.ok) return null;
    const json = await res.json();
    const text = Buffer.from(json.content || '', 'base64').toString('utf8');
    return { sha: json.sha, text };
  } catch {
    return null;
  }
}

async function readLocalConfig(relPath) {
  try {
    const absolute = path.join(process.cwd(), relPath);
    const text = await fs.readFile(absolute, 'utf8');
    return { sha: null, text };
  } catch {
    return null;
  }
}

function sanitizeSlug(value) {
  return value.replace(/[^a-z0-9-_]/gi, '').trim();
}

export default async function handler(req, res) {
  try {
    const rawSlug = (req.query.slug || '').toString();
    const slug = sanitizeSlug(rawSlug);
    const relativePath = slug
      ? path.join('public', 'games', slug, 'config.json')
      : path.join('public', 'config.json');

    let file = await getFile(relativePath);
    if (!file) {
      file = await readLocalConfig(relativePath);
    }

    if (!file) {
      return res.status(200).json({});
    }

    const payload = JSON.parse(file.text || '{}');
    return res.status(200).json(payload);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
