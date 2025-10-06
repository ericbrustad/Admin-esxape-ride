// pages/api/list-media.js
export const runtime = 'nodejs';

import { ghEnv, resolveBranch, ghHeaders } from './_gh-helpers';

function classifyByName(n = '') {
  const s = n.toLowerCase();
  if (/\.(gif)(\?|$)/.test(s)) return 'gif';
  if (/\.(png|jpe?g|webp|svg)(\?|$)/.test(s)) return 'image';
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
    const { token, owner, repo, branch } = ghEnv();
    const ref = await resolveBranch({ token, owner, repo, branch });

    // Merge new typed pool + legacy locations for back-compat
    const roots = [
      'public/media/uploads',
      'public/media/uploads/image',
      'public/media/uploads/gif',
      'public/media/uploads/video',
      'public/media/uploads/audio',
      'public/media/mediapool', // legacy
      'public/media/bundles',   // read-only bundle art
      'public/media/icons',     // read-only legacy icons
    ];

    const items = [];
    for (const path of roots) {
      const arr = await listDir({ token, owner, repo, ref, path });
      if (!Array.isArray(arr)) continue;
      for (const it of arr) {
        if (it.type !== 'file') continue;
        const url = `/${it.path.replace(/^public\//, '')}`;
        items.push({ name: it.name, url, type: classifyByName(it.name) });
      }
    }

    // Stable sort by name to keep UI deterministic
    items.sort((a, b) => a.name.localeCompare(b.name));
    res.status(200).json({ items });
  } catch (e) {
    res.status(200).json({ items: [], warning: e?.message });
  }
}

