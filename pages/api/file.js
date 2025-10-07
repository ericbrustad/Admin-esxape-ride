// pages/api/file.js
import { ghEnv, ghHeaders, resolveBranch } from './_gh-helpers';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const rawPath = req.query.path;
    const path = Array.isArray(rawPath) ? rawPath[0] : rawPath;
    if (!path || !String(path).startsWith('public/')) {
      return res.status(400).json({ ok: false, error: 'Missing or invalid path' });
    }

    const { token, owner, repo, branch } = ghEnv();
    const ref = await resolveBranch({ token, owner, repo, branch });

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`;
    const r = await fetch(url, { headers: ghHeaders(token), cache: 'no-store' });
    if (!r.ok) return res.status(r.status).json({ ok: false, error: `GitHub: ${r.status} ${r.statusText}` });

    const j = await r.json();
    if (j.type !== 'file' || !j.content) return res.status(404).json({ ok: false, error: 'Not a file' });

    const buf = Buffer.from(j.content, 'base64');
    const ext = path.split('.').pop().toLowerCase();

    const mime =
      ext === 'json' ? 'application/json' :
      ext === 'png'  ? 'image/png' :
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
      ext === 'webp' ? 'image/webp' :
      ext === 'gif'  ? 'image/gif' :
      ext === 'mp4'  ? 'video/mp4' :
      ext === 'webm' ? 'video/webm' :
      ext === 'mov'  ? 'video/quicktime' :
      ext === 'mp3'  ? 'audio/mpeg' :
      ext === 'wav'  ? 'audio/wav' :
      ext === 'ogg'  ? 'audio/ogg' : 'application/octet-stream';

    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
