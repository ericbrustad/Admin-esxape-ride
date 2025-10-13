import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TestLauncher from '../components/TestLauncher';
import AnswerResponseEditor from '../components/AnswerResponseEditor';
import InlineMissionResponses from '../components/InlineMissionResponses';
import AssignedMediaTab from '../components/AssignedMediaTab';
import { AppearanceEditor } from '../components/ui-kit';
import {
  normalizeTone,
  appearanceBackgroundStyle,
  defaultAppearance,
  surfaceStylesFromAppearance,
} from '../lib/admin-shared';
import { GAME_ENABLED } from '../lib/game-switch';

/* ───────────────────────── Helpers ───────────────────────── */
async function fetchJsonSafe(url, fallback) {
  try {
    const r = await fetch(url, { cache: 'no-store', credentials: 'include' });
    const ct = r.headers.get('content-type') || '';
    if (r.ok && ct.includes('application/json')) return await r.json();
  } catch {}
  return fallback;
}
async function fetchFirstJson(urls, fallback) {
  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: 'no-store', credentials: 'include' });
      const ct = r.headers.get('content-type') || '';
      if (r.ok && ct.includes('application/json')) return await r.json();
    } catch {}
  }
  return fallback;
}
function toDirectMediaURL(u) {
  if (!u) return u;
  try {
    const url = new URL(u, typeof window !== 'undefined' ? window.location.origin : 'http://local');
    const host = url.host.toLowerCase();
    if (host.endsWith('dropbox.com')) {
      url.host = 'dl.dropboxusercontent.com';
      url.searchParams.delete('dl');
      if (!url.searchParams.has('raw')) url.searchParams.set('raw', '1');
      return url.toString();
    }
    if (host.endsWith('drive.google.com')) {
      let id = '';
      if (url.pathname.startsWith('/file/d/')) {
        const parts = url.pathname.split('/');
        id = parts[3] || '';
      } else if (url.pathname === '/open') {
        id = url.searchParams.get('id') || '';
      }
      if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
    }
    return u;
  } catch { return u; }
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function hexToRgb(hex) {
  try {
    const h = hex.replace('#','');
    const b = h.length === 3 ? h.split('').map(ch=>ch+ch).join('') : h;
    const r = parseInt(b.slice(0,2),16), g = parseInt(b.slice(2,4),16), bl = parseInt(b.slice(4,6),16);
    return `${r}, ${g}, ${bl}`;
  } catch { return '0,0,0'; }
}
const EXTS = {
  image: /\.(png|jpg|jpeg|webp)$/i,
  gif: /\.(gif)$/i,
  video: /\.(mp4|webm|mov)$/i,
  audio: /\.(mp3|wav|ogg|m4a|aiff|aif)$/i, // include AIFF/AIF
};
function classifyByExt(u) {
  if (!u) return 'other';
  const s = String(u).toLowerCase();
  if (EXTS.gif.test(s)) return 'gif';
  if (EXTS.image.test(s)) return 'image';
  if (EXTS.video.test(s)) return 'video';
  if (EXTS.audio.test(s)) return 'audio';
  return 'other';
}

/** Merge inventory across dirs so uploads show up everywhere */
async function listInventory(dirs
