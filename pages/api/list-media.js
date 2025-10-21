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
        const baseName = entry.name.toLowerCase();
        if (baseName === '.gitkeep' || baseName === 'index.json' || baseName === '.ds_store') {
          // Skip placeholder/metadata files so the Media Pool only surfaces real assets.
          // eslint-disable-next-line no-continue
          continue;
        }
        const rel = prefix ? path.posix.join(prefix, entry.name) : entry.name;
        files.push(rel);
      }
    }
    return files;
  } catch {
    return [];
  }
}

function readManifest() {
  try {
    const manifestPath = path.join(process.cwd(), 'public', 'media', 'manifest.json');
    const contents = fs.readFileSync(manifestPath, 'utf8');
    const parsed = JSON.parse(contents);
    if (parsed && Array.isArray(parsed.items)) return parsed.items;
  } catch (error) {
    console.warn('[list-media] Unable to read manifest:', error?.message || error);
  }
  return [];
}

function normalizeFolder(folder = '') {
  return String(folder || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
    || 'mediapool';
}

function folderMatchesTarget(folder = '', target = '') {
  const normalizedFolder = normalizeFolder(folder).toLowerCase();
  const normalizedTarget = normalizeFolder(target).toLowerCase();
  if (!normalizedTarget || normalizedTarget === 'mediapool') return true;
  if (normalizedFolder === normalizedTarget) return true;
  return normalizedFolder.startsWith(`${normalizedTarget}/`);
}

function buildUrlFromPath(repoPath = '') {
  const normalized = String(repoPath || '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
  if (!normalized) return '';
  if (normalized.startsWith('public/')) {
    return `/${normalized.replace(/^public\//, '')}`;
  }
  if (normalized.startsWith('public\\')) {
    return `/${normalized.replace(/^public\\/, '')}`;
  }
  if (normalized.startsWith('media/')) {
    return `/${normalized}`;
  }
  if (normalized.startsWith('/')) return normalized;
  return `/${normalized}`;
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
    const manifestItems = readManifest();
    const seenKeys = new Set();
    const out = [];

    manifestItems
      .filter((entry) => folderMatchesTarget(entry.folder || '', dir))
      .forEach((entry) => {
        const folder = normalizeFolder(entry.folder || dir);
        const repoPath = entry.path
          ? entry.path
          : path.posix.join('public', 'media', folder, entry.fileName || '').replace(/\\/g, '/');
        const meta = enrichMeta(path.posix.join(folder, entry.fileName || entry.name || ''));
        const type = (entry.type || meta.type || classify(entry.fileName || entry.url || entry.name || '')).toLowerCase();
        const url = entry.url || buildUrlFromPath(repoPath);
        const key = (entry.id || repoPath || entry.url || `${folder}/${entry.fileName || entry.name || ''}`).toLowerCase();
        if (seenKeys.has(key)) return;
        seenKeys.add(key);
        const absolute = repoPath ? path.join(cwd, repoPath) : '';
        const existsOnDisk = absolute ? fs.existsSync(absolute) : false;
        out.push({
          id: entry.id || key,
          name: entry.name || entry.fileName || entry.url,
          fileName: entry.fileName || '',
          url,
          path: repoPath,
          folder,
          type,
          source: 'manifest',
          category: meta.category,
          categoryLabel: meta.categoryLabel,
          tags: Array.from(new Set([...(meta.tags || []), ...((entry.tags || []))])),
          kind: type,
          status: entry.status || (existsOnDisk ? 'available' : url ? 'external' : 'missing'),
          notes: entry.notes || '',
          existsOnDisk,
        });
      });

    const adminRoot = path.join(cwd, 'public', 'media', dir);
    const adminFiles = listFiles(adminRoot);
    for (const name of adminFiles) {
      const folder = dir;
      const repoPath = path.posix.join('public', 'media', folder, name).replace(/\\/g, '/');
      const key = repoPath.toLowerCase();
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      const meta = enrichMeta(path.posix.join(folder, name));
      out.push({
        id: key,
        name,
        fileName: name,
        url: buildUrlFromPath(repoPath),
        path: repoPath,
        folder,
        type: (meta.type || classify(name)).toLowerCase(),
        source: 'filesystem',
        category: meta.category,
        categoryLabel: meta.categoryLabel,
        tags: meta.tags,
        kind: meta.type,
        status: 'available',
        notes: '',
        existsOnDisk: true,
      });
    }

    if (GAME_ENABLED) {
      const gameRoot = path.join(cwd, 'game', 'public', 'media', dir);
      const gameFiles = listFiles(gameRoot);
      for (const name of gameFiles) {
        const folder = dir;
        const relative = path.posix.join(folder, name);
        const key = `game://${relative.toLowerCase()}`;
        if (seenKeys.has(key)) continue;
        const meta = enrichMeta(relative);
        out.push({
          id: key,
          name,
          fileName: name,
          url: `/media/${relative}`,
          path: '',
          folder,
          type: (meta.type || classify(name)).toLowerCase(),
          source: 'game',
          category: meta.category,
          categoryLabel: meta.categoryLabel,
          tags: meta.tags,
          kind: meta.type,
          status: 'game-fallback',
          notes: 'Served from game bundle',
          existsOnDisk: false,
        });
        seenKeys.add(key);
      }
    }

    out.sort((a, b) => {
      return (a.name || '').toString().toLowerCase().localeCompare((b.name || '').toString().toLowerCase());
    });

    return res.status(200).json({ ok: true, dir, items: out });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
