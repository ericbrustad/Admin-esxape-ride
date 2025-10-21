// pages/api/list-media.js
// Canonical listing of media for the Admin inventory.
// Prefers Admin public assets; falls back to Game only if Admin doesn't have it.
// De-duplicates by filename (case-insensitive).

import fs from 'fs';
import path from 'path';
import { GAME_ENABLED } from '../../lib/game-switch.js';

const EXTS = {
  image: /\.(png|jpg|jpeg|webp|svg|bmp|tif|tiff|avif)$/i,
  gif: /\.(gif)$/i,
  video: /\.(mp4|webm|mov)$/i,
  audio: /\.(mp3|wav|ogg|m4a|aiff|aif)$/i,
  ar: /\.(glb|gltf|usdz|reality|vrm|fbx|obj)$/i,
};

function classify(name) {
  if (EXTS.gif.test(name)) return 'gif';
  if (EXTS.image.test(name)) return 'image';
  if (EXTS.video.test(name)) return 'video';
  if (EXTS.audio.test(name)) return 'audio';
  if (EXTS.ar.test(name)) return 'ar';
  return 'other';
}

function listFiles(absDir, prefix = '') {
  try {
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const nextPrefix = prefix ? path.posix.join(prefix, entry.name) : entry.name;
        files.push(...listFiles(path.join(absDir, entry.name), nextPrefix));
      } else if (entry.isFile()) {
        const rel = prefix ? path.posix.join(prefix, entry.name) : entry.name;
        files.push(rel);
      }
    }
    return files;
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
      const key = name.toLowerCase();
      if (seenByName.has(key)) continue;
      seenByName.add(key);
      const relativePath = path.posix.join('public', 'media', dir, name);
      const encoded = name.split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
      out.push({
        name,
        url: `/media/${dir}/${encoded}`,
        type,
        source: 'admin',
        path: relativePath,
      });
    }

    // 2) Game (fallback only for names not present in Admin)
    if (GAME_ENABLED && gameOrigin) {
      for (const name of gameNames) {
        const type = classify(name);
        const key = name.toLowerCase();
        if (seenByName.has(key)) continue; // Admin has it → skip Game
        seenByName.add(key);
        const encoded = name.split('/')
          .map((segment) => encodeURIComponent(segment))
          .join('/');
        out.push({
          name,
          url: `${gameOrigin}/media/${dir}/${encoded}`,
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
