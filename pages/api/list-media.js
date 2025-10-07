// pages/api/list-media.js
// Canonical listing of media for the Admin inventory.
// Prefers Admin public assets; falls back to Game only if Admin doesn't have it.
// De-duplicates by filename (case-insensitive).

import fs from 'fs';
import path from 'path';

const EXTS = {
  image: /\.(png|jpg|jpeg|webp)$/i,
  gif: /\.(gif)$/i,
  video: /\.(mp4|webm|mov)$/i,
  audio: /\.(mp3|wav|ogg|m4a)$/i,
};

function classify(name) {
  if (EXTS.gif.test(name)) return 'gif';
  if (EXTS.image.test(name)) return 'image';
  if (EXTS.video.test(name)) return 'video';
  if (EXTS.audio.test(name)) return 'audio';
  return 'other';
}

function listFiles(absDir) {
  try {
    return fs
      .readdirSync(absDir, { withFileTypes: true })
      .filter(d => d.isFile())
      .map(d => d.name);
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  try {
    const dir = (req.query.dir || 'bundles').toString(); // 'bundles' | 'overlays'
    const cwd = process.cwd();
    const gameOrigin = process.env.NEXT_PUBLIC_GAME_ORIGIN || '';

    // Priority: 1) Admin public (canonical), 2) Game public (fallback if Admin missing)
    const adminRoot = path.join(cwd, 'public', 'media', dir);
    const gameRoot  = path.join(cwd, 'game', 'public', 'media', dir);

    const adminNames = listFiles(adminRoot);
    const gameNames  = listFiles(gameRoot);

    const seenByName = new Set(); // case-insensitive
    const out = [];

    // 1) Admin (canonical)
    for (const name of adminNames) {
      const type = classify(name);
      if (type === 'other') continue;
      const key = name.toLowerCase();
      if (seenByName.has(key)) continue;
      seenByName.add(key);
      out.push({
        name,
        url: `/media/${dir}/${encodeURIComponent(name)}`,
        type,
        source: 'admin',
      });
    }

    // 2) Game (fallback only for names not present in Admin)
    if (gameOrigin) {
      for (const name of gameNames) {
        const type = classify(name);
        if (type === 'other') continue;
        const key = name.toLowerCase();
        if (seenByName.has(key)) continue; // Admin has it → skip Game
        seenByName.add(key);
        out.push({
          name,
          url: `${gameOrigin}/media/${dir}/${encodeURIComponent(name)}`,
          type,
          source: 'game',
        });
      }
    }

    return res.status(200).json({ ok: true, items: out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
