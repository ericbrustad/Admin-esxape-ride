// pages/api/list-media.js
// Canonical listing of media for the Admin inventory.
// Prefers Admin public assets; falls back to Game only if Admin doesn't have it.
// De-duplicates by filename (case-insensitive).

import fs from 'fs';
import path from 'path';
import { GAME_ENABLED } from '../../lib/game-switch.js';

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

function walkFiles(absDir, relative = '') {
  const results = [];
  try {
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    for (const entry of entries) {
      const nextRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const nextAbs = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkFiles(nextAbs, nextRelative));
      } else if (entry.isFile()) {
        results.push(nextRelative);
      }
    }
  } catch {
    /* ignore missing directories */
  }
  return results;
}

export default async function handler(req, res) {
  try {
    const dir = (req.query.dir || 'bundles').toString(); // 'bundles' | 'overlays'
    const cwd = process.cwd();
    const gameOrigin = GAME_ENABLED ? (process.env.NEXT_PUBLIC_GAME_ORIGIN || '') : '';

    // Priority: 1) Admin public (canonical), 2) Game public (fallback if Admin missing)
    const adminRoot = path.join(cwd, 'public', 'media', dir);
    const gameRoot  = GAME_ENABLED ? path.join(cwd, 'game', 'public', 'media', dir) : null;

    const adminNames = walkFiles(adminRoot);
    const gameNames  = gameRoot ? walkFiles(gameRoot) : [];

    const seenByPath = new Set(); // exact relative path
    const out = [];

    // 1) Admin (canonical)
    for (const relative of adminNames) {
      const name = path.basename(relative);
      const type = classify(name);
      if (type === 'other') continue;
      const normalizedRelative = relative.replace(/\\/g, '/');
      const key = normalizedRelative.toLowerCase();
      if (seenByPath.has(key)) continue;
      seenByPath.add(key);
      const encoded = normalizedRelative
        .split('/')
        .map(seg => encodeURIComponent(seg))
        .join('/');
      const relativePath = path.posix.join('public', 'media', dir, normalizedRelative);
      out.push({
        id: `${dir}/${normalizedRelative}`,
        name,
        url: `/media/${dir}/${encoded}`,
        type,
        source: 'admin',
        path: relativePath,
      });
    }

    // 2) Game (fallback only for names not present in Admin)
    if (GAME_ENABLED && gameOrigin) {
      for (const relative of gameNames) {
        const name = path.basename(relative);
        const type = classify(name);
        if (type === 'other') continue;
        const normalizedRelative = relative.replace(/\\/g, '/');
        const key = normalizedRelative.toLowerCase();
        if (seenByPath.has(key)) continue; // Admin has it → skip Game
        seenByPath.add(key);
        const encoded = normalizedRelative
          .split('/')
          .map(seg => encodeURIComponent(seg))
          .join('/');
        out.push({
          id: `${dir}/${normalizedRelative}`,
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
