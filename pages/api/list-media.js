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
      .filter((d) => d.isFile())
      .map((d) => {
        const absFile = path.join(absDir, d.name);
        let size = 0;
        try {
          const stat = fs.statSync(absFile);
          size = Number(stat.size) || 0;
        } catch {}
        return { name: d.name, size };
      });
  } catch {
    return [];
  }
}

function readFolderMetadata(absDir, dir) {
  const indexPath = path.join(absDir, 'index.json');
  try {
    const raw = fs.readFileSync(indexPath, 'utf8');
    const json = JSON.parse(raw);
    const items = Array.isArray(json?.items) ? json.items : [];
    const byUrl = new Map();
    const byName = new Map();
    items.forEach((item) => {
      if (!item) return;
      const url = String(item.url || '').trim();
      if (url) {
        const normUrl = url.replace(/^\/+/, '');
        byUrl.set(normUrl.toLowerCase(), item);
      }
      const name = String(item.name || '').trim();
      if (name) {
        byName.set(name.toLowerCase(), item);
      }
    });
    return { items, byUrl, byName };
  } catch {
    return { items: [], byUrl: new Map(), byName: new Map() };
  }
}

function normalizeServedPath(relPath) {
  const stripped = relPath.replace(/^public\//, '');
  return stripped.replace(/^\/+/, '');
}

function collectMissingMetadata(metaItems = [], presentNames = new Set(), dir = '') {
  const missing = [];
  metaItems.forEach((item) => {
    if (!item) return;
    const candidateUrl = String(item.url || '').replace(/^\/+/, '');
    const candidateName = (candidateUrl.split('/').pop() || String(item.name || '')).toLowerCase();
    if (!candidateName) return;
    if (!presentNames.has(candidateName)) {
      missing.push({
        name: item.name || candidateName,
        url: item.url || '',
        folder: dir,
      });
    }
  });
  return missing;
}

export default async function handler(req, res) {
  try {
    const dir = (req.query.dir || 'bundles').toString(); // 'bundles' | 'overlays'
    const cwd = process.cwd();
    const gameOrigin = GAME_ENABLED ? (process.env.NEXT_PUBLIC_GAME_ORIGIN || '') : '';

    // Priority: 1) Admin public (canonical), 2) Game public (fallback if Admin missing)
    const adminRoot = path.join(cwd, 'public', 'media', dir);
    const gameRoot  = GAME_ENABLED ? path.join(cwd, 'game', 'public', 'media', dir) : null;

    const adminFiles = listFiles(adminRoot);
    const gameFiles  = gameRoot ? listFiles(gameRoot) : [];
    const metadata   = readFolderMetadata(adminRoot, dir);
    const adminPresentNames = new Set(adminFiles.map((file) => file.name.toLowerCase()));
    const missing = collectMissingMetadata(metadata.items, adminPresentNames, dir);

    const seenByName = new Set(); // case-insensitive
    const out = [];

    // 1) Admin (canonical)
    for (const file of adminFiles) {
      const name = file.name;
      const type = classify(name);
      if (type === 'other') continue;
      const key = name.toLowerCase();
      if (seenByName.has(key)) continue;
      seenByName.add(key);
      const relativePath = path.posix.join('public', 'media', dir, name);
      const servedPath = normalizeServedPath(relativePath);
      const metaByUrl = metadata.byUrl.get(servedPath.toLowerCase());
      const metaByName = metadata.byName.get(name.toLowerCase());
      const meta = metaByUrl || metaByName || {};
      out.push({
        name,
        url: `/media/${dir}/${encodeURIComponent(name)}`,
        type,
        source: 'admin',
        path: relativePath,
        folder: dir,
        size: Number(file.size) || 0,
        tags: Array.isArray(meta.tags) ? meta.tags : undefined,
        thumbUrl: meta.thumb || meta.thumbUrl || undefined,
        label: meta.label || meta.name || undefined,
      });
    }

    // 2) Game (fallback only for names not present in Admin)
    if (GAME_ENABLED && gameOrigin) {
      for (const file of gameFiles) {
        const name = file.name;
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
          folder: dir,
          size: Number(file.size) || 0,
        });
      }
    }

    return res.status(200).json({ ok: true, items: out, metadata: { dir, missing } });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
