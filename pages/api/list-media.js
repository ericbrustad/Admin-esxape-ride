// pages/api/list-media.js
// Enumerates media items for the Admin "Media Inventory" browser.
// Returns {ok, items:[{name,url,type,source}...]}
// Looks in multiple locations so your repo organization is flexible.

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

function listDirFilesSafe(absDir) {
  try {
    return fs
      .readdirSync(absDir, { withFileTypes: true })
      .filter(d => d.isFile())
      .map(d => d.name);
  } catch {
    return [];
  }
}

export default function handler(req, res) {
  try {
    const dir = (req.query.dir || 'bundles').toString(); // 'bundles' | 'overlays'
    const cwd = process.cwd();

    // Candidate locations (support older and current layouts).
    const candidates = [
      // Admin served (best — guarantees browser access via /media/…)
      { root: path.join(cwd, 'public', 'media', dir), urlBase: `/media/${dir}/`, source: 'admin-public' },
      // Game's public (served on Game origin; we expose absolute URLs if NEXT_PUBLIC_GAME_ORIGIN is set)
      { root: path.join(cwd, 'game', 'public', 'media', dir), urlBase: 'GAME_ORIGIN', source: 'game-public' },
      // Optional legacy/staging folders people sometimes add (readable, but not directly served):
      { root: path.join(cwd, 'games', 'lib', 'media', dir), urlBase: null, source: 'repo-lib' },
      { root: path.join(cwd, 'games', 'lib', dir), urlBase: null, source: 'repo-lib' },
      { root: path.join(cwd, 'lib', 'media', dir), urlBase: null, source: 'repo-lib' },
    ];

    const gameOrigin = process.env.NEXT_PUBLIC_GAME_ORIGIN || '';
    const items = [];

    for (const c of candidates) {
      const names = listDirFilesSafe(c.root);
      for (const name of names) {
        const type = classify(name);
        if (type === 'other') continue;

        // Only locations that are actually served should build a browser-usable URL.
        if (c.urlBase === `/media/${dir}/`) {
          items.push({ name, url: `${c.urlBase}${encodeURIComponent(name)}`, type, source: c.source });
        } else if (c.urlBase === 'GAME_ORIGIN' && gameOrigin) {
          items.push({ name, url: `${gameOrigin}/media/${dir}/${encodeURIComponent(name)}`, type, source: c.source });
        } else {
          // Repo-only locations are listed for reference but do not generate URLs (not accessible at runtime).
          // Skip these because the browser cannot load them directly.
        }
      }
    }

    // De-duplicate by URL (prefer admin-public over game-public)
    const seen = new Set();
    const out = [];
    for (const it of items) {
      if (!it.url) continue;
      const key = it.url.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(it);
    }

    res.status(200).json({ ok: true, items: out });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}

