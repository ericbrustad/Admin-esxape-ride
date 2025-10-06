// pages/api/list-media.js
import { ghEnv, resolveBranch, ghHeaders } from './_gh-helpers';

function classify(url) {
  const s = url.toLowerCase();
  if (/\.(png|jpg|jpeg|webp)$/.test(s)) return 'image';
  if (/\.(gif)$/.test(s)) return 'gif';
  if (/\.(mp4|webm|mov)$/.test(s)) return 'video';
  if (/\.(mp3|wav|ogg|m4a)$/.test(s)) return 'audio';
  return 'other';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const requested = String(req.query.dir || '').replace(/[^a-z0-9_-]/gi, '');
    const dir = ['uploads', 'bundles', 'icons'].includes(requested) ? requested : 'uploads';

    const { token, owner, repo, branch } = ghEnv();
    const ref = await resolveBranch({ token, owner, repo, branch });

    const basePath = `public/media/${dir}`;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${basePath}?ref=${encodeURIComponent(ref)}`;
    const r = await fetch(url, { headers: ghHeaders(token), cache: 'no-store' });

    if (!r.ok) return res.status(200).json({ items: [] }); // empty ok

    const arr = await r.json();
    const items = (Array.isArray(arr) ? arr : [])
      .filter(it => it.type === 'file')
      .map(it => ({
        name: it.name,
        url: `/media/${dir}/${it.name}`,
        type: classify(it.name),
      }));

    res.status(200).json({ items });
  } catch {
    res.status(200).json({ items: [] });
  }
}
