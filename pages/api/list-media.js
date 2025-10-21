// pages/api/list-media.js
// Canonical listing of media for the Admin inventory.
// Prefers Admin public assets; falls back to Game only if Admin doesn't have it.
// De-duplicates by filename (case-insensitive).

import fs from 'fs';
import path from 'path';
import { GAME_ENABLED } from '../../lib/game-switch.js';

const EXTS = {
  image: /\.(png|jpg|jpeg|webp|svg|bmp|tif|tiff|avif|heic|heif)$/i,
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

function slugify(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const CATEGORY_INFO = {
  audio: {
    label: 'Audio',
    folder: 'Audio',
    type: 'audio',
    baseTags: ['audio'],
  },
  video: {
    label: 'Video',
    folder: 'Video',
    type: 'video',
    baseTags: ['video'],
  },
  'ar-target': {
    label: 'AR Target',
    folder: 'AR Target',
    type: 'ar-target',
    baseTags: ['ar', 'ar-target'],
  },
  'ar-overlay': {
    label: 'AR Overlay',
    folder: 'AR Overlay',
    type: 'ar-overlay',
    baseTags: ['ar', 'ar-overlay'],
  },
  images: {
    label: 'Images',
    folder: 'Images',
    type: 'image',
    baseTags: ['image'],
  },
  gif: {
    label: 'Gif',
    folder: 'Gif',
    type: 'gif',
    baseTags: ['gif'],
  },
  other: {
    label: 'Other',
    folder: 'Other',
    type: 'other',
    baseTags: ['other'],
  },
};

const SEGMENT_ALIASES = {
  audio: 'Audio',
  video: 'Video',
  'ar-target': 'AR Target',
  'ar-overlay': 'AR Overlay',
  images: 'Images',
  gif: 'Gif',
  gifs: 'Gif',
  other: 'Other',
};

const DIR_ALIASES = {
  '': 'mediapool',
  mediapool: 'mediapool',
  all: 'mediapool',
  audio: 'mediapool/Audio',
  video: 'mediapool/Video',
  'ar-target': 'mediapool/AR Target',
  'ar-overlay': 'mediapool/AR Overlay',
  images: 'mediapool/Images',
  gif: 'mediapool/Gif',
  gifs: 'mediapool/Gif',
  other: 'mediapool/Other',
  bundles: 'mediapool/Images/bundles',
  icons: 'mediapool/Images/icons',
  covers: 'mediapool/Images/covers',
  uploads: 'mediapool/Images/uploads',
};

function resolveDir(input = '') {
  const trimmed = String(input || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  if (!trimmed) return DIR_ALIASES[''];
  const slug = slugify(trimmed);
  if (DIR_ALIASES[slug]) return DIR_ALIASES[slug];

  const segments = trimmed.split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!segments.length) return DIR_ALIASES[''];

  if (segments[0].toLowerCase() === 'mediapool') {
    const normalizedSegments = ['mediapool'];
    for (let i = 1; i < segments.length; i += 1) {
      const seg = segments[i];
      const segSlug = slugify(seg);
      if (SEGMENT_ALIASES[segSlug]) {
        normalizedSegments.push(SEGMENT_ALIASES[segSlug]);
      } else {
        normalizedSegments.push(seg);
      }
    }
    return normalizedSegments.join('/');
  }

  const rootSlug = slugify(segments[0]);
  if (DIR_ALIASES[rootSlug]) {
    const resolved = DIR_ALIASES[rootSlug];
    if (segments.length === 1) return resolved;
    return `${resolved}/${segments.slice(1).join('/')}`;
  }

  return trimmed;
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

function enrichMeta(relativePath = '') {
  const normalized = String(relativePath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
  const segments = normalized.split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  let categoryKey = '';
  let categoryInfo = null;
  if (segments[0] && slugify(segments[0]) === 'mediapool') {
    const rawCategory = segments[1] || 'Images';
    const slug = slugify(rawCategory);
    categoryKey = slug;
    categoryInfo = CATEGORY_INFO[slug] || CATEGORY_INFO.images;
  } else {
    categoryKey = 'images';
    categoryInfo = CATEGORY_INFO.images;
  }

  const tags = new Set(categoryInfo.baseTags || []);
  let extraType = categoryInfo.type || classify(relativePath);

  if (categoryKey === 'images') {
    const subFolder = slugify(segments[2] || '');
    if (subFolder === 'icons') {
      tags.add('icon');
    } else if (subFolder === 'covers') {
      tags.add('cover');
    } else if (subFolder === 'bundles') {
      tags.add('bundle');
    } else if (subFolder === 'uploads') {
      tags.add('upload');
    }
  }

  if (categoryKey === 'ar-target') extraType = 'ar-target';
  if (categoryKey === 'ar-overlay') extraType = 'ar-overlay';

  const label = CATEGORY_INFO[categoryKey]?.label || CATEGORY_INFO.images.label;

  return {
    category: categoryKey,
    categoryLabel: label,
    type: extraType,
    tags: Array.from(tags),
  };
}

export default async function handler(req, res) {
  try {
    const dirParam = (req.query.dir || 'mediapool').toString();
    const dir = resolveDir(dirParam);
    const cwd = process.cwd();
    const gameOrigin = GAME_ENABLED ? (process.env.NEXT_PUBLIC_GAME_ORIGIN || '') : '';

    // Priority: 1) Admin public (canonical), 2) Game public (fallback if Admin missing)
    const adminRoot = path.join(cwd, 'public', 'media', dir);
    const gameRoot  = GAME_ENABLED ? path.join(cwd, 'game', 'public', 'media', dir) : null;

    const adminNames = listFiles(adminRoot);
    const gameNames  = gameRoot ? listFiles(gameRoot) : [];

    const seenByName = new Set(); // case-insensitive path (within dir)
    const out = [];

    // 1) Admin (canonical)
    for (const name of adminNames) {
      const type = classify(name);
      const key = path.posix.join(dir, name).toLowerCase();
      if (seenByName.has(key)) continue;
      seenByName.add(key);
      const relativePath = path.posix.join('public', 'media', dir, name);
      const encoded = name.split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
      const meta = enrichMeta(path.posix.join(dir, name));
      out.push({
        name,
        url: `/media/${dir}/${encoded}`,
        type,
        source: 'admin',
        path: relativePath,
        category: meta.category,
        categoryLabel: meta.categoryLabel,
        tags: meta.tags,
        kind: meta.type,
      });
    }

    // 2) Game (fallback only for names not present in Admin)
    if (GAME_ENABLED && gameOrigin) {
      for (const name of gameNames) {
        const type = classify(name);
        const key = path.posix.join(dir, name).toLowerCase();
        if (seenByName.has(key)) continue; // Admin has it → skip Game
        seenByName.add(key);
        const encoded = name.split('/')
          .map((segment) => encodeURIComponent(segment))
          .join('/');
        const meta = enrichMeta(path.posix.join(dir, name));
        out.push({
          name,
          url: `${gameOrigin}/media/${dir}/${encoded}`,
          type,
          source: 'game',
          path: '',
          category: meta.category,
          categoryLabel: meta.categoryLabel,
          tags: meta.tags,
          kind: meta.type,
        });
      }
    }

    return res.status(200).json({ ok: true, items: out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
