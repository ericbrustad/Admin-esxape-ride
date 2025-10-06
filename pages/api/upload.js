// pages/api/upload.js
import { ghEnv, resolveBranch, ghHeaders } from './_gh-helpers';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { path, contentBase64, message = 'upload via Admin UI' } = req.body || {};
    if (!path || !contentBase64) return res.status(400).json({ ok: false, error: 'Missing path or content' });
    if (!String(path).startsWith('public/media/')) return res.status(400).json({ ok: false, error: 'Path must be under public/media/' });

    const { token, owner, repo, branch } = ghEnv();
    const ref = await resolveBranch({ token, owner, repo, branch });

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    // include sha if file exists
    const head = await fetch(`${url}?ref=${encodeURIComponent(ref)}`, { headers: ghHeaders(token) });
    let sha;
    if (head.ok) {
      const j = await head.json();
      sha = j.sha;
    }

    const r = await fetch(url, {
      method: 'PUT',
      headers: ghHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ message, content: contentBase64, ...(sha ? { sha } : {}), branch: ref }),
    });
    if (!r.ok) return res.status(r.status).json({ ok: false, error: await r.text() });

    return res.status(200).json({ ok: true, url: '/' + path.replace(/^public\//, '') });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
