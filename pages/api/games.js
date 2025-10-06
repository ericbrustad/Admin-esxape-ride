// pages/api/games.js
const token  = process.env.GITHUB_TOKEN;
const user   = process.env.GITHUB_USER;
const repo   = process.env.GITHUB_REPO;
const branch = process.env.GITHUB_BRANCH || 'main';

export default async function handler(req, res) {
  try {
    // GET — list all game folders
    if (req.method === 'GET') {
      const r = await fetch(
        `https://api.github.com/repos/${user}/${repo}/contents/public/games?ref=${branch}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!r.ok) return res.json({ ok: true, games: [] });
      const items = await r.json();
      const games = (Array.isArray(items) ? items : [])
        .filter(i => i.type === 'dir')
        .map(i => ({ slug: i.name, title: i.name, mode: 'single' }));
      return res.json({ ok: true, games });
    }

    // POST — create new game
    if (req.method === 'POST') {
      const { title, type, mode, timer } = req.body;
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const dir  = `public/games/${slug}`;

      const files = [
        {
          path: `${dir}/config.json`,
          content: JSON.stringify({
            game: { title, type },
            splash: { enabled: true, mode },
            timer,
            map: { centerLat: 44.9778, centerLng: -93.2650, defaultZoom: 13 },
          }, null, 2),
        },
        {
          path: `${dir}/missions.json`,
          content: JSON.stringify({ version: '1.0.0', missions: [] }, null, 2),
        },
      ];

      for (const f of files) {
        const url  = `https://api.github.com/repos/${user}/${repo}/contents/${f.path}`;
        const body = {
          message: `create ${f.path} via Admin UI`,
          content: Buffer.from(f.content).toString('base64'),
          branch,
        };
        const r = await fetch(url, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!r.ok) return res.status(r.status).json({ ok: false, error: await r.text() });
      }
      return res.json({ ok: true, slug });
    }

    // DELETE — delete entire game folder
    if (req.method === 'DELETE') {
      const { slug } = req.query;
      if (!slug) return res.status(400).json({ ok: false, error: 'Missing slug' });

      const list = await fetch(
        `https://api.github.com/repos/${user}/${repo}/contents/public/games/${slug}?ref=${branch}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!list.ok) return res.json({ ok: false, error: 'Folder not found' });
      const files = await list.json();

      for (const f of files) {
        await fetch(`https://api.github.com/repos/${user}/${repo}/contents/${f.path}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: `delete ${f.path} via Admin UI`, sha: f.sha, branch }),
        });
      }
      return res.json({ ok: true });
    }

    res.status(405).end();
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
