// pages/api/config.js
// -------------------
const GH = 'https://api.github.com';
const owner  = process.env.REPO_OWNER;
const repo   = process.env.REPO_NAME;
const token  = process.env.GITHUB_TOKEN;
const branch = process.env.REPO_BRANCH || 'main';

const authHeaders = {
  Authorization: `Bearer ${token}`,
  'User-Agent': 'esx-admin',
  Accept: 'application/vnd.github+json',
};

async function getFile(path) {
  const url = `${GH}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
  const res = await fetch(url, { headers: authHeaders });
  if (!res.ok) return null;
  const json = await res.json();
  const text = Buffer.from(json.content || '', 'base64').toString('utf8');
  return { sha: json.sha, text };
}

export default async function handler(req, res) {
  try {
    const slug = (req.query.slug || '').toString().trim();
    const path = slug
      ? `public/games/${slug}/config.json`
      : `public/config.json`;

    const file = await getFile(path);
    if (!file) return res.status(200).json({}); // client merges defaults
    return res.status(200).json(JSON.parse(file.text || '{}'));
  } catch (e) {
    return res.status(500).send(String(e.message || e));
  }
}
