// pages/api/save-config.js
// Save draft config to Admin root + mirror to Game draft (for TEST channel).
// No extra Basic-Auth check — middleware already protects everything.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'POST only' });
  try {
    const { slug = '' } = req.query;
    const { config } = req.body || {};
    if (!config) return res.status(400).json({ ok:false, error:'Missing config' });

    const owner  = process.env.REPO_OWNER || process.env.GH_OWNER;
    const repo   = process.env.REPO_NAME  || process.env.GITHUB_REPO || 'Admin-esxape-ride';
    const token  = process.env.GITHUB_TOKEN;
    const branch = process.env.GITHUB_BRANCH || 'main';
    const baseDir = (process.env.GITHUB_BASE_DIR || '').replace(/^\/+|\/+$/g, '');
    if (!owner || !repo || !token) return res.status(500).json({ ok:false, error:'Missing GitHub env' });

    const targets = slug
      ? [`public/games/${slug}/draft/config.json`, `game/public/games/${slug}/draft/config.json`]
      : [`public/draft/config.json`];

    const content = Buffer.from(JSON.stringify(config, null, 2)).toString('base64');
    const wrote = [];

    for (const rel of targets) {
      const path = baseDir ? `${baseDir}/${rel}` : rel;

      // Get SHA if exists
      const headUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
      let sha;
      const head = await fetch(headUrl, { headers:{ Authorization:`Bearer ${token}`, Accept:'application/vnd.github+json' } });
      if (head.ok) { const j = await head.json(); sha = j.sha; }

      // PUT
      const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
      const put = await fetch(putUrl, {
        method:'PUT',
        headers:{ Authorization:`Bearer ${token}`, Accept:'application/vnd.github+json' },
        body: JSON.stringify({ message:`save config (${slug||'root'})`, content, branch, sha }),
      });
      if (!put.ok) {
        const jr = await put.json();
        return res.status(put.status).send(jr?.message || 'GitHub PUT failed');
      }
      wrote.push(rel);
    }

    return res.json({ ok:true, slug, wrote });
  } catch (e) {
    return res.status(500).send(String(e));
  }
}
