// pages/api/list-media.js
import { ghEnv, resolveBranch, ghHeaders } from './_gh-helpers';

function classify(url) {
  const s = url.toLowerCase();
  if (/\.(gif)(\?|$)/.test(s)) return 'gif';
  if (/\.(png|jpg|jpeg|webp|svg)(\?|$)/.test(s)) return 'image';
  if (/\.(mp4|webm|mov)(\?|$)/.test(s)) return 'video';
  if (/\.(mp3|wav|ogg|m4a)(\?|$)/.test(s)) return 'audio';
  return 'other';
}

async function listDir({ token, owner, repo, ref, path }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`;
  const r = await fetch(url, { headers: ghHeaders(token), cache: 'no-store' });
  if (!r.ok) return [];
  return await r.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const requested = String(req.query.dir || '').replace(/[^a-z0-9_-]/gi, '') || 'uploads';
    const { token, owner, repo, branch } = ghEnv();
    const ref = await resolveBranch({ token, owner, repo, branch });

    // where we read from
    const roots = {
      uploads: [
        'public/media/uploads',                     // legacy flat
        'public/media/uploads/image',
        'public/media/uploads/gif',
        'public/media/uploads/video',
        'public/media/uploads/audio',
        'public/media/mediapool',                   // legacy pool (if present)
      ],
      bundles: ['public/media/bundles'],
      icons:   ['public/media/icons'],              // read-only legacy; still visible in the pool
    }[requested] || [`public/media/${requested}`];

    const items = [];
    for (const path of roots) {
      const arr = await listDir({ token, owner, repo, ref, path });
      if (!Array.isArray(arr)) continue;
      for (const it of arr) {
        if (it.type !== 'file') continue;
        const url = `/${it.path.replace(/^public\//, '')}`;
        items.push({ name: it.name, url, type: classify(it.name) });
      }
    }

    res.status(200).json({ items });
  } catch {
    res.status(200).json({ items: [] });
  }
}
