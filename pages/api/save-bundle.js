// pages/api/save-bundle.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { slug = 'default' } = req.query;
    const { missions, config } = req.body;

    const token   = process.env.GITHUB_TOKEN;
    const user    = process.env.GITHUB_USER;
    const repo    = process.env.GITHUB_REPO;
    const branch  = process.env.GITHUB_BRANCH || 'main';

    const folder  = slug === 'default'
      ? 'public'
      : `public/games/${slug}`;

    // helper to PUT one file
    async function putFile(path, content) {
      const url = `https://api.github.com/repos/${user}/${repo}/contents/${path}`;
      const body = {
        message: `update ${path} via Admin UI`,
        content: Buffer.from(content).toString('base64'),
        branch,
      };

      // get current sha if file exists
      const head = await fetch(url, { headers: { Authorization:`Bearer ${token}` } });
      if (head.ok) {
        const { sha } = await head.json();
        body.sha = sha;
      }

      const r = await fetch(url, {
        method:'PUT',
        headers:{
          Authorization:`Bearer ${token}`,
          'Content-Type':'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!r.ok) throw new Error(await r.text());
      return await r.json();
    }

    await putFile(`${folder}/missions.json`, JSON.stringify(missions, null, 2));
    await putFile(`${folder}/config.json`,   JSON.stringify(config, null, 2));

    res.json({ ok:true });
  } catch (e) {
    res.status(500).json({ ok:false, error:e.message });
  }
}
