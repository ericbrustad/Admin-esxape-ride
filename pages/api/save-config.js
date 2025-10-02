// pages/api/save-config.js
// ------------------------
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

async function putFile(path, text, message) {
  const url = `${GH}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const head = await getFile(path);
  const body = {
    message,
    content: Buffer.from(text, 'utf8').toString('base64'),
    branch,
    ...(head ? { sha: head.sha } : {}),
  };
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub PUT failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export default async function handler(req, res) {
  try {
    const { config } = req.body || {};
    const slug = (req.query.slug || '').toString().trim();
    if (!config) return res.status(400).send('no config payload');

    const path = slug
      ? `public/games/${slug}/config.json`
      : `public/config.json`;

    await putFile(path, JSON.stringify(config, null, 2),
      `chore: update config.json via admin${slug ? ` (${slug})` : ''}`);

    res.status(200).send('ok');
  } catch (e) {
    res.status(500).send(String(e.message || e));
  }
}
