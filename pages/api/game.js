// pages/api/game.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { slug = 'default', channel = 'published' } = req.query;

    const token  = process.env.GITHUB_TOKEN;
    const user   = process.env.GITHUB_USER;
    const repo   = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';

    const path = slug === 'default'
      ? 'public/missions.json'
      : `public/games/${slug}/missions.json`;

    // read current file to get sha/content, then re-put to create a "publish" commit
    const read = await fetch(
      `https://api.github.com/repos/${user}/${repo}/contents/${path}?ref=${branch}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!read.ok) return res.status(404).json({ ok: false, error: 'missions.json not found' });
    const file = await read.json();

    const body = {
      message: `publish ${slug} → ${channel} via Admin UI`,
      content: file.content, // re-commit same content
      sha: file.sha,
      branch,
    };

    const r = await fetch(`https://api.github.com/repos/${user}/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) return res.status(r.status).json({ ok: false, error: await r.text() });

    res.json({ ok: true, version: new Date().toISOString().replace('T', ' ').slice(0, 19) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
