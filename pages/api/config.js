// pages/api/config.js
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const { slug } = req.query;
    const path = (slug && slug !== 'default')
      ? `public/games/${slug}/config.json`
      : 'public/config.json';

    const token  = process.env.GITHUB_TOKEN;
    const user   = process.env.GITHUB_USER;
    const repo   = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';

    const url = `https://api.github.com/repos/${user}/${repo}/contents/${path}?ref=${branch}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return res.status(200).json({}); // UI merges with defaults

    const j = await r.json();
    const decoded = Buffer.from(j.content || '', 'base64').toString('utf8') || '{}';
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(JSON.parse(decoded));
  } catch {
    return res.status(200).json({}); // keep UI happy, it merges defaults
  }
}
