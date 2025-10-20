export const MEDIA_EXTENSION_PATTERNS = {
  image: /\.(png|jpe?g|webp|bmp|svg|tif|tiff|avif|heic|heif)$/i,
  gif: /\.(gif)$/i,
  video: /\.(mp4|webm|mov|m4v)$/i,
  audio: /\.(mp3|wav|ogg|m4a|aiff|aif)$/i,
  model: /\.(glb|gltf|usdz|usd|fbx|obj|dae|3ds|ply|stl)$/i,
};

const CONTEXT_FOLDERS = {
  settings: {
    image: 'covers',
    gif: 'covers',
  },
  missions: {
    image: 'missions/images',
    audio: 'missions/audio',
    video: 'missions/video',
    gif: 'missions/gif',
  },
  devices: {
    image: 'devices/icons',
    audio: 'devices/audio',
    video: 'devices/video',
    gif: 'devices/gif',
  },
  assigned: {
    image: 'assigned/images',
    audio: 'assigned/audio',
    video: 'assigned/video',
    gif: 'assigned/gif',
  },
  'media-pool': {
    image: 'mediapool/images',
    audio: 'mediapool/audio',
    video: 'mediapool/video',
    gif: 'mediapool/gif',
  },
  uploads: {
    image: 'uploads/images',
    audio: 'uploads/audio',
    video: 'uploads/video',
    gif: 'uploads/gif',
  },
};

const DEFAULT_TYPE_FOLDERS = {
  image: CONTEXT_FOLDERS.uploads.image,
  audio: CONTEXT_FOLDERS.uploads.audio,
  video: CONTEXT_FOLDERS.uploads.video,
  gif: CONTEXT_FOLDERS.uploads.gif,
  '3d': CONTEXT_FOLDERS.uploads.image,
};

export function classifyMediaType(value, mime = '') {
  const name = String(value || '').toLowerCase();
  const type = String(mime || '').toLowerCase();

  if (type.includes('gif') || MEDIA_EXTENSION_PATTERNS.gif.test(name)) return 'gif';
  if (type.startsWith('audio/') || MEDIA_EXTENSION_PATTERNS.audio.test(name)) return 'audio';
  if (type.startsWith('video/') || type.includes('quicktime') || MEDIA_EXTENSION_PATTERNS.video.test(name)) return 'video';
  if (MEDIA_EXTENSION_PATTERNS.model.test(name)) return '3d';
  if (type.startsWith('image/') || MEDIA_EXTENSION_PATTERNS.image.test(name)) return 'image';
  return 'other';
}

export function resolveMediaSubfolder(mediaType, context) {
  const typeKey = (mediaType === 'gif'
    ? 'gif'
    : mediaType === '3d'
      ? 'image'
      : mediaType);
  const ctx = context ? CONTEXT_FOLDERS[context] : null;
  if (ctx && ctx[typeKey]) return ctx[typeKey];
  if (ctx && typeKey === 'gif' && ctx.image) return ctx.image;
  if (context && CONTEXT_FOLDERS.uploads[typeKey]) return CONTEXT_FOLDERS.uploads[typeKey];
  return DEFAULT_TYPE_FOLDERS[typeKey] || 'uploads/misc';
}

export const MEDIA_DIRECTORY_ALIASES = {
  uploads: ['uploads', 'uploads/images', 'uploads/audio', 'uploads/video', 'uploads/gif'],
  missions: ['missions', 'missions/images', 'missions/audio', 'missions/video', 'missions/gif'],
  devices: ['devices', 'devices/icons', 'devices/audio', 'devices/video', 'devices/gif'],
  assigned: ['assigned', 'assigned/images', 'assigned/audio', 'assigned/video', 'assigned/gif'],
  mediapool: ['mediapool', 'mediapool/images', 'mediapool/audio', 'mediapool/video', 'mediapool/gif'],
  'media-pool': ['mediapool', 'mediapool/images', 'mediapool/audio', 'mediapool/video', 'mediapool/gif'],
  covers: ['covers'],
  icons: ['icons'],
  bundles: ['bundles'],
};

export function expandMediaDirectories(entries = []) {
  const out = new Set();
  (entries || []).forEach((entry) => {
    if (!entry && entry !== 0) return;
    const key = String(entry).replace(/^\/+|\/+$/g, '');
    const aliases = MEDIA_DIRECTORY_ALIASES[key] || [key];
    aliases.forEach((dir) => {
      if (!dir) return;
      out.add(dir);
    });
  });
  return Array.from(out);
}

export const DEFAULT_MEDIA_INVENTORY_DIRS = expandMediaDirectories([
  'covers',
  'icons',
  'bundles',
  'uploads',
  'missions',
  'devices',
  'assigned',
  'mediapool',
]);
