// pages/api/list-media.js
// Canonical listing of media for the Admin inventory.
// Prefers Admin public assets; falls back to Game only if Admin doesn't have it.
// De-duplicates by filename (case-insensitive).

import fs from 'fs';
import path from 'path';
import { GAME_ENABLED } from '../../lib/game-switch.js';

const EXTS = {
  image: /\.(png|jpg|jpeg|webp|bmp|svg|tif|tiff|avif|heic|heif|ico|icns)$/i,
  gif: /\.(gif)$/i,
  video: /\.(mp4|webm|mov|m4v)$/i,
  audio: /\.(mp3|wav|ogg|m4a|aiff|aif|aac|flac)$/i,
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
    const gameOrigin = GAME_ENABLED ? (process.env.NEXT_PUBLIC_GAME_ORIGIN || '') : '';

    // Priority: 1) Admin public (canonical), 2) Game public (fallback if Admin missing)
    const adminRoot = path.join(cwd, 'public', 'media', dir);
    const gameRoot  = GAME_ENABLED ? path.join(cwd, 'game', 'public', 'media', dir) : null;

    const adminNames = listFiles(adminRoot);
    const gameNames  = gameRoot ? listFiles(gameRoot) : [];

    const seenByName = new Set(); // case-insensitive
    const out = [];

    // 1) Admin (canonical)
    for (const name of adminNames) {
      const type = classify(name);
      if (type === 'other') continue;
      const key = name.toLowerCase();
      if (seenByName.has(key)) continue;
      seenByName.add(key);
      const relativePath = path.posix.join('public', 'media', dir, name);
      out.push({
        name,
        url: `/media/${dir}/${encodeURIComponent(name)}`,
        type,
        source: 'admin',
        path: relativePath,
      });
    }

    // 2) Game (fallback only for names not present in Admin)
    if (GAME_ENABLED && gameOrigin) {
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
          path: '',
        });
      }
    }

    return res.status(200).json({ ok: true, items: out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
