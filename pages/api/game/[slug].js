// /pages/api/game/[slug].js
export default async function handler(req, res) {
  const { slug } = req.query;
  const channel = (req.query.channel || 'published').toString(); // 'draft' | 'published'
  const action = req.method === 'POST' ? (req.body?.action || '') : '';

  const token = process.env.GITHUB_TOKEN;
  const repoFull = process.env.DATA_REPO;          // "owner/repo"
  const branch = process.env.DATA_BRANCH || 'main';
  const allowOrigin = process.env.GAME_ORIGIN || '*';

  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (!repoFull) return res.status(500).json({ error: 'Missing DATA_REPO env (owner/repo)' });
  const [owner, repo] = repoFull.split('/');

  const gh = async (path, init = {}) => {
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/${path}`, {
      ...init,
      headers: {
        'Accept': 'application/vnd.github+json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...init.headers,
      },
      next: { revalidate: 0 },
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`${r.status} ${r.statusText}: ${t}`);
    }
    return r;
  };

  const getContent = async (path) => {
    const r = await gh(`contents/${path}?ref=${branch}`);
    const j = await r.json();
    const buf = Buffer.from(j.content, j.encoding || 'base64').toString('utf8');
    return { json: JSON.parse(buf), sha: j.sha };
  };

  const putContent = async (path, content, sha, message) => {
    const body = {
      message,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch,
      ...(sha ? { sha } : {}),
    };
    const r = await gh(`contents/${path}`, { method: 'PUT', body: JSON.stringify(body) });
    return await r.json();
  };

  const base = `${channel}/games/${slug}`;

  try {
    // GET => serve game data
    if (req.method === 'GET') {
      const [m, c] = await Promise.all([
        getContent(`${base}/missions.json`),
        getContent(`${base}/config.json`),
      ]);
      return res.status(200).json({
        slug,
        channel,
        version: c.json?.version ?? Date.now(),
        missions: m.json,
        config: c.json,
      });
    }

    // POST publish => copy draft -> published, bump version
    if (req.method === 'POST' && action === 'publish') {
      const draftBase = `draft/games/${slug}`;
      const publBase  = `published/games/${slug}`;
      const [m, c] = await Promise.all([
        getContent(`${draftBase}/missions.json`),
        getContent(`${draftBase}/config.json`),
      ]);

      const nextVersion = typeof c.json?.version === 'number' ? c.json.version + 1 : Date.now();
      const newConfig = { ...(c.json || {}), version: nextVersion };

      await putContent(
        `${publBase}/missions.json`,
        JSON.stringify(m.json, null, 2),
        undefined,
        `publish(${slug}): missions`
      );
      await putContent(
        `${publBase}/config.json`,
        JSON.stringify(newConfig, null, 2),
        undefined,
        `publish(${slug}): config v${nextVersion}`
      );

      return res.status(200).json({ ok: true, slug, version: nextVersion });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
