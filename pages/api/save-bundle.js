// pages/api/save-bundle.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { slug = 'default' } = req.query;
    const { missions, config } = req.body;

    const token  = process.env.GITHUB_TOKEN;
    const user   = process.env.GITHUB_USER;
    const repo   = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';

    const folder = slug === 'default' ? 'public' : `public/games/${slug}`;

    async function putFile(path, content, message) {
      const url = `https://api.github.com/repos/${user}/${repo}/contents/${path}`;
      const body = {
        message,
        content: Buffer.from(content).toString('base64'),
        branch,
      };
      // if exists, include sha
      const head = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (head.ok) {
        const { sha } = await head.json();
        body.sha = sha;
      }
      const r = await fetch(url, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
    }

    await putFile(`${folder}/missions.json`, JSON.stringify(missions, null, 2), `update ${folder}/missions.json via Admin UI`);
    await putFile(`${folder}/config.json`,   JSON.stringify(config,   null, 2), `update ${folder}/config.json via Admin UI`);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
