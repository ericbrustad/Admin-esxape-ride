// pages/api/upload.js
// JSON body: {
//   fileName?: string,
//   folder?: string,
//   path?: string,
//   contentBase64?: string,
//   remoteUrl?: string,
//   sizeBytes?: number
// }
// Registers media metadata in public/media/manifest.json. Binary payloads must
// be hosted externally; this endpoint only records references so uploads remain
// hidden from Git history.

import { readManifest, writeManifest, getManifestDebugInfo } from '../../lib/media-manifest.js';
import { uploadSupabaseMedia, isSupabaseMediaEnabled } from '../../lib/supabase-storage.js';

const EXTS = {
  image: /\.(png|jpg|jpeg|webp|svg|bmp|tif|tiff|avif|heic|heif)$/i,
  gif: /\.(gif)$/i,
  video: /\.(mp4|webm|mov)$/i,
  audio: /\.(mp3|wav|ogg|m4a|aiff|aif)$/i,
  ar: /\.(glb|gltf|usdz|reality|vrm|fbx|obj)$/i,
};

function classify(name = '') {
  if (EXTS.gif.test(name)) return 'gif';
  if (EXTS.image.test(name)) return 'image';
  if (EXTS.video.test(name)) return 'video';
  if (EXTS.audio.test(name)) return 'audio';
  if (EXTS.ar.test(name)) return 'ar-overlay';
  return 'other';
}

function resolveFolder(input = '') {
  const trimmed = String(input || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\\/g, '/');
  if (!trimmed) return 'mediapool/Other';
  if (trimmed.toLowerCase() === 'mediapool') return 'mediapool';
  if (trimmed.startsWith('mediapool/')) return trimmed;
  return `mediapool/${trimmed}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST' });

    const {
      fileName,
      folder,
      path: explicitPath,
      remoteUrl,
      sizeBytes,
      contentBase64,
    } = req.body || {};

    const derivedNameFromPath = explicitPath ? explicitPath.split('/').pop() : '';
    const safeName = (fileName || derivedNameFromPath || 'upload')
      .toString()
      .replace(/[^\w.\-]+/g, '_');

    let derivedFolder = '';
    if (typeof folder === 'string' && folder.trim()) {
      derivedFolder = folder;
    } else if (explicitPath) {
      const normalizedPath = explicitPath.replace(/\\/g, '/');
      const marker = 'public/media/';
      const index = normalizedPath.indexOf(marker);
      if (index >= 0) {
        const afterMarker = normalizedPath.slice(index + marker.length);
        derivedFolder = afterMarker.split('/').slice(0, -1).join('/');
      }
    }

    const resolvedFolder = resolveFolder(derivedFolder);
    const { manifest } = readManifest();

    const type = classify(safeName);
    const repoPath = `public/media/${resolvedFolder}/${safeName}`.replace(/\\/g, '/');
    const entryId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

    const entry = {
      id: entryId,
      name: safeName.replace(/\.[^.]+$/, ''),
      fileName: safeName,
      folder: resolvedFolder,
      path: repoPath,
      type: type === 'ar' ? 'ar-overlay' : type,
      url: remoteUrl || '',
      status: remoteUrl ? 'external' : 'pending-external',
      notes: remoteUrl
        ? 'External media registered.'
        : 'Upload recorded. Provide an external URL to activate this asset.',
      sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : undefined,
      createdAt: new Date().toISOString(),
    };

    let supabaseUpload = null;
    if (isSupabaseMediaEnabled() && contentBase64) {
      try {
        supabaseUpload = await uploadSupabaseMedia({
          folder: resolvedFolder,
          fileName: safeName,
          contentBase64,
          sizeBytes,
        });
        if (supabaseUpload?.ok) {
          entry.url = supabaseUpload.publicUrl || entry.url;
          entry.status = 'supabase';
          entry.notes = 'Uploaded to Supabase storage.';
          entry.supabase = {
            bucket: supabaseUpload.bucket,
            path: supabaseUpload.path,
            publicUrl: supabaseUpload.publicUrl,
            sizeBytes: supabaseUpload.sizeBytes,
          };
          entry.sizeBytes = supabaseUpload.sizeBytes;
        } else if (supabaseUpload && !supabaseUpload.skipped) {
          entry.notes = supabaseUpload.error || supabaseUpload.reason || 'Supabase upload failed.';
          entry.status = 'error-supabase';
        }
      } catch (error) {
        entry.status = 'error-supabase';
        entry.notes = error?.message || 'Supabase upload threw unexpectedly.';
      }
    }

    manifest.items = Array.isArray(manifest.items) ? manifest.items : [];
    manifest.items.push(entry);
    manifest.updatedAt = new Date().toISOString();

    const writeResult = writeManifest(manifest);

    const debug = getManifestDebugInfo();

    return res.status(200).json({
      ok: true,
      item: entry,
      manifestPath: writeResult.path,
      manifestFallback: writeResult.fallback,
      storage: {
        manifestPath: writeResult.path,
        fallbackUsed: writeResult.fallback,
        debug,
        supabase: supabaseUpload,
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || String(error) });
  }
}
