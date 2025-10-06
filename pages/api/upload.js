// pages/api/upload.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { path, contentBase64, message = 'upload via Admin UI' } = req.body || {};
    if (!path || !contentBase64) return res.status(400).json({ ok: false, error: 'Missing path or content' });
    if (!String(path).startsWith('public/media/')) return res.status(400).json({ ok: false, error: 'Path must be under public/media/' });

    const token  = process.env.GITHUB_TOKEN;
    const user   = process.env.GITHUB_USER;
    const repo   = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';

    const url = `https://api.github.com/repos/${user}/${repo}/contents/${path}`;

    // include sha if file exists (update), else create
    const head = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    let sha;
    if (head.ok) {
      const j = await head.json();
      sha = j.sha;
    }

    const body = { message, content: contentBase64, branch, ...(sha ? { sha } : {}) };

    const r = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) return res.status(r.status).json({ ok: false, error: await r.text() });

    return res.status(200).json({ ok: true, url: '/' + path.replace(/^public\//, '') });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
