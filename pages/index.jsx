import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TestLauncher from '../components/TestLauncher';
import AnswerResponseEditor from '../components/AnswerResponseEditor';
import InlineMissionResponses from '../components/InlineMissionResponses';
import AssignedMediaTab from '../components/AssignedMediaTab';
import SafeBoundary from '../components/SafeBoundary';
import { AppearanceEditor } from '../components/ui-kit';
import {
  normalizeTone,
  appearanceBackgroundStyle,
  defaultAppearance,
  surfaceStylesFromAppearance,
  DEFAULT_APPEARANCE_SKIN,
} from '../lib/admin-shared';
import { GAME_ENABLED } from '../lib/game-switch';
import {
  classifyMediaType,
  resolveMediaSubfolder,
  expandMediaDirectories,
  DEFAULT_MEDIA_INVENTORY_DIRS,
  MEDIA_EXTENSION_PATTERNS,
} from '../lib/media-types';

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
const COVER_SIZE_LIMIT_BYTES = 5 * 1024 * 1024; // 5 MB limit for cover uploads
const ADMIN_META_INITIAL_STATE = {
  branch: '',
  commit: '',
  owner: '',
  repo: '',
  vercelUrl: '',
  deploymentUrl: '',
  deploymentState: '',
  fetchedAt: '',
  error: '',
};
function classifyByExt(u, mime) {
  return classifyMediaType(u, mime);
}

/** Merge inventory across dirs so uploads show up everywhere */
async function listInventory(dirs = DEFAULT_MEDIA_INVENTORY_DIRS) {
  const seen = new Set();
  const out = [];
  const targets = expandMediaDirectories(dirs);
  await Promise.all(targets.map(async (dir) => {
    try {
      const r = await fetch(`/api/list-media?dir=${encodeURIComponent(dir)}`, { credentials: 'include', cache: 'no-store' });
      const j = await r.json();
      (j?.items || []).forEach(it => {
        const url = it.url || '';
        if (!seen.has(url)) { seen.add(url); out.push(it); }
      });
    } catch {}
  }));
  return out;
}
function baseNameFromUrl(url) {
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://local');
    const file = (u.pathname.split('/').pop() || '').replace(/\.[^.]+$/, '');
    return file.replace(/[-_]+/g, ' ').trim();
  } catch {
    const file = (String(url).split('/').pop() || '').replace(/\.[^.]+$/, '');
    return file.replace(/[-_]+/g, ' ').trim();
  }
}
function qs(obj) {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k,v])=>{
    if (v===undefined || v===null || v==='') return;
    p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}
// compute repo path from /media/... URL
function pathFromUrl(u) {
  try {
    const url = new URL(u, typeof window !== 'undefined' ? window.location.origin : 'http://local');
    const p = url.pathname || '';
    if (p.startsWith('/media/')) return `public${p}`;
    if (p.startsWith('/public/media/')) return p;
  } catch {}
  const s = String(u || '');
  if (s.startsWith('/media/')) return `public${s}`;
  if (s.startsWith('/public/media/')) return s;
  return ''; // external or unknown
}

function formatLocalDateTime(value) {
  if (!value) return '';
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}


async function deleteMediaPath(repoPath) {
  const endpoints = [
    '/api/delete-media',
    '/api/delete',
    '/api/media/delete',
    '/api/repo-delete',
    '/api/github/delete',
  ];
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        credentials:'include',
        body: JSON.stringify({ path: repoPath })
      });
      if (r.ok) return true;
    } catch {}
  }
  return false;
}

async function fileToBase64(file) {
  if (!file) return '';
  if (typeof window !== 'undefined' && typeof window.FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          const base64 = result.split(',')[1] || '';
          resolve(base64);
        } else {
          reject(new Error('Unable to read file contents'));
        }
      };
      reader.onerror = () => reject(reader.error || new Error('Unable to read file contents'));
      reader.readAsDataURL(file);
    });
  }
  const arrayBuffer = await file.arrayBuffer();
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(arrayBuffer).toString('base64');
  }
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  if (typeof btoa === 'function') return btoa(binary);
  throw new Error('Base64 conversion is not supported in this environment');
}

/* ───────────────────────── Defaults ───────────────────────── */
const DEFAULT_MISSION_ICONS = [
  { key:'aurora-beacon',  name:'Aurora Beacon',  url:'/media/icons/aurora-beacon.svg' },
  { key:'briefing-star',  name:'Briefing Star',  url:'/media/icons/aurora-beacon.svg' },
  { key:'decoy-glow',     name:'Decoy Glow',     url:'/media/icons/lumen-halo.svg' },
  { key:'lantern-clue',   name:'Lantern Clue',   url:'/media/icons/lumen-halo.svg' },
  { key:'helm-brief',     name:'Helm Brief',     url:'/media/icons/voyager-dial.svg' },
  { key:'voyager-dial',   name:'Voyager Dial',   url:'/media/icons/voyager-dial.svg' },
  { key:'quantum-anchor', name:'Quantum Anchor', url:'/media/icons/quantum-anchor.svg' },
  { key:'missions-1',     name:'Smoke Bomb',     url:'/media/bundles/SMOKE%20BOMB.png' },
  { key:'trivia',         name:'Trivia',         url:'/media/bundles/trivia%20icon.png' },
  { key:'trivia-2',       name:'Trivia 2',       url:'/media/bundles/trivia%20yellow.png' },
];

const DEFAULT_BUNDLES = {
  devices: [
    { key:'smoke-shield', name:'Smoke Shield', url:'/media/bundles/SMOKE%20BOMB.png' },
    { key:'roaming-robot', name:'Roaming Robot', url:'/media/bundles/ROBOT1small.png' },
  ],
  missions: DEFAULT_MISSION_ICONS,
  rewards: [
    { key:'evidence',  name:'Evidence',  url:'/media/bundles/evidence%202.png' },
    { key:'clue',      name:'Clue',      url:'/media/bundles/CLUEgreen.png' },
    { key:'gold-coin', name:'Gold Coin', url:'/media/bundles/GOLDEN%20COIN.png' },
  ],
};

function applyDefaultIcons(cfg) {
  const next = { ...cfg, icons: { missions:[], devices:[], rewards:[], ...(cfg.icons || {}) } };
  function ensure(kind, arr) {
    const list = [...(next.icons[kind] || [])];
    const keys = new Set(list.map(x => (x.key||'').toLowerCase()));
    for (const it of arr) {
      if (!keys.has((it.key||'').toLowerCase())) list.push({ ...it });
    }
    next.icons[kind] = list;
  }
  ensure('missions', DEFAULT_BUNDLES.missions);
  ensure('devices',  DEFAULT_BUNDLES.devices);
  ensure('rewards',  DEFAULT_BUNDLES.rewards);
  return next;
}

function buildMissionIconLookup(cfg) {
  const map = new Map();
  const icons = (cfg && cfg.icons) || {};
  const add = (icon, { override = false } = {}) => {
    if (!icon) return;
    const rawKey = (icon.key ?? '').toString().trim();
    const rawUrl = (icon.url ?? '').toString().trim();
    if (!rawKey || !rawUrl) return;
    const key = rawKey.toLowerCase();
    if (!override && map.has(key)) return;
    map.set(key, {
      key: rawKey,
      name: icon.name || rawKey,
      url: rawUrl,
    });
  };

  (Array.isArray(icons.missions) ? icons.missions : []).forEach((icon) => add(icon, { override: true }));
  (Array.isArray(icons.devices) ? icons.devices : []).forEach((icon) => add(icon));
  DEFAULT_MISSION_ICONS.forEach((icon) => add(icon));
  return map;
}

/* ───────────────────────── Constants ───────────────────────── */
const TYPE_FIELDS = {
  multiple_choice: [
    { key:'question', label:'Question', type:'text' },
    { key:'mediaUrl', label:'Image or Video URL (optional)', type:'text', optional: true },
  ],
  short_answer: [
    { key:'question',   label:'Question', type:'text' },
    { key:'answer',     label:'Correct Answer', type:'text' },
    { key:'acceptable', label:'Also Accept (comma-separated)', type:'text', optional: true },
    { key:'mediaUrl',   label:'Image or Video URL (optional)', type:'text', optional: true },
  ],
  statement: [
    { key:'text',     label:'Statement Text', type:'multiline' },
    { key:'mediaUrl', label:'Image or Video URL (optional)', type:'text', optional: true },
  ],
  video: [
    { key:'videoUrl',   label:'Video URL (https)', type:'text' },
    { key:'overlayText',label:'Overlay Text (optional)', type:'text', optional: true },
  ],
  geofence_image: [
    { key:'lat', label:'Latitude', type:'number' },
    { key:'lng', label:'Longitude', type:'number' },
    { key:'radiusMeters',    label:'Geofence Radius (m)', type:'number', min:5, max:500 },
    { key:'cooldownSeconds', label:'Cooldown (sec)', type:'number', min:5, max:240 },
    { key:'imageUrl',  label:'Image URL (https)', type:'text' },
    { key:'overlayText',label:'Caption/Text', type:'text', optional: true },
  ],
  geofence_video: [
    { key:'lat', label:'Latitude', type:'number' },
    { key:'lng', label:'Longitude', type:'number' },
    { key:'radiusMeters',    label:'Geofence Radius (m)', type:'number', min:5, max:500 },
    { key:'cooldownSeconds', label:'Cooldown (sec)', type:'number', min:5, max:240 },
    { key:'videoUrl',  label:'Video URL (https)', type:'text' },
    { key:'overlayText',label:'Overlay Text (optional)', type:'text', optional: true },
  ],
  ar_image: [
    { key:'markerUrl', label:'AR Marker Image URL (png/jpg)', type:'text' },
    { key:'assetUrl',  label:'AR Overlay Image URL (png/jpg)', type:'text' },
    { key:'overlayText',label:'Overlay Text (optional)', type:'text', optional: true },
  ],
  ar_video: [
    { key:'markerUrl', label:'AR Marker Image URL (png/jpg)', type:'text' },
    { key:'assetUrl',  label:'AR Video URL (mp4)', type:'text' },
    { key:'overlayText',label:'Overlay Text (optional)', type:'text', optional: true },
  ],
  stored_statement: [
    { key:'template', label:'Template Text (use #mXX# to insert answers)', type:'multiline' },
  ],
};
const TYPE_LABELS = {
  multiple_choice:  'Multiple Choice',
  short_answer:     'Question (Short Answer)',
  statement:        'Statement',
  video:            'Video',
  geofence_image:   'Geo Fence Image',
  geofence_video:   'Geo Fence Video',
  ar_image:         'AR Image',
  ar_video:         'AR Video',
  stored_statement: 'Stored Statement',
};

const GAME_TYPES = ['Mystery','Chase','Race','Thriller','Hunt'];
const DEVICE_TYPES = [
  { value:'smoke',  label:'Smoke (hide on GPS)' },
  { value:'clone',  label:'Clone (decoy location)' },
  { value:'jammer', label:'Signal Jammer (blackout radius)' },
];
const DEFAULT_TRIGGER_CONFIG = {
  enabled: false,
  actionType: 'media',
  actionTarget: '',
  actionLabel: '',
  actionThumbnail: '',
  triggerDeviceId: '',
  triggerDeviceLabel: '',
  triggeredResponseKey: '',
  triggeredMissionId: '',
};
function sanitizeTriggerConfig(input = {}) {
  const src = input || {};
  const validType = ['media', 'devices', 'missions'].includes(src.actionType) ? src.actionType : 'media';
  return {
    enabled: !!src.enabled,
    actionType: validType,
    actionTarget: src.actionTarget || '',
    actionLabel: src.actionLabel || '',
    actionThumbnail: src.actionThumbnail || '',
    triggerDeviceId: src.triggerDeviceId || '',
    triggerDeviceLabel: src.triggerDeviceLabel || '',
    triggeredResponseKey: src.triggeredResponseKey || '',
    triggeredMissionId: src.triggeredMissionId || '',
  };
}
function mergeTriggerState(current, partial = {}) {
  return { ...DEFAULT_TRIGGER_CONFIG, ...(current || {}), ...(partial || {}) };
}
function createDeviceDraft(overrides = {}) {
  const base = {
    title: '',
    type: 'smoke',
    iconKey: '',
    pickupRadius: 100,
    effectSeconds: 120,
    lat: null,
    lng: null,
    trigger: { ...DEFAULT_TRIGGER_CONFIG },
  };
  const merged = { ...base, ...overrides };
  merged.trigger = { ...DEFAULT_TRIGGER_CONFIG, ...(overrides.trigger || merged.trigger || {}) };
  return merged;
}
const STARFIELD_DAWN_APPEARANCE = {
  ...defaultAppearance(),
  fontFamily: '"Exo 2", "Segoe UI", sans-serif',
  fontSizePx: 23,
  fontColor: '#262a58',
  textBgColor: '#f4f0ff',
  textBgOpacity: 0.7,
  screenBgColor: '#e0dcfa',
  screenBgOpacity: 0.46,
  screenBgImage: '/media/skins/starfield-dawn.svg',
  screenBgImageEnabled: true,
  textAlign: 'center',
  textVertical: 'top',
};

const STARFIELD_DAWN_SKIN_BASE = {
  label: 'Starfield Dawn',
  description: 'Unified Starfield Dawn admin skin.',
  uiKey: 'starfield-dawn',
};

const APPEARANCE_SKIN_KEYS = [
  'default',
  'space-military',
  'military-desert',
  'forest-outpost',
  'starfield',
  'cartoon-bubbles',
  'chrome-luminous',
  'desert-horizon',
  'forest-meadow',
  'starfield-dawn',
  'cartoon-parade',
  'arctic-lab',
];

const APPEARANCE_SKINS = APPEARANCE_SKIN_KEYS.map((key) => ({
  key,
  ...STARFIELD_DAWN_SKIN_BASE,
  appearance: { ...STARFIELD_DAWN_APPEARANCE },
}));
const APPEARANCE_SKIN_MAP = new Map(APPEARANCE_SKINS.map((skin) => [skin.key, skin]));
const ADMIN_SKIN_TO_UI = new Map(APPEARANCE_SKINS.map((skin) => [skin.key, skin.uiKey || skin.key]));
const DEFAULT_SKIN_PRESET = APPEARANCE_SKIN_MAP.get(DEFAULT_APPEARANCE_SKIN);
const DEFAULT_UI_SKIN = ADMIN_SKIN_TO_UI.get(DEFAULT_APPEARANCE_SKIN) || DEFAULT_APPEARANCE_SKIN;

function applyAdminUiThemeForDocument(skinKey, appearance, tone = 'light') {
  if (typeof document === 'undefined') return;
  const body = document.body;
  if (!body) return;
  const root = document.documentElement;
  const uiKey = ADMIN_SKIN_TO_UI.get(skinKey) || DEFAULT_UI_SKIN;
  const normalizedTone = normalizeTone(tone);
  const background = appearanceBackgroundStyle(appearance, normalizedTone);
  const surfaces = surfaceStylesFromAppearance(appearance, normalizedTone);
  const overlay = clamp(Number(appearance?.screenBgOpacity ?? 0), 0, 1);
  const fontSize = clamp(Number(appearance?.fontSizePx ?? 22), 10, 72);
  const fontFamily = appearance?.fontFamily || '';
  const textColor = normalizedTone === 'dark'
    ? '#f4f7ff'
    : (appearance?.fontColor || '#1f2d3a');
  const textBg = `rgba(${hexToRgb(appearance?.textBgColor || '#000000')}, ${clamp(Number(appearance?.textBgOpacity ?? 0), 0, 1)})`;
  const mutedColor = normalizedTone === 'dark'
    ? 'rgba(198, 212, 236, 0.78)'
    : 'rgba(36, 52, 72, 0.68)';
  const inputBg = normalizedTone === 'dark'
    ? `rgba(12, 18, 28, ${clamp(0.78 + overlay * 0.12, 0.72, 0.92)})`
    : `rgba(255, 255, 255, ${clamp(0.88 - overlay * 0.28, 0.55, 0.97)})`;
  const inputBorder = normalizedTone === 'dark'
    ? '1px solid rgba(132, 176, 226, 0.42)'
    : '1px solid rgba(128, 156, 204, 0.42)';
  const buttonColor = normalizedTone === 'dark' ? '#f4f7ff' : '#0e1c2e';
  body.dataset.skin = uiKey;
  body.dataset.tone = normalizedTone;
  body.style.backgroundColor = background.backgroundColor || '';
  body.style.backgroundImage = background.backgroundImage || 'none';
  body.style.backgroundSize = background.backgroundSize || '';
  body.style.backgroundRepeat = background.backgroundRepeat || '';
  body.style.backgroundPosition = background.backgroundPosition || '';
  body.style.backgroundBlendMode = background.backgroundBlendMode || '';
  body.style.setProperty('--appearance-panel-bg', surfaces.panelBg);
  body.style.setProperty('--appearance-panel-border', surfaces.panelBorder);
  body.style.setProperty('--appearance-panel-shadow', surfaces.panelShadow);
  body.style.setProperty('--appearance-piping-opacity', String(surfaces.pipingOpacity));
  body.style.setProperty('--appearance-piping-shadow', surfaces.pipingShadow);
  body.style.setProperty('--appearance-screen-overlay', String(overlay));
  body.style.setProperty('--admin-body-color', textColor);
  body.style.setProperty('--admin-muted', mutedColor);
  body.style.setProperty('--admin-input-bg', inputBg);
  body.style.setProperty('--admin-input-border', inputBorder);
  body.style.setProperty('--admin-input-color', textColor);
  body.style.setProperty('--admin-button-color', buttonColor);
  if (appearance?.screenBgImage && appearance?.screenBgImageEnabled !== false) {
    body.style.setProperty('--appearance-panel-surface', 'none');
  } else {
    body.style.removeProperty('--appearance-panel-surface');
  }
  body.dataset.panelDepth = appearance?.panelDepth === false ? 'flat' : 'deep';
  if (root) {
    if (fontFamily) root.style.setProperty('--appearance-font-family', fontFamily);
    else root.style.removeProperty('--appearance-font-family');
    root.style.setProperty('--appearance-font-size', `${fontSize}px`);
    root.style.setProperty('--appearance-font-color', textColor);
    root.style.setProperty('--appearance-text-bg', textBg);
  }
}

function isAppearanceEqual(a, b) {
  if (!a || !b) return false;
  const keys = [
    'fontFamily',
    'fontSizePx',
    'fontColor',
    'textBgColor',
    'textBgOpacity',
    'screenBgColor',
    'screenBgOpacity',
    'screenBgImage',
    'screenBgImageEnabled',
    'textAlign',
    'textVertical',
    'panelDepth',
  ];
  return keys.every((key) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === 'number' || typeof bv === 'number') {
      return Math.abs(Number(av ?? 0) - Number(bv ?? 0)) < 0.0001;
    }
    return String(av ?? '') === String(bv ?? '');
  });
}
function detectAppearanceSkin(appearance, fallbackKey) {
  if (fallbackKey && APPEARANCE_SKIN_MAP.has(fallbackKey)) {
    const preset = APPEARANCE_SKIN_MAP.get(fallbackKey);
    if (preset && isAppearanceEqual(appearance, preset.appearance)) return fallbackKey;
  }
  for (const skin of APPEARANCE_SKINS) {
    if (isAppearanceEqual(appearance, skin.appearance)) return skin.key;
  }
  return 'custom';
}
const DEFAULT_ICONS = { missions:[], devices:[], rewards:[] };

function normalizeGameMetadata(cfg, slug = '') {
  const base = { ...(cfg || {}) };
  const game = { ...(base.game || {}) };
  const rawTags = Array.isArray(game.tags) ? game.tags : [];
  const cleaned = [];
  const seen = new Set();
  rawTags.forEach((tag) => {
    const str = String(tag || '').trim();
    if (!str) return;
    const key = str.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    cleaned.push(str);
  });
  const normalizedSlug = (slug || '').toString().trim().toLowerCase() || 'default';
  if (!seen.has(normalizedSlug)) {
    cleaned.push(normalizedSlug);
    seen.add(normalizedSlug);
  }
  if (normalizedSlug === 'default' && !seen.has('default-game')) {
    cleaned.push('default-game');
    seen.add('default-game');
  }
  const normalizedTitle = (game.title || '').toString().trim();
  const normalizedType = (game.type || '').toString().trim();
  const normalizedCover = typeof game.coverImage === 'string' ? game.coverImage.trim() : '';
  const normalizedShort = typeof game.shortDescription === 'string' ? game.shortDescription.trim() : '';
  const normalizedLong = typeof game.longDescription === 'string' ? game.longDescription.trim() : '';
  game.tags = cleaned;
  game.title = normalizedTitle || 'Default Game';
  game.type = normalizedType || 'Mystery';
  game.coverImage = normalizedCover;
  game.shortDescription = normalizedShort;
  game.longDescription = normalizedLong;
  game.slug = normalizedSlug;
  game.deployEnabled = game.deployEnabled !== false;
  base.game = game;
  return base;
}

function slugifyTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/* ───────────────────────── Root ───────────────────────── */
export default function Admin() {
  const gameEnabled = GAME_ENABLED;
  const [tab, setTab] = useState('missions');

  const [adminMeta, setAdminMeta] = useState(ADMIN_META_INITIAL_STATE);

  const [games, setGames] = useState([]);
  const [activeSlug, setActiveSlug] = useState('default'); // Default Game → legacy root
  const [showNewGame, setShowNewGame] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('Mystery');
  const [newMode, setNewMode] = useState('single');
  const [newDurationMin, setNewDurationMin] = useState(0);
  const [newAlertMin, setNewAlertMin] = useState(10);
  const [newGameSlug, setNewGameSlug] = useState('');
  const [newSlugTouched, setNewSlugTouched] = useState(false);
  const [newShortDesc, setNewShortDesc] = useState('');
  const [newLongDesc, setNewLongDesc] = useState('');
  const [newCoverPreview, setNewCoverPreview] = useState('');
  const [newCoverFile, setNewCoverFile] = useState(null);
  const [newCoverSelectedUrl, setNewCoverSelectedUrl] = useState('');
  const [newCoverOptions, setNewCoverOptions] = useState([]);
  const [newCoverLookupLoading, setNewCoverLookupLoading] = useState(false);
  const [newGameStatus, setNewGameStatus] = useState('');
  const [newGameBusy, setNewGameBusy] = useState(false);
  const [newCoverDropActive, setNewCoverDropActive] = useState(false);
  const newGameCoverInputRef = useRef(null);

  const [missionActionFlash, setMissionActionFlash] = useState(false);
  const [deviceActionFlash, setDeviceActionFlash] = useState(false);
  const [newMissionButtonFlash, setNewMissionButtonFlash] = useState(false);
  const [addDeviceButtonFlash, setAddDeviceButtonFlash] = useState(false);
  const missionFlashTimeout = useRef(null);
  const deviceFlashTimeout = useRef(null);
  const missionButtonTimeout = useRef(null);
  const deviceButtonTimeout = useRef(null);

  const logConversation = useCallback((speaker, text) => {
    if (!text) return;
    setStatusLog((prev) => {
      const entry = { speaker, text, timestamp: new Date().toISOString() };
      const next = [...prev, entry];
      return next.slice(-20);
    });
  }, []);

  const setStatus = useCallback((message) => {
    setStatusInternal(message);
    if (message) logConversation('GPT', message);
  }, [logConversation]);

  const [protectionPrompt, setProtectionPrompt] = useState({
    open: false,
    mode: 'enable',
    requireConfirm: false,
    password: '',
    confirm: '',
    error: '',
  });

  function resetNewGameForm() {
    setNewTitle('');
    setNewType('Mystery');
    setNewMode('single');
    setNewDurationMin(0);
    setNewAlertMin(10);
    setNewGameSlug('');
    setNewSlugTouched(false);
    setNewShortDesc('');
    setNewLongDesc('');
    setNewCoverPreview('');
    setNewCoverFile(null);
    setNewCoverSelectedUrl('');
    setNewCoverOptions([]);
    setNewCoverLookupLoading(false);
    setNewGameStatus('');
    setNewGameBusy(false);
    setNewCoverDropActive(false);
    if (newGameCoverInputRef.current) newGameCoverInputRef.current.value = '';
  }

  const openNewGameModal = useCallback(() => {
    logConversation('You', 'Opened “Create New Game”');
    setShowNewGame(true);
  }, [logConversation]);

  function handleNewGameModalClose() {
    logConversation('You', 'Closed “Create New Game” dialog');
    setShowNewGame(false);
    resetNewGameForm();
  }

  function handleNewSlugInput(value) {
    setNewSlugTouched(true);
    setNewGameSlug(slugifyTitle(value));
  }

  function clearNewGameCover() {
    setNewCoverPreview('');
    setNewCoverFile(null);
    setNewCoverSelectedUrl('');
  }

  async function handleNewGameCoverFile(file) {
    if (!file) return;
    const safeName = file.name || 'cover';
    const looksLikeImage = (file.type && file.type.startsWith('image/')) || MEDIA_EXTENSION_PATTERNS.image.test(file.name || '');
    if (!looksLikeImage) {
      setNewGameStatus(`❌ ${safeName} must be an image file.`);
      return;
    }
    const sizeBytes = file.size || 0;
    if (sizeBytes > COVER_SIZE_LIMIT_BYTES) {
      const sizeKb = Math.max(1, Math.round(sizeBytes / 1024));
      setNewGameStatus(`❌ ${safeName} is ${sizeKb} KB — please choose an image under 5 MB.`);
      return;
    }
    try {
      const previewUrl = (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function')
        ? URL.createObjectURL(file)
        : '';
      setNewCoverPreview(previewUrl);
      setNewCoverFile(file);
      setNewCoverSelectedUrl('');
      setNewGameStatus('✅ Cover ready — it will upload when you create the game.');
    } catch (err) {
      setNewGameStatus(`❌ Unable to preview ${safeName}`);
    }
  }

  async function loadNewCoverOptions() {
    setNewCoverLookupLoading(true);
    try {
      const items = await listInventory(['covers','mediapool','uploads','missions','devices','assigned']);
      const filtered = (items || []).filter((item) => ['image', 'gif'].includes(item.type));
      setNewCoverOptions(filtered);
      if (!filtered.length) {
        setNewGameStatus('No reusable covers found yet. Try uploading one.');
      }
    } catch (err) {
      setNewGameStatus('❌ Unable to load media pool covers.');
      setNewCoverOptions([]);
    } finally {
      setNewCoverLookupLoading(false);
    }
  }

  function applyNewCoverFromUrl(url) {
    if (!url) return;
    const direct = toDirectMediaURL(url);
    setNewCoverSelectedUrl(url);
    setNewCoverPreview(direct);
    setNewCoverFile(null);
    setNewGameStatus('✅ Using cover from the media pool.');
  }

  async function handleCreateNewGame() {
    if (newGameBusy) return;
    const title = newTitle.trim();
    logConversation('You', `Attempted to create new game “${title || 'untitled'}”`);
    if (!deployGameEnabled) {
      setNewGameStatus('🔴 Turn on Publishing to create a game.');
      logConversation('GPT', 'Turn on Publishing to create a game.');
      return;
    }
    if (!gameEnabled) {
      setNewGameStatus('⚠️ Game project is disabled. Attempting to create a new title anyway…');
      logConversation('GPT', 'Game project is disabled. Attempting to create a new title anyway…');
    }
    if (!title) {
      setNewGameStatus('❌ Title is required.');
      return;
    }
    const slugInput = (newGameSlug || slugifyTitle(title) || 'game').trim();
    if (!slugInput) {
      setNewGameStatus('❌ Please provide a slug for this game.');
      return;
    }
    setNewGameBusy(true);
    setNewGameStatus('Creating game…');
    let coverPath = newCoverSelectedUrl;
    try {
      if (!coverPath && newCoverFile) {
        coverPath = await uploadToRepo(newCoverFile, { context: 'settings' });
        if (!coverPath) throw new Error('Cover upload failed');
      }
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title,
          type: newType,
          mode: newMode,
          slug: slugInput,
          shortDescription: newShortDesc.trim(),
          longDescription: newLongDesc.trim(),
          coverImage: coverPath,
          timer: { durationMinutes: newDurationMin, alertMinutes: newAlertMin },
        }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || data.ok === false) {
        throw new Error(data?.error || 'create failed');
      }
      await reloadGamesList();
      setActiveSlug(data.slug || slugInput || 'default');
      setStatus(`✅ Created game “${title}”`);
      setNewGameStatus('✅ Game created! Loading…');
      handleNewGameModalClose();
    } catch (err) {
      setNewGameStatus(`❌ ${(err?.message) || 'Unable to create game'}`);
    } finally {
      setNewGameBusy(false);
    }
  }

  useEffect(() => {
    if (newSlugTouched) return;
    setNewGameSlug(slugifyTitle(newTitle));
  }, [newTitle, newSlugTouched]);

  useEffect(() => {
    return () => {
      [missionFlashTimeout, deviceFlashTimeout, missionButtonTimeout, deviceButtonTimeout].forEach((ref) => {
        if (ref.current) {
          clearTimeout(ref.current);
          ref.current = null;
        }
      });
    };
  }, []);

  useEffect(() => {
    if (!newCoverPreview) return undefined;
    if (
      newCoverPreview.startsWith('blob:') &&
      typeof URL !== 'undefined' &&
      typeof URL.revokeObjectURL === 'function'
    ) {
      const preview = newCoverPreview;
      return () => {
        try { URL.revokeObjectURL(preview); } catch {}
      };
    }
    return undefined;
  }, [newCoverPreview]);

  const [showRings, setShowRings] = useState(true);
  const [testChannel, setTestChannel] = useState('draft');

  const [suite, setSuite]   = useState(null);
  const [config, setConfig] = useState(null);
  const [status, setStatusInternal] = useState('');
  const [statusLog, setStatusLog] = useState([]);

  const [selected, setSelected] = useState(null);
  const [editing, setEditing]   = useState(null);
  const editingIsNew = useMemo(() => {
    if (!editing) return false;
    return !(suite?.missions || []).some((mission) => mission?.id === editing.id);
  }, [editing, suite]);
  // media inventory for editors
  const [inventory, setInventory] = useState([]);
  const fetchInventory = useCallback(async () => {
    try {
      const items = await listInventory(['uploads','bundles','icons','mediapool','covers','missions','devices','assigned']);
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  }, []);
  const syncInventory = useCallback(async () => {
    const items = await fetchInventory();
    setInventory(items);
    return items;
  }, [fetchInventory]);
  useEffect(()=>{
    let mounted = true;
    (async ()=>{
      const items = await fetchInventory();
      if (mounted) setInventory(items);
    })();
    return ()=> { mounted = false; };
  },[fetchInventory]);

  useEffect(() => {
    let cancelled = false;

    async function loadMeta() {
      const nowIso = new Date().toISOString();
      try {
        const [metaRes, vercelRes] = await Promise.all([
          fetch('/api/admin-meta', { cache: 'no-store', credentials: 'include' }).catch(() => null),
          fetch('/api/vercel-status?project=game', { cache: 'no-store', credentials: 'include' }).catch(() => null),
        ]);

        const metaJson = metaRes ? await metaRes.json().catch(() => ({})) : {};
        const vercelJson = vercelRes ? await vercelRes.json().catch(() => ({})) : {};

        if (cancelled) return;

        const metaOk = metaJson?.ok !== false;
        const vercelOk = vercelJson?.ok !== false;

        const deploymentUrlRaw = vercelJson?.url || '';
        const deploymentUrl = typeof deploymentUrlRaw === 'string' && deploymentUrlRaw
          ? (deploymentUrlRaw.startsWith('http') ? deploymentUrlRaw : `https://${deploymentUrlRaw}`)
          : '';
        const deploymentState = vercelJson?.state || (vercelJson?.disabled ? 'DISABLED' : '');
        const combinedError = (!metaOk && metaJson?.error)
          || (!vercelOk && (vercelJson?.error || vercelJson?.reason))
          || '';

        setAdminMeta((prev) => {
          const base = { ...ADMIN_META_INITIAL_STATE, ...(prev || {}) };
          return {
            ...base,
            branch: metaOk && metaJson?.branch ? metaJson.branch : base.branch,
            commit: metaOk && metaJson?.commit ? metaJson.commit : base.commit,
            owner: metaOk && metaJson?.owner ? metaJson.owner : base.owner,
            repo: metaOk && metaJson?.repo ? metaJson.repo : base.repo,
            vercelUrl: metaOk && metaJson?.vercelUrl ? metaJson.vercelUrl : base.vercelUrl,
            deploymentUrl: deploymentUrl || base.deploymentUrl,
            deploymentState: deploymentState ? String(deploymentState).toUpperCase() : base.deploymentState,
            fetchedAt: nowIso,
            error: combinedError || '',
          };
        });
      } catch (err) {
        if (cancelled) return;
        setAdminMeta((prev) => {
          const base = { ...ADMIN_META_INITIAL_STATE, ...(prev || {}) };
          return {
            ...base,
            fetchedAt: new Date().toISOString(),
            error: 'Unable to load deployment status',
          };
        });
      }
    }

    loadMeta();
    const timer = setInterval(loadMeta, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const [uploadStatus, setUploadStatus] = useState('');
  const [protectionState, setProtectionState] = useState({ enabled: false, loading: true, saving: false, updatedAt: null, passwordSet: false });
  const [protectionError, setProtectionError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin-protection?mode=ui', { cache: 'no-store', credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          setProtectionState({
            enabled: !!data.protected,
            loading: false,
            saving: false,
            updatedAt: data.updatedAt || null,
            passwordSet: !!data.passwordSet,
          });
          setProtectionError('');
        } else {
          throw new Error(data?.error || 'Failed to load protection status');
        }
      } catch (err) {
        if (cancelled) return;
        setProtectionState(prev => ({ ...prev, loading: false }));
        setProtectionError('Unable to read protection status');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!config) {
      const fallbackAppearance = DEFAULT_SKIN_PRESET?.appearance || defaultAppearance();
      applyAdminUiThemeForDocument(DEFAULT_APPEARANCE_SKIN, fallbackAppearance, 'light');
      return;
    }
    const stored = config.appearanceSkin && ADMIN_SKIN_TO_UI.has(config.appearanceSkin)
      ? config.appearanceSkin
      : null;
    const detected = detectAppearanceSkin(config.appearance, config.appearanceSkin);
    const tone = normalizeTone(config.appearanceTone);
    applyAdminUiThemeForDocument(stored || detected, config.appearance, tone);
  }, [
    config?.appearanceSkin,
    config?.appearance?.fontFamily,
    config?.appearance?.fontSizePx,
    config?.appearance?.fontColor,
    config?.appearance?.textBgColor,
    config?.appearance?.textBgOpacity,
    config?.appearance?.screenBgColor,
    config?.appearance?.screenBgOpacity,
    config?.appearance?.screenBgImage,
    config?.appearance?.screenBgImageEnabled,
    config?.appearance?.textAlign,
    config?.appearance?.textVertical,
    config?.appearance?.panelDepth,
    config?.appearanceTone,
  ]);


  const [dirty, setDirty]       = useState(false);
  const [missionTriggerPicker, setMissionTriggerPicker] = useState('');
  const missionTriggerState = mergeTriggerState(editing?.trigger);
  function updateMissionTrigger(partial) {
    setEditing(cur => {
      if (!cur) return cur;
      return { ...cur, trigger: mergeTriggerState(cur.trigger, partial) };
    });
    setDirty(true);
  }

  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [coverPickerItems, setCoverPickerItems] = useState([]);
  const [coverPickerLoading, setCoverPickerLoading] = useState(false);
  const [coverDropActive, setCoverDropActive] = useState(false);
  const [coverUploadPreview, setCoverUploadPreview] = useState('');
  const [coverUploadTarget, setCoverUploadTarget] = useState('');
  const [missionResponsesError, setMissionResponsesError] = useState(null);
  const [assignedMediaError, setAssignedMediaError] = useState(null);

  const missionResponsesFallback = useCallback(({ error, reset }) => (
    <div style={S.errorPanel}>
      <div style={S.errorPanelTitle}>Mission responses failed to load</div>
      <div style={S.errorPanelMessage}>
        {error?.message || 'An unexpected error occurred while rendering the mission response editor.'}
      </div>
      <div style={S.errorPanelActions}>
        <button
          type="button"
          style={S.button}
          onClick={() => {
            setMissionResponsesError(null);
            reset();
          }}
        >
          Retry
        </button>
      </div>
    </div>
  ), [setMissionResponsesError]);

  useEffect(() => {
    return () => {
      if (
        coverUploadPreview &&
        coverUploadPreview.startsWith('blob:') &&
        typeof URL !== 'undefined' &&
        typeof URL.revokeObjectURL === 'function'
      ) {
        try { URL.revokeObjectURL(coverUploadPreview); } catch {}
      }
    };
  }, [coverUploadPreview]);

  useEffect(() => {
    if (!coverUploadTarget) return;
    const safeNormalize = (value) => {
      try {
        return toDirectMediaURL(value || '');
      } catch {
        return String(value || '');
      }
    };
    const normalizedTarget = safeNormalize(coverUploadTarget);
    const normalizedCurrent = config?.game?.coverImage ? safeNormalize(config.game.coverImage) : '';
    if (normalizedTarget && normalizedCurrent && normalizedTarget === normalizedCurrent) {
      setCoverUploadTarget('');
      setCoverUploadPreview('');
    }
  }, [config?.game?.coverImage, coverUploadTarget]);
  const coverFileInputRef = useRef(null);
  const [gameTagsDraft, setGameTagsDraft] = useState('');

  // selections
  const [selectedDevIdx, setSelectedDevIdx] = useState(null);
  const [selectedMissionIdx, setSelectedMissionIdx] = useState(null);

  // Devices tab
  const [devSearchQ, setDevSearchQ] = useState('');
  const [devSearching, setDevSearching] = useState(false);
  const [devResults, setDevResults] = useState([]);
  const [isDeviceEditorOpen, setIsDeviceEditorOpen] = useState(false);
  const [deviceEditorMode, setDeviceEditorMode] = useState('new');
  const [devDraft, setDevDraft] = useState(() => createDeviceDraft());
  const [devDraftBaseline, setDevDraftBaseline] = useState(() => createDeviceDraft());
  const [deviceTriggerPicker, setDeviceTriggerPicker] = useState('');

  // Combined Save & Publish
  const [deployDelaySec, setDeployDelaySec] = useState(5);
  const [savePubBusy, setSavePubBusy] = useState(false);

  // Pin size (selected)
  const [selectedPinSize, setSelectedPinSize] = useState(28);
  const defaultPinSize = 24;


  // Settings → Region search
  const [mapSearchQ, setMapSearchQ] = useState('');
  const [mapSearching, setMapSearching] = useState(false);
  const [mapResults, setMapResults] = useState([]);

  // Test preview nonce (force iframe reload)
  const [previewNonce, setPreviewNonce] = useState(0);

  // Delete confirm modal
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const slugForMeta = (!activeSlug || activeSlug === 'default') ? 'default' : activeSlug;

  useEffect(() => {
    const tags = Array.isArray(config?.game?.tags) ? config.game.tags : [];
    setGameTagsDraft(tags.join(', '));
  }, [config?.game?.tags]);

  useEffect(() => {
    try {
      const savedDelay = localStorage.getItem('deployDelaySec');
      if (savedDelay != null) setDeployDelaySec(Math.max(0, Math.min(120, Number(savedDelay) || 0)));
      const savedSel = localStorage.getItem('selectedPinSize');
      if (savedSel != null) setSelectedPinSize(clamp(Number(savedSel) || 28, 16, 120));
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem('deployDelaySec', String(deployDelaySec)); } catch {} }, [deployDelaySec]);
  useEffect(() => { try { localStorage.setItem('selectedPinSize', String(selectedPinSize)); } catch {} }, [selectedPinSize]);

  const gameBase =
    ((typeof window !== 'undefined'
      ? (window.__GAME_ORIGIN__ || process.env.NEXT_PUBLIC_GAME_ORIGIN)
      : process.env.NEXT_PUBLIC_GAME_ORIGIN) || (config?.gameOrigin) || '');

  const getDevices = () => (config?.devices?.length ? config.devices : (config?.powerups || []));
  const setDevices = (list) => setConfig(prev => ({ ...(prev || {}), devices: list, powerups: list }));

  /* load games */
  useEffect(() => {
    if (!gameEnabled) { setGames([]); return; }
    (async () => {
      try {
        const r = await fetch('/api/games', { credentials:'include', cache:'no-store' });
        const j = await r.json();
        if (j.ok) setGames(j.games || []);
      } catch {}
    })();
  }, [gameEnabled]);

  /* load suite/config when slug changes */
  useEffect(() => {
    (async () => {
      try {
        setStatus('Loading…');
        const isDefault = !activeSlug || activeSlug === 'default';

        const missionUrls = isDefault
          ? ['/missions.json']
          : [`/games/${encodeURIComponent(activeSlug)}/missions.json`, `/missions.json`];

        const configUrls = isDefault
          ? ['/api/config']
          : [`/api/config${qs({ slug: activeSlug })}`, '/api/config'];

        const m  = await fetchFirstJson(missionUrls, { version:'0.0.0', missions:[] });
        const c0 = await fetchFirstJson(configUrls, defaultConfig());

        const dc = defaultConfig();
        const normalized = {
          ...m,
          missions: (m.missions || []).map(x => ({
            ...x,
            appearanceOverrideEnabled: !!x.appearanceOverrideEnabled,
            appearance: { ...defaultAppearance(), ...(x.appearance || {}) },
            correct: x.correct || { mode:'none' },
            wrong:   x.wrong   || { mode:'none' },
            showContinue: x.showContinue !== false,
          })),
        };

        let merged = {
          ...dc, ...c0,
          game: { ...dc.game, ...(c0.game || {}) },
          splash: { ...dc.splash, ...(c0.splash || {}) },
          timer: { ...dc.timer, ...(c0.timer || {}) },
          devices: (c0.devices && Array.isArray(c0.devices)) ? c0.devices
                   : (c0.powerups && Array.isArray(c0.powerups)) ? c0.powerups : [],
          media: { rewardsPool:[], penaltiesPool:[], ...(c0.media || {}) },
          icons: { ...DEFAULT_ICONS, ...(c0.icons || {}) },
          appearance: {
            ...defaultAppearance(),
            ...dc.appearance,
            ...(c0.appearance || {}),
          },
          map: { ...dc.map, ...(c0.map || {}) },
          geofence: { ...dc.geofence, ...(c0.geofence || {}) },
          mediaTriggers: { ...DEFAULT_TRIGGER_CONFIG, ...(c0.mediaTriggers || {}) },
        };

        const storedSkin = c0.appearanceSkin && ADMIN_SKIN_TO_UI.has(c0.appearanceSkin)
          ? c0.appearanceSkin
          : null;
        merged.appearanceSkin = storedSkin || detectAppearanceSkin(merged.appearance, c0.appearanceSkin);

        merged = applyDefaultIcons(merged);
        merged = normalizeGameMetadata(merged, slugForMeta);

        setSuite(normalized);
        setConfig(merged);
        setSelected(null); setEditing(null); setDirty(false);
        setSelectedDevIdx(null); setSelectedMissionIdx(null);
        setStatus('');
      } catch (e) {
        setStatus('Load failed: ' + (e?.message || e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlug]);

  function defaultConfig() {
    return {
      splash: { enabled:false, mode:'single' },
      game:   { title:'Default Game', type:'Mystery', tags:['default','default-game'], coverImage:'', deployEnabled:true },
      forms:  { players:1 },
      timer:  { durationMinutes:0, alertMinutes:10 },
      textRules: [],
      devices: [], powerups: [],
      media: { rewardsPool:[], penaltiesPool:[] },
      icons: DEFAULT_ICONS,
      appearanceSkin: DEFAULT_APPEARANCE_SKIN,
      appearance: {
        ...defaultAppearance(),
        ...(DEFAULT_SKIN_PRESET?.appearance || {}),
      },
      appearanceTone: 'light',
      mediaTriggers: { ...DEFAULT_TRIGGER_CONFIG },
      map: { centerLat: 44.9778, centerLng: -93.2650, defaultZoom: 13 },
      geofence: { mode: 'test' },
    };
  }
  function defaultContentForType(t) {
    const rawLat = Number(config?.map?.centerLat);
    const rawLng = Number(config?.map?.centerLng);
    const fallbackLat = 44.9778;
    const fallbackLng = -93.2650;
    const baseLat = Number.isFinite(rawLat) ? Number(rawLat.toFixed(6)) : fallbackLat;
    const baseLng = Number.isFinite(rawLng) ? Number(rawLng.toFixed(6)) : fallbackLng;
    const base = { geofenceEnabled:false, lat:baseLat, lng:baseLng, radiusMeters:25, cooldownSeconds:30 };
    switch (t) {
      case 'multiple_choice': return { question:'', choices:[], correctIndex:undefined, mediaUrl:'', ...base };
      case 'short_answer':    return { question:'', answer:'', acceptable:'', mediaUrl:'', ...base };
      case 'statement':       return { text:'', mediaUrl:'', ...base };
      case 'video':           return { videoUrl:'', overlayText:'', ...base };
      case 'geofence_image':  return { ...base, imageUrl:'', overlayText:'' };
      case 'geofence_video':  return { ...base, videoUrl:'', overlayText:'' };
      case 'ar_image':        return { markerUrl:'', assetUrl:'', overlayText:'', ...base };
      case 'ar_video':        return { markerUrl:'', assetUrl:'', overlayText:'', ...base };
      case 'stored_statement':return { template:'' };
      default:                return { ...base };
    }
  }

  /* ── API helpers respecting Default Game (legacy root) ── */
  function isDefaultSlug(slug) { return !slug || slug === 'default'; }

  async function saveAllWithSlug(slug) {
    if (!suite || !config) return false;
    setStatus((prev) => {
      if (typeof prev === 'string' && prev.toLowerCase().includes('publishing')) return prev;
      return 'Saving…';
    });
    const isDefault = isDefaultSlug(slug);
    const slugTag = isDefault ? 'default' : slug;
    const preparedConfig = normalizeGameMetadata(config, slugTag);
    if (preparedConfig !== config) setConfig(preparedConfig);

    const bundleUrl = isDefault ? '/api/save-bundle' : `/api/save-bundle${qs({ slug })}`;
    const attemptBundle = async () => {
      const response = await fetch(bundleUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ missions: suite, config: preparedConfig }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(text || 'save failed');
    };

    const attemptLegacy = async () => {
      const slugQuery = isDefault ? '' : qs({ slug });
      const missionsUrl = isDefault ? '/api/save' : `/api/save${slugQuery}`;
      const configUrl = isDefault ? '/api/save-config' : `/api/save-config${slugQuery}`;

      const missionsRes = await fetch(missionsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ missions: suite }),
      });
      const missionsText = await missionsRes.text();
      if (!missionsRes.ok) throw new Error(missionsText || 'save missions failed');

      const configRes = await fetch(configUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ config: preparedConfig }),
      });
      const configText = await configRes.text();
      if (!configRes.ok) throw new Error(configText || 'save config failed');
    };

    try {
      await attemptBundle();
      setStatus('✅ Saved');
      return true;
    } catch (bundleError) {
      try {
        setStatus('Bundle save unavailable — retrying legacy save…');
        await attemptLegacy();
        setStatus('✅ Saved');
        return true;
      } catch (legacyError) {
        console.error('Save failed', { bundleError, legacyError });
        setStatus('❌ Save failed: ' + (legacyError?.message || legacyError || bundleError));
        return false;
      }
    }
  }

  async function publishWithSlug(slug, channel='published') {
    if (isDefaultSlug(slug)) {
      try {
        const res = await fetch('/api/publish', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          credentials:'include',
          body: JSON.stringify({ slug: 'root' }),
        });
        const txt = await res.text();
        let data = {};
        try { data = JSON.parse(txt); } catch {}
        if (!res.ok || data?.ok === false) {
          const err = data?.error || txt || 'publish failed';
          throw new Error(err);
        }
        setStatus('✅ Published');
        return true;
      } catch (e) {
        setStatus('❌ Publish failed: ' + (e?.message || e));
        return false;
      }
    }

    const first = `/api/game${qs({ slug, channel })}`;
    const fallback = `/api/game/${encodeURIComponent(slug)}${qs({ channel })}`;

    try {
      const res = await fetch(first, {
        method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
        body: JSON.stringify({ action:'publish' })
      });
      const txt = await res.text();
      let data = {};
      try { data = JSON.parse(txt); } catch {}
      if (!res.ok) throw new Error('try fallback');
      setStatus(`✅ Published${data?.version ? ` v${data.version}` : ''}`);
      return true;
    } catch (e) {
      try {
        const res2 = await fetch(fallback, {
          method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
          body: JSON.stringify({ action:'publish' })
        });
        const txt2 = await res2.text();
        let data2 = {};
        try { data2 = JSON.parse(txt2); } catch {}
        if (!res2.ok) throw new Error(txt2||'publish failed');
        setStatus(`✅ Published${data2?.version ? ` v${data2.version}` : ''}`);
        return true;
      } catch (e2) {
        setStatus('❌ Publish failed: ' + (e2?.message || e2));
        return false;
      }
    }
  }

  async function reloadGamesList() {
    if (!gameEnabled) { setGames([]); return; }
    try {
      const r = await fetch('/api/games', { credentials:'include', cache:'no-store' });
      const j = await r.json();
      if (j.ok) setGames(j.games || []);
    } catch {}
  }

  async function saveAndPublish() {
    logConversation('You', 'Requested Save & Publish');
    if (!suite || !config) return;
    const slug = activeSlug || 'default';
    const shouldPublish = gameEnabled && config?.game?.deployEnabled === true;
    setSavePubBusy(true);
    setStatus(shouldPublish ? 'Saving & publishing…' : 'Saving…');

    const saved = await saveAllWithSlug(slug);
    if (!saved) { setSavePubBusy(false); return; }

    if (shouldPublish && deployDelaySec > 0) await new Promise(r => setTimeout(r, deployDelaySec * 1000));

    if (shouldPublish) {
      const published = await publishWithSlug(slug, 'published');
      if (!published) { setSavePubBusy(false); return; }
    } else {
      setStatus('✅ Saved (game deploy disabled)');
    }

    await reloadGamesList();
    setPreviewNonce(n => n + 1);
    setSavePubBusy(false);
  }

  /* Delete game (with modal confirm) */
  async function reallyDeleteGame() {
    logConversation('You', `Requested deletion for ${activeSlug || 'default'} game`);
    if (!gameEnabled) { setConfirmDeleteOpen(false); return; }
    const slug = activeSlug || 'default';
    const urlTry = [
      `/api/games${qs({ slug: isDefaultSlug(slug) ? '' : slug })}`,
      !isDefaultSlug(slug) ? `/api/game${qs({ slug })}` : null,
      !isDefaultSlug(slug) ? `/api/games/${encodeURIComponent(slug)}` : null,
      !isDefaultSlug(slug) ? `/api/game/${encodeURIComponent(slug)}` : null,
    ].filter(Boolean);

    setStatus('Deleting game…');
    let ok = false, lastErr = '';
    for (const u of urlTry) {
      try {
        const res = await fetch(u, { method:'DELETE', credentials:'include' });
        if (res.ok) { ok = true; break; }
        lastErr = await res.text();
      } catch (e) { lastErr = e?.message || String(e); }
    }

    if (!ok) {
      setSuite({ version:'0.0.0', missions:[] });
      setConfig(c => ({
        ...(c || {}),
        devices: [],
        powerups: [],
        media: { rewardsPool:[], penaltiesPool:[] },
        textRules: [],
      }));
      setDirty(true);
      const saved = await saveAllWithSlug(slug);
      if (saved) { setStatus('✅ Cleared game content'); ok = true; }
    }

    if (ok) {
      await reloadGamesList();
      setActiveSlug('default');
      setStatus('✅ Game deleted');
      setPreviewNonce(n => n + 1);
    } else {
      setStatus('❌ Delete failed: ' + (lastErr || 'unknown error'));
    }
    setConfirmDeleteOpen(false);
  }

  /* Missions CRUD */
  function suggestId() {
    const base='m'; let i=1;
    const ids = new Set((suite?.missions||[]).map(m=>m.id));
    while (ids.has(String(base + String(i).padStart(2,'0')))) i++;
    return base + String(i).padStart(2,'0');
  }
  function startNew() {
    if (missionButtonTimeout.current) {
      clearTimeout(missionButtonTimeout.current);
      missionButtonTimeout.current = null;
    }
    setNewMissionButtonFlash(true);
    missionButtonTimeout.current = setTimeout(() => {
      setNewMissionButtonFlash(false);
      missionButtonTimeout.current = null;
    }, 420);
    const draft = {
      id: suggestId(),
      title: 'New Mission',
      type: 'multiple_choice',
      iconKey: '',
      rewards: { points: 25 },
      correct: { mode: 'none' },
      wrong:   { mode: 'none' },
      onCorrect: { statement:'', mediaUrl:'', audioUrl:'', durationSeconds:0, buttonText:'OK', enabled:false },
      onWrong:   { statement:'', mediaUrl:'', audioUrl:'', durationSeconds:0, buttonText:'OK', enabled:false },
      content: defaultContentForType('multiple_choice'),
      appearanceOverrideEnabled: false,
      appearance: defaultAppearance(),
      showContinue: true,
      trigger: { ...DEFAULT_TRIGGER_CONFIG },
    };
    setEditing(draft); setSelected(null); setDirty(true);
  }
  function editExisting(m) {
    if (!m) return;
    let e;
    try {
      e = JSON.parse(JSON.stringify(m));
    } catch (err) {
      console.warn('Falling back to shallow mission copy', err);
      e = { ...(m || {}) };
    }
    e.appearanceOverrideEnabled = !!e.appearanceOverrideEnabled;
    e.appearance = { ...defaultAppearance(), ...(e.appearance || {}) };
    if (!e.correct) e.correct = { mode: 'none' };
    if (!e.wrong)   e.wrong   = { mode: 'none' };
    if (!e.onCorrect) e.onCorrect = { statement:'', mediaUrl:'', audioUrl:'', durationSeconds:0, buttonText:'OK', enabled:false };
    if (!e.onWrong)   e.onWrong   = { statement:'', mediaUrl:'', audioUrl:'', durationSeconds:0, buttonText:'OK', enabled:false };
    if (e.showContinue === undefined) e.showContinue = true;
    e.trigger = { ...DEFAULT_TRIGGER_CONFIG, ...(e.trigger || {}) };
    setEditing(e); setSelected(m.id); setDirty(false);
  }
  function cancelEdit() {
    setEditing(null); setSelected(null); setDirty(false);
    setMissionActionFlash(false);
    if (missionFlashTimeout.current) {
      clearTimeout(missionFlashTimeout.current);
      missionFlashTimeout.current = null;
    }
  }
  function bumpVersion(v) {
    const p = String(v || '0.0.0')
      .split('.')
      .map((n) => parseInt(n || '0', 10));
    while (p.length < 3) p.push(0);
    p[2] += 1;
    return p.join('.');
  }
  function saveToList(options = {}) {
    const { close = true } = options;
    if (!editing || !suite) return { success: false, mode: null };
    if (!editing.id || !editing.title || !editing.type) {
      setStatus('❌ Fill id, title, type');
      return { success: false, mode: null };
    }

    const fields = TYPE_FIELDS[editing.type] || [];
    for (const f of fields) {
      if (f.type === 'number' || f.optional) continue;
      if (f.key === 'acceptable' || f.key === 'mediaUrl') continue;
      const v = editing.content?.[f.key];
      if (v === undefined || v === null || v === '') {
        return setStatus('❌ Missing: ' + f.label);
      }
    }
    const missions = [...(suite.missions || [])];
    const i = missions.findIndex(m => m.id === editing.id);
    const obj = { ...editing };
    obj.trigger = sanitizeTriggerConfig(editing.trigger);
    if (!obj.appearanceOverrideEnabled) delete obj.appearance;

    const list = (i >= 0 ? (missions[i] = obj, missions) : [...missions, obj]);
    setSuite({ ...suite, missions: list, version: bumpVersion(suite.version || '0.0.0') });
    setSelected(editing.id);
    if (close) {
      setEditing(null);
    }
    setDirty(false);
    const mode = i >= 0 ? 'update' : 'create';
    const defaultStatus = close
      ? '✅ Mission saved'
      : mode === 'update'
        ? '✅ Mission updated'
        : '✅ Mission added';
    setStatus(defaultStatus);
    return { success: true, mode };
  }
  function handleMissionSave({ close = true } = {}) {
    if (missionFlashTimeout.current) {
      clearTimeout(missionFlashTimeout.current);
      missionFlashTimeout.current = null;
    }
    setMissionActionFlash(true);
    missionFlashTimeout.current = setTimeout(() => {
      setMissionActionFlash(false);
      missionFlashTimeout.current = null;
    }, 420);
    const result = saveToList({ close });
    if (!result.success) {
      if (missionFlashTimeout.current) {
        clearTimeout(missionFlashTimeout.current);
        missionFlashTimeout.current = null;
      }
      setMissionActionFlash(false);
    }
    return result;
  }
  function handleMissionApply() {
    return handleMissionSave({ close: false });
  }
  function removeMission(id) {
    if (!suite) return;
    setSuite({ ...suite, missions: (suite.missions || []).filter(m => m.id !== id) });
    setDirty(true);
    if (selected === id) { setSelected(null); setEditing(null); }
  }
  function moveMission(idx, dir) {
    if (!suite) return;
    const list = [...(suite.missions || [])];
    const j = idx + dir; if (j < 0 || j >= list.length) return;
    const [row] = list.splice(idx, 1); list.splice(j, 0, row);
    setSuite({ ...suite, missions: list });
    setDirty(true);
  }
  function duplicateMission(idx) {
    const list = [...(suite.missions || [])];
    const src  = list[idx]; if (!src) return;
    const cp   = JSON.parse(JSON.stringify(src));
    cp.id      = suggestId();
    cp.title   = (src.title || 'Copy') + ' (copy)';
    list.splice(idx + 1, 0, cp);
    setSuite({ ...suite, missions: list });
    setDirty(true);
    setStatus('✅ Duplicated');
  }

  /* Devices (Devices tab only) */
  const devices = getDevices();
  const missionIconLookup = useMemo(
    () => buildMissionIconLookup(config),
    [config?.icons?.missions, config?.icons?.devices]
  );
  const missionIconOptions = useMemo(() => {
    const options = Array.from(missionIconLookup.values());
    return options.sort((a, b) => a.name.localeCompare(b.name));
  }, [missionIconLookup]);
  function deviceIconUrlFromKey(key) {
    if (!key) return '';
    const it = (config?.icons?.devices || []).find(x => (x.key||'') === key);
    return it?.url || '';
  }
  function missionIconUrlFromKey(key) {
    if (!key) return '';
    const entry = missionIconLookup.get(key.toLowerCase());
    return entry?.url || '';
  }
  function missionIconEntryFromKey(key) {
    if (!key) return null;
    return missionIconLookup.get(key.toLowerCase()) || null;
  }
  const triggerOptionSets = useMemo(() => {
    const mediaOptions = (inventory || []).map((it, idx) => {
      const rawUrl = it?.url || it?.path || it;
      const url = toDirectMediaURL(rawUrl);
      if (!url) return null;
      const label = it?.label || baseNameFromUrl(url) || `Media ${idx + 1}`;
      return { id: url, label, thumbnail: url, meta: it };
    }).filter(Boolean);
    const deviceOptions = (devices || []).map((d, idx) => {
      const id = d?.id || d?.key || `device-${idx}`;
      const label = d?.title || d?.name || id;
      const thumbnail = toDirectMediaURL(d?.iconUrl || deviceIconUrlFromKey(d?.iconKey) || '');
      return { id, label, thumbnail, meta: d };
    });
    const missionOptions = ((suite?.missions) || []).map((m, idx) => {
      const id = m?.id || `mission-${idx}`;
      const label = m?.title || id;
      const iconEntry = missionIconEntryFromKey(m?.iconKey);
      const thumbnail = toDirectMediaURL(iconEntry?.url || '');
      return { id, label, thumbnail, meta: m };
    });
    const responseOptions = [];
    ((suite?.missions) || []).forEach((m) => {
      if (!m) return;
      const baseLabel = m.title || m.id || 'Mission';
      const iconEntry = missionIconEntryFromKey(m?.iconKey);
      const fallbackUrl = iconEntry?.url || '';
      const correctUrl = toDirectMediaURL(m?.correct?.mediaUrl || m?.correct?.audioUrl || fallbackUrl);
      responseOptions.push({
        id: `${m.id || baseLabel}::correct`,
        label: `${baseLabel} — Correct`,
        thumbnail: correctUrl,
        meta: { mission: m, side: 'correct', url: correctUrl },
      });
      const wrongUrl = toDirectMediaURL(m?.wrong?.mediaUrl || m?.wrong?.audioUrl || fallbackUrl);
      responseOptions.push({
        id: `${m.id || baseLabel}::wrong`,
        label: `${baseLabel} — Wrong`,
        thumbnail: wrongUrl,
        meta: { mission: m, side: 'wrong', url: wrongUrl },
      });
    });
    return { media: mediaOptions, devices: deviceOptions, missions: missionOptions, responses: responseOptions };
  }, [inventory, devices, suite?.missions, config?.icons?.devices, config?.icons?.missions]);
  function suggestDeviceId(existing = devices) {
    const ids = new Set((existing || []).map(d => String(d?.id || '').toLowerCase()));
    let i = 1;
    while (ids.has(`d${String(i).padStart(2, '0')}`)) i += 1;
    return `d${String(i).padStart(2, '0')}`;
  }
  function addDevice() {
    if (deviceButtonTimeout.current) {
      clearTimeout(deviceButtonTimeout.current);
      deviceButtonTimeout.current = null;
    }
    setAddDeviceButtonFlash(true);
    deviceButtonTimeout.current = setTimeout(() => {
      setAddDeviceButtonFlash(false);
      deviceButtonTimeout.current = null;
    }, 420);
    setDeviceEditorMode('new');
    setIsDeviceEditorOpen(true);
    setSelectedDevIdx(null);
    setSelectedMissionIdx(null);
    const baseLat = Number(config.map?.centerLat ?? 44.9778);
    const baseLng = Number(config.map?.centerLng ?? -93.2650);
    const initial = createDeviceDraft({
      lat: Number((isFinite(baseLat) ? baseLat : 44.9778).toFixed(6)),
      lng: Number((isFinite(baseLng) ? baseLng : -93.2650).toFixed(6)),
    });
    setDevDraft(initial);
    setDevDraftBaseline(createDeviceDraft({ ...initial }));
  }
  function openDeviceEditor(idx) {
    if (idx == null) return;
    const item = devices?.[idx];
    if (!item) return;
    setDeviceEditorMode('edit');
    setIsDeviceEditorOpen(true);
    setSelectedDevIdx(idx);
    setSelectedMissionIdx(null);
    const draft = createDeviceDraft({ ...item });
    setDevDraft(draft);
    setDevDraftBaseline(createDeviceDraft({ ...item }));
  }
  function closeDeviceEditor() {
    setIsDeviceEditorOpen(false);
    setDeviceEditorMode('new');
    setDevDraft(createDeviceDraft());
    setDevDraftBaseline(createDeviceDraft());
  }
  function resetDeviceEditor() {
    const baseline = createDeviceDraft({ ...devDraftBaseline });
    const unchanged = JSON.stringify(baseline) === JSON.stringify(devDraft);
    setDevDraft(baseline);
    setDeviceTriggerPicker('');
    setStatus(unchanged ? 'ℹ️ Device draft unchanged' : '↩️ Device changes reset');
  }
  function cancelDeviceEditor() {
    setDeviceTriggerPicker('');
    closeDeviceEditor();
    setStatus('🚫 Device edit cancelled');
    setDeviceActionFlash(false);
    if (deviceFlashTimeout.current) {
      clearTimeout(deviceFlashTimeout.current);
      deviceFlashTimeout.current = null;
    }
  }
  function saveDraftDevice(options = {}) {
    const { close = true } = options;
    const normalized = {
      title: devDraft.title?.trim() || (devDraft.type.charAt(0).toUpperCase() + devDraft.type.slice(1)),
      type: devDraft.type || 'smoke',
      iconKey: devDraft.iconKey || '',
      pickupRadius: clamp(Number(devDraft.pickupRadius || 0), 1, 2000),
      effectSeconds: clamp(Number(devDraft.effectSeconds || 0), 5, 3600),
      trigger: sanitizeTriggerConfig(devDraft.trigger),
    };
    if (deviceEditorMode === 'new') {
      if (devDraft.lat == null || devDraft.lng == null) {
        setStatus('❌ Click the map or search an address to set device location');
        return { success: false, mode: null };
      }
      const lat = Number(Number(devDraft.lat).toFixed(6));
      const lng = Number(Number(devDraft.lng).toFixed(6));
      const list = [...(devices || [])];
      const item = { id: suggestDeviceId(list), ...normalized, lat, lng };
      const next = [...list, item];
      setDevices(next);
      setSelectedDevIdx(next.length - 1);
      setSelectedMissionIdx(null);
      setDirty(true);
      setDeviceTriggerPicker('');
      setStatus('✅ Device added');
      if (close) {
        closeDeviceEditor();
      } else {
        const draft = createDeviceDraft({ ...item });
        setDeviceEditorMode('edit');
        setIsDeviceEditorOpen(true);
        setDevDraft(draft);
        setDevDraftBaseline(createDeviceDraft({ ...item }));
      }
      return { success: true, mode: 'create' };
    }
    if (deviceEditorMode === 'edit' && selectedDevIdx != null) {
      const index = selectedDevIdx;
      const list = [...(devices || [])];
      const existing = list[index];
      if (!existing) return { success: false, mode: null };
      const lat = devDraft.lat == null ? existing.lat : Number(Number(devDraft.lat).toFixed(6));
      const lng = devDraft.lng == null ? existing.lng : Number(Number(devDraft.lng).toFixed(6));
      list[index] = { ...existing, ...normalized, lat, lng };
      setDevices(list);
      setDirty(true);
      setDeviceTriggerPicker('');
      setStatus(close ? '✅ Device saved' : '✅ Device updated');
      if (close) {
        closeDeviceEditor();
      } else {
        const updated = createDeviceDraft({ ...list[index] });
        setDevDraft(updated);
        setDevDraftBaseline(createDeviceDraft({ ...list[index] }));
        setDeviceEditorMode('edit');
        setIsDeviceEditorOpen(true);
      }
      return { success: true, mode: 'update' };
    }
    return { success: false, mode: null };
  }
  function handleDeviceSave({ close = true } = {}) {
    if (deviceFlashTimeout.current) {
      clearTimeout(deviceFlashTimeout.current);
      deviceFlashTimeout.current = null;
    }
    setDeviceActionFlash(true);
    deviceFlashTimeout.current = setTimeout(() => {
      setDeviceActionFlash(false);
      deviceFlashTimeout.current = null;
    }, 420);
    const result = saveDraftDevice({ close });
    if (!result.success) {
      if (deviceFlashTimeout.current) {
        clearTimeout(deviceFlashTimeout.current);
        deviceFlashTimeout.current = null;
      }
      setDeviceActionFlash(false);
    }
    return result;
  }
  function handleDeviceApply() {
    return handleDeviceSave({ close: false });
  }
  function duplicateDevice(idx) {
    const list = [...(devices || [])];
    const src = list[idx];
    if (!src) return;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = suggestDeviceId(list);
    copy.title = (src.title || src.id || 'Device') + ' (copy)';
    list.splice(idx + 1, 0, copy);
    setDevices(list);
    setDirty(true);
    const newIndex = idx + 1;
    setSelectedDevIdx(newIndex);
    setSelectedMissionIdx(null);
    setStatus('✅ Device duplicated');
    setDeviceEditorMode('edit');
    setIsDeviceEditorOpen(true);
    setDevDraft(createDeviceDraft({ ...copy }));
  }
  function deleteDevice(idx) {
    const list = [...(devices || [])];
    if (idx == null || idx < 0 || idx >= list.length) return;
    const currentSelected = selectedDevIdx;
    list.splice(idx, 1);
    setDevices(list);
    setDirty(true);
    if (currentSelected === idx) {
      setSelectedDevIdx(null);
      if (isDeviceEditorOpen && deviceEditorMode === 'edit') closeDeviceEditor();
    } else if (currentSelected != null && currentSelected > idx) {
      setSelectedDevIdx(currentSelected - 1);
    }
    setStatus('✅ Device deleted');
  }
  function moveDevice(idx, dir) {
    const list = [...(devices || [])];
    if (idx == null || idx < 0 || idx >= list.length) return;
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    const [row] = list.splice(idx, 1);
    list.splice(target, 0, row);
    setDevices(list);
    setDirty(true);
    const currentSelected = selectedDevIdx;
    if (currentSelected === idx) {
      setSelectedDevIdx(target);
      if (isDeviceEditorOpen && deviceEditorMode === 'edit') {
        setDevDraft(createDeviceDraft({ ...list[target] }));
      }
    } else if (currentSelected === target) {
      setSelectedDevIdx(idx);
    }
  }
  function moveSelectedDevice(lat, lng) {
    if (selectedDevIdx == null) return;
    const list = [...(devices || [])];
    const existing = list[selectedDevIdx];
    if (!existing) return;
    const latFixed = Number(lat.toFixed(6));
    const lngFixed = Number(lng.toFixed(6));
    list[selectedDevIdx] = { ...existing, lat: latFixed, lng: lngFixed };
    setDevices(list);
    setDirty(true);
    if (isDeviceEditorOpen && deviceEditorMode === 'edit') {
      setDevDraft(d => ({ ...d, lat: latFixed, lng: lngFixed }));
    }
  }
  function setSelectedDeviceRadius(r) {
    if (selectedDevIdx == null) return;
    const list = [...(devices || [])];
    const existing = list[selectedDevIdx];
    if (!existing) return;
    const nextRadius = clamp(Number(r || 0), 1, 2000);
    list[selectedDevIdx] = { ...existing, pickupRadius: nextRadius };
    setDevices(list);
    setDirty(true);
    if (isDeviceEditorOpen && deviceEditorMode === 'edit') {
      setDevDraft(d => ({ ...d, pickupRadius: nextRadius }));
    }
  }

  function applyAppearanceSkin(key) {
    const preset = APPEARANCE_SKIN_MAP.get(key);
    if (!preset) return;
    const tone = normalizeTone(config?.appearanceTone);
    applyAdminUiThemeForDocument(key, preset.appearance, tone);
    setConfig(prev => ({
      ...(prev || {}),
      appearance: { ...defaultAppearance(), ...preset.appearance },
      appearanceSkin: key,
    }));
    setDirty(true);
    setStatus(`✅ Applied theme: ${preset.label}`);
  }

  function updateInterfaceTone(nextTone) {
    const normalized = normalizeTone(nextTone);
    if (normalized === normalizeTone(config?.appearanceTone)) return;
    const appearance = config?.appearance || defaultAppearance();
    const skinKey = config?.appearanceSkin && ADMIN_SKIN_TO_UI.has(config.appearanceSkin)
      ? config.appearanceSkin
      : detectAppearanceSkin(appearance, config?.appearanceSkin);
    applyAdminUiThemeForDocument(skinKey, appearance, normalized);
    setConfig(prev => ({ ...(prev || {}), appearanceTone: normalized }));
    setDirty(true);
    setStatus(normalized === 'dark' ? '🌙 Dark mission deck enabled' : '☀️ Light command deck enabled');
  }

  function openProtectionPrompt() {
    const target = !protectionState.enabled;
    setProtectionError('');
    setProtectionPrompt({
      open: true,
      mode: target ? 'enable' : 'disable',
      requireConfirm: target && !protectionState.passwordSet,
      password: '',
      confirm: '',
      error: '',
    });
  }

  function closeProtectionPrompt() {
    setProtectionPrompt(prev => ({ ...prev, open: false, password: '', confirm: '', error: '' }));
    setProtectionState(prev => ({ ...prev, saving: false }));
  }

  async function submitProtectionPrompt() {
    const { mode, password, confirm, requireConfirm } = protectionPrompt;
    if (!password.trim()) {
      setProtectionPrompt(prev => ({ ...prev, error: 'Password required' }));
      return;
    }
    if (requireConfirm && password !== confirm) {
      setProtectionPrompt(prev => ({ ...prev, error: 'Passwords must match to enable protection' }));
      return;
    }
    setProtectionError('');
    setProtectionState(prev => ({ ...prev, saving: true }));
    setProtectionPrompt(prev => ({ ...prev, error: '' }));
    try {
      const res = await fetch('/api/admin-protection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          protected: mode === 'enable',
          password,
          ...(requireConfirm ? { confirmPassword: confirm } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || res.statusText || 'Toggle failed');
      }
      setProtectionState({
        enabled: !!data.protected,
        loading: false,
        saving: false,
        updatedAt: data.updatedAt || null,
        passwordSet: data.passwordSet !== false,
      });
      setStatus(`✅ Admin password protection ${data.protected ? 'enabled' : 'disabled'}`);
      setProtectionPrompt({ open: false, mode: 'enable', requireConfirm: false, password: '', confirm: '', error: '' });
    } catch (err) {
      setProtectionState(prev => ({ ...prev, saving: false }));
      const msg = err?.message || 'Toggle failed';
      setProtectionPrompt(prev => ({ ...prev, error: msg }));
      setStatus('❌ Failed to toggle admin protection');
    }
  }

  // Missions selection operations (Missions tab only)
  function moveSelectedMission(lat, lng) {
    if (selectedMissionIdx == null) return;
    const list = [...(suite?.missions || [])];
    const m = list[selectedMissionIdx]; if (!m) return;
    const c = { ...(m.content || {}) };
    c.lat = Number(lat.toFixed(6));
    c.lng = Number(lng.toFixed(6));
    c.geofenceEnabled = true;
    c.radiusMeters = clamp(Number(c.radiusMeters || 25), 5, 500);
    list[selectedMissionIdx] = { ...m, content: c };
    setSuite({ ...suite, missions: list });
    setDirty(true);
    setStatus(`Moved mission #${selectedMissionIdx+1}`);
  }
  function setSelectedMissionRadius(r) {
    if (selectedMissionIdx == null) return;
    const list = [...(suite?.missions || [])];
    const m = list[selectedMissionIdx]; if (!m) return;
    const c = { ...(m.content || {}) };
    c.radiusMeters = clamp(Number(r || 0), 5, 500);
    c.geofenceEnabled = true;
    if (!isFinite(Number(c.lat)) || !isFinite(Number(c.lng))) {
      c.lat = Number(config.map?.centerLat || 44.9778);
      c.lng = Number(config.map?.centerLng || -93.2650);
    }
    list[selectedMissionIdx] = { ...m, content: c };
    setSuite({ ...suite, missions: list });
    setDirty(true);
  }

  // Address search (Devices tab)
  async function devSearch(e) {
    e?.preventDefault();
    const q = devSearchQ.trim();
    if (!q) return;
    setDevSearching(true);
    setDevResults([]);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=8&addressdetails=1`;
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      const j = await r.json();
      setDevResults(Array.isArray(j) ? j : []);
    } catch {
      setDevResults([]);
    } finally {
      setDevSearching(false);
    }
  }
  function applySearchResult(r) {
    const lat = Number(r.lat), lon = Number(r.lon);
    if (isDeviceEditorOpen && deviceEditorMode === 'new') {
      setDevDraft(d => ({ ...d, lat, lng: lon }));
    } else if (selectedDevIdx != null) {
      moveSelectedDevice(lat, lon);
    }
    setDevResults([]);
  }
  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      applySearchResult({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    });
  }

  // Settings → Map center search
  async function searchMapCenter(e) {
    e?.preventDefault?.();
    const q = mapSearchQ.trim();
    if (!q) return;
    setMapSearching(true);
    setMapResults([]);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=8&addressdetails=1`;
      const r = await fetch(url);
      const j = await r.json();
      setMapResults(Array.isArray(j) ? j : []);
    } catch { setMapResults([]); }
    finally { setMapSearching(false); }
  }
  function useCenterResult(r) {
    const lat = Number(r.lat), lng = Number(r.lon);
    setConfig(c => ({ ...(c || {}), map: { ...((c && c.map) || {}), centerLat: Number(lat.toFixed(6)), centerLng: Number(lng.toFixed(6)) } }));
    setMapResults([]);
  }

  // Project Health scan
  async function scanProject() {
    logConversation('You', 'Scanning media usage for unused files');
    const inv = await listInventory(['uploads','bundles','icons','mediapool','covers','missions','devices','assigned']);
    const used = new Set();

    const iconUrlByKey = {};
    (config?.icons?.missions || []).forEach(i => { if (i.key && i.url) iconUrlByKey['missions:'+i.key]=i.url; });
    (config?.icons?.devices  || []).forEach(i => { if (i.key && i.url) iconUrlByKey['devices:'+i.key]=i.url; });

    (suite?.missions || []).forEach(m => {
      if (m.iconUrl) used.add(m.iconUrl);
      if (m.iconKey && iconUrlByKey['missions:'+m.iconKey]) used.add(iconUrlByKey['missions:'+m.iconKey]);
      const c = m.content || {};
      ['mediaUrl','imageUrl','videoUrl','assetUrl','markerUrl'].forEach(k => { if (c[k]) used.add(c[k]); });
      if (m.correct?.mediaUrl) used.add(m.correct.mediaUrl);
      if (m.wrong?.mediaUrl)   used.add(m.wrong.mediaUrl);
    });
    (getDevices() || []).forEach(d => {
      if (d.iconKey && iconUrlByKey['devices:'+d.iconKey]) used.add(iconUrlByKey['devices:'+d.iconKey]);
    });
    (config?.media?.rewardsPool || []).forEach(x => x.url && used.add(x.url));
    (config?.media?.penaltiesPool || []).forEach(x => x.url && used.add(x.url));

    const total = inv.length;
    const usedCount = used.size;
    const unused = inv.filter(i => !used.has(i.url));

    setStatus(`Scan complete: ${usedCount}/${total} media referenced; ${unused.length} unused.`);
    alert(
      `${usedCount}/${total} media referenced\n` +
      (unused.length ? `Unused files:\n- `+unused.map(u=>u.url).join('\n- ') : 'No unused files detected')
    );
  }

  async function uploadToRepo(file, target = 'uploads') {
    if (!file) return '';
    const safeName = (file.name || 'upload').replace(/[^\w.\-]+/g, '_');
    const detectedType = classifyMediaType(file.name, file.type);
    const request = typeof target === 'string' ? { subfolder: target } : (target || {});
    const context = request.context || undefined;
    const explicitFolder = request.subfolder || request.folder || undefined;
    const effectiveType = request.type || detectedType;
    const folder = (explicitFolder && explicitFolder.replace(/^\/+|\/+$/g, ''))
      || resolveMediaSubfolder(effectiveType, context);
    const path = `public/media/${folder}/${Date.now()}-${safeName}`;
    const sizeKb = Math.max(1, Math.round((file.size || 0) / 1024));
    const isVisual = effectiveType === 'image' || effectiveType === 'gif';
    const targetLabel = `/media/${folder}`;
    if (isVisual && file.size > 1024 * 1024) {
      setUploadStatus(`⚠️ ${safeName} is ${sizeKb} KB — uploading to ${targetLabel} may take longer.`);
    } else {
      setUploadStatus(`Uploading ${safeName} to ${targetLabel}…`);
    }
    const base64 = await fileToBase64(file);
    const res = await fetch('/api/upload', {
      method:'POST', headers:{ 'Content-Type':'application/json' }, credentials:'include',
      body: JSON.stringify({ path, contentBase64: base64, message:`upload ${safeName}` }),
    });
    const j = await res.json().catch(()=>({}));
    setUploadStatus(res.ok ? `✅ Uploaded ${safeName} to ${targetLabel}` : `❌ ${j?.error || 'upload failed'}`);
    return res.ok ? `/${path.replace(/^public\//,'')}` : '';
  }

  const selectGameOptions = useMemo(() => {
    const baseOptions = [{ value: 'default', label: 'Admin-esxape-ride (root)' }];
    const extra = Array.isArray(games)
      ? games
          .filter((g) => g && g.slug && g.slug !== 'default')
          .map((g) => ({
            value: g.slug,
            label: `${g.title || g.slug}${g.mode ? ` — ${g.mode}` : ''}`,
          }))
      : [];
    const seen = new Set();
    const combined = [];
    [...baseOptions, ...extra].forEach((option) => {
      if (!option || !option.value) return;
      if (seen.has(option.value)) return;
      seen.add(option.value);
      combined.push(option);
    });
    return combined;
  }, [games]);

  if (!suite || !config) {
    return (
      <main style={{ maxWidth: 900, margin: '40px auto', color: 'var(--admin-muted)', padding: 16 }}>
        <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--admin-border-soft)', background: 'var(--appearance-panel-bg, var(--admin-panel-bg))', boxShadow: 'var(--appearance-panel-shadow, var(--admin-panel-shadow))' }}>
          Loading… (pulling config & missions)
        </div>
      </main>
    );
  }

  const mapCenter = { lat: Number(config.map?.centerLat)||44.9778, lng: Number(config.map?.centerLng)||-93.2650 };
  const mapZoom = Number(config.map?.defaultZoom)||13;

  const missionRadiusDisabled = (selectedMissionIdx==null);
  const missionRadiusValue = selectedMissionIdx!=null
    ? Number(suite.missions?.[selectedMissionIdx]?.content?.radiusMeters ?? 25)
    : 25;

  const isAddingDevice = isDeviceEditorOpen && deviceEditorMode === 'new';
  const deviceRadiusDisabled = (selectedDevIdx==null && !isAddingDevice);
  const deviceRadiusValue = selectedDevIdx!=null
    ? Number(devices?.[selectedDevIdx]?.pickupRadius ?? 0)
    : Number(devDraft.pickupRadius ?? 100);

  const storedAppearanceSkin = config.appearanceSkin && ADMIN_SKIN_TO_UI.has(config.appearanceSkin)
    ? config.appearanceSkin
    : null;
  const detectedAppearanceSkin = detectAppearanceSkin(config.appearance, config.appearanceSkin);
  const selectedAppearanceSkin = storedAppearanceSkin || detectedAppearanceSkin;
  const selectedAppearanceSkinLabel = storedAppearanceSkin
    ? `${APPEARANCE_SKIN_MAP.get(storedAppearanceSkin)?.label || storedAppearanceSkin}${detectedAppearanceSkin === 'custom' ? ' (modified)' : ''}`
    : detectedAppearanceSkin === 'custom'
      ? 'Custom (manual edits)'
      : (APPEARANCE_SKIN_MAP.get(detectedAppearanceSkin)?.label || 'Custom');
  const interfaceTone = normalizeTone(config.appearanceTone);
  const PROTECTION_COLOR_SAFE = '#16f78f';
  const PROTECTION_COLOR_ALERT = '#ff4d57';
  const protectionIndicatorColor = protectionState.enabled ? PROTECTION_COLOR_SAFE : PROTECTION_COLOR_ALERT;
  const protectionIndicatorShadow = protectionState.enabled
    ? '0 0 22px rgba(22, 247, 143, 0.65)'
    : '0 0 18px rgba(255, 77, 87, 0.75)';
  const protectionIndicatorLabel = protectionState.loading
    ? 'Checking…'
    : protectionState.enabled
      ? 'Protection Enabled'
      : 'Protection Disabled';
  const protectionToggleLabel = protectionState.enabled ? 'Disable Protection' : 'Enable Protection';
  const showProtectionIndicator = tab === 'settings';

  const selectedPinSizeDisabled = (selectedMissionIdx==null && selectedDevIdx==null);

  function updateGameTagsDraft(value) {
    setGameTagsDraft(value);
    const tags = value.split(',').map(t => t.trim()).filter(Boolean);
    setConfig(prev => {
      if (!prev) return prev;
      return normalizeGameMetadata({ ...prev, game: { ...prev.game, tags } }, slugForMeta);
    });
  }

  function setDeployEnabled(nextEnabled) {
    setConfig(prev => {
      if (!prev) return prev;
      return { ...prev, game: { ...(prev.game || {}), deployEnabled: nextEnabled } };
    });
    setDirty(true);
    setStatus(nextEnabled
      ? 'Game deployment enabled — Save & Publish will deploy the game build.'
      : 'Game deployment disabled — Save & Publish updates admin data only.');
  }

  async function handleCoverFile(file) {
    if (!file) return;
    const safeName = file.name || 'cover';
    const looksLikeImage = (file.type && file.type.startsWith('image/')) || MEDIA_EXTENSION_PATTERNS.image.test(file.name || '');
    if (!looksLikeImage) {
      setUploadStatus(`❌ ${safeName} is not an image file.`);
      return;
    }
    const sizeBytes = file.size || 0;
    if (sizeBytes > COVER_SIZE_LIMIT_BYTES) {
      const sizeKb = Math.max(1, Math.round(sizeBytes / 1024));
      setUploadStatus(`❌ ${safeName} is ${sizeKb} KB — please choose an image under 5 MB (PNG or JPG work best).`);
      setCoverUploadPreview('');
      setCoverUploadTarget('');
      return;
    }
    let localPreview = '';
    if (typeof window !== 'undefined' && window.URL && typeof window.URL.createObjectURL === 'function') {
      try { localPreview = window.URL.createObjectURL(file); } catch { localPreview = ''; }
    }
    if (localPreview) {
      setCoverUploadPreview(localPreview);
    }
    setCoverUploadTarget('');
    setUploadStatus(`Preparing ${safeName}…`);
    try {
      const url = await uploadToRepo(file, { context: 'settings' });
      if (!url) {
        setUploadStatus(`❌ Upload failed for ${safeName}`);
        setCoverUploadPreview('');
        setCoverUploadTarget('');
        return;
      }
      const normalizedPreview = toDirectMediaURL(url) || url;
      setCoverUploadPreview(normalizedPreview);
      setCoverUploadTarget(url);
      setConfig(prev => {
        if (!prev) return prev;
        const next = normalizeGameMetadata({ ...prev, game: { ...prev.game, coverImage: url } }, slugForMeta);
        return next;
      });
      setDirty(true);
      setInventory((prev = []) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        const normalize = (value) => {
          try { return toDirectMediaURL(value || ''); } catch { return String(value || ''); }
        };
        const normalizedTarget = normalize(url);
        const already = safePrev.some((item) => {
          const candidate = item?.url || item?.path || item;
          return candidate && normalize(candidate) === normalizedTarget;
        });
        if (already) return safePrev;
        return [
          ...safePrev,
          {
            url,
            path: url,
            id: url,
            type: 'image',
            thumbUrl: url,
            label: baseNameFromUrl(url),
          },
        ];
      });
      await syncInventory();
    } catch (err) {
      setUploadStatus(`❌ ${(err?.message) || 'upload failed'}`);
      setCoverUploadPreview('');
      setCoverUploadTarget('');
    }
  }

  async function openCoverPicker() {
    setCoverPickerOpen(true);
    setCoverPickerLoading(true);
    setCoverPickerItems([]);
    try {
      const items = await listInventory(['covers','mediapool','uploads','bundles','icons','missions','devices','assigned']);
      const filtered = (items || []).filter(it => ['image', 'gif'].includes(it.type));
      setCoverPickerItems(filtered);
    } catch {
      setCoverPickerItems([]);
    } finally {
      setCoverPickerLoading(false);
    }
  }

  function applyCoverFromUrl(url) {
    if (!url) return;
    setCoverUploadPreview('');
    setCoverUploadTarget(url);
    setConfig(prev => {
      if (!prev) return prev;
      const next = normalizeGameMetadata({ ...prev, game: { ...prev.game, coverImage: url } }, slugForMeta);
      return next;
    });
    setDirty(true);
    setCoverPickerOpen(false);
  }

  function clearCoverImage() {
    setCoverUploadPreview('');
    setCoverUploadTarget('');
    setConfig(prev => {
      if (!prev) return prev;
      const next = normalizeGameMetadata({ ...prev, game: { ...prev.game, coverImage: '' } }, slugForMeta);
      return next;
    });
    setDirty(true);
  }

  async function saveCoverImageOnly() {
    logConversation('You', 'Saved cover artwork');
    const slug = activeSlug || 'default';
    setStatus('Saving cover image…');
    const saved = await saveAllWithSlug(slug);
    if (saved) {
      setStatus('✅ Cover image saved');
      await syncInventory();
    }
  }

  // Tabs: missions / devices / settings / text / media-pool / assigned
  const tabsOrder = ['settings','missions','devices','text','assigned','media-pool'];

  const isDefault = slugForMeta === 'default';
  const coverImageUrl = config?.game?.coverImage ? toDirectMediaURL(config.game.coverImage) : '';
  const coverPreviewUrl = coverUploadPreview || coverImageUrl;
  const hasCoverForSave = Boolean((config?.game?.coverImage || '').trim() || coverUploadPreview);
  const deployGameEnabled = config?.game?.deployEnabled !== false;
  const headerGameTitle = (config?.game?.title || '').trim() || 'Default Game';
  const headerCoverThumb = config?.game?.coverImage
    ? toDirectMediaURL(config.game.coverImage)
    : '';
  const headerStyle = S.header;
  const editingTitleLabel = (editing?.title || '').trim();
  const missionSaveButtonLabel = `Save and Close ${editingTitleLabel ? `"${editingTitleLabel}" ` : ''}Mission`;
  const missionApplyButtonLabel = editingIsNew
    ? `Add ${editingTitleLabel ? `"${editingTitleLabel}" ` : ''}Mission`
    : `Update ${editingTitleLabel ? `"${editingTitleLabel}" ` : ''}Mission`;
  const missionApplyTooltip = editingIsNew
    ? 'Add this mission to the list and keep editing'
    : 'Update the mission details without closing the editor';
  const deviceTitleLabel = (devDraft?.title || '').trim();
  const deviceSaveButtonLabel = `Save and Close ${deviceTitleLabel ? `"${deviceTitleLabel}" ` : ''}Device`;
  const deviceApplyButtonLabel = deviceEditorMode === 'new'
    ? `Add ${deviceTitleLabel ? `"${deviceTitleLabel}" ` : ''}Device`
    : `Update ${deviceTitleLabel ? `"${deviceTitleLabel}" ` : ''}Device`;
  const deviceApplyTooltip = deviceEditorMode === 'new'
    ? 'Add this device to the list and continue editing'
    : 'Update the device details without closing the editor';
  const metaBranchLabel = adminMeta.branch || 'unknown';
  const metaCommitLabel = adminMeta.commit ? String(adminMeta.commit) : '';
  const metaCommitShort = metaCommitLabel ? metaCommitLabel.slice(0, 7) : '';
  const metaOwnerRepo = adminMeta.repo
    ? `${adminMeta.owner ? `${adminMeta.owner}/` : ''}${adminMeta.repo}`
    : '';
  const metaRepoUrl = adminMeta.owner && adminMeta.repo
    ? `https://github.com/${adminMeta.owner}/${adminMeta.repo}`
    : '';
  const metaCommitUrl = metaCommitLabel && metaRepoUrl
    ? `${metaRepoUrl}/commit/${metaCommitLabel}`
    : '';
  const metaDeploymentUrl = adminMeta.deploymentUrl || adminMeta.vercelUrl || '';
  const metaDeploymentState = adminMeta.deploymentState || (metaDeploymentUrl ? 'UNKNOWN' : '');
  const metaTimestampLabel = adminMeta.fetchedAt ? formatLocalDateTime(adminMeta.fetchedAt) : '';
  const metaVercelUrl = adminMeta.vercelUrl || '';
  const metaVercelLabel = metaVercelUrl ? metaVercelUrl.replace(/^https?:\/\//, '') : '';
  const activeSlugForClient = isDefault ? '' : activeSlug; // omit for Default Game

  return (
    <div style={S.body}>
      <div style={S.metaBanner}>
        <div style={S.metaBannerLine}>
          <span><strong>Branch:</strong> {metaBranchLabel}</span>
          {metaCommitLabel && (
            <span style={S.metaCommitBlock}>
              <strong>Commit:</strong>{' '}
              {metaCommitUrl ? (
                <a
                  href={metaCommitUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={S.metaCommitLink}
                  title={`Open commit ${metaCommitLabel}`}
                >
                  <span style={S.metaBadge}>#{metaCommitShort || metaCommitLabel}</span>
                </a>
              ) : (
                <span style={S.metaBadge} title={`Commit ${metaCommitLabel}`}>
                  #{metaCommitShort || metaCommitLabel}
                </span>
              )}
              {metaCommitLabel.length > 7 && (
                <span style={S.metaCommitCode}>{metaCommitLabel}</span>
              )}
            </span>
          )}
          {metaOwnerRepo && (
            <span>
              <strong>Repo:</strong>{' '}
              {metaRepoUrl ? (
                <a href={metaRepoUrl} target="_blank" rel="noreferrer" style={S.metaLink}>
                  {metaOwnerRepo}
                </a>
              ) : (
                <span style={S.metaMuted}>{metaOwnerRepo}</span>
              )}
            </span>
          )}
          {metaDeploymentState && (
            <span>
              <strong>Deployment:</strong>{' '}
              {metaDeploymentUrl ? (
                <a href={metaDeploymentUrl} target="_blank" rel="noreferrer" style={S.metaLink}>
                  {metaDeploymentState}
                </a>
              ) : (
                metaDeploymentState
              )}
            </span>
          )}
          {metaVercelUrl && (
            <span>
              <strong>Vercel:</strong>{' '}
              <a href={metaVercelUrl} target="_blank" rel="noreferrer" style={S.metaLink}>
                {metaVercelLabel || metaVercelUrl}
              </a>
            </span>
          )}
          {metaTimestampLabel && (
            <span><strong>Updated:</strong> {metaTimestampLabel}</span>
          )}
          {adminMeta.error && (
            <span style={S.metaBannerError}>{adminMeta.error}</span>
          )}
        </div>
      </div>
      <header style={headerStyle}>
        <div style={S.wrap}>
          <div style={S.headerTopRow}>
            <div style={S.headerTitleGroup}>
              <div style={S.headerCoverFrame}>
                {headerCoverThumb ? (
                  <img
                    src={headerCoverThumb}
                    alt="Active game cover"
                    style={S.headerCoverThumb}
                  />
                ) : (
                  <div style={S.headerCoverPlaceholder}>No Cover</div>
                )}
              </div>
              <div style={S.headerTitleColumn}>
                <div style={S.headerGameTitle}>{headerGameTitle}</div>
                <div style={S.headerSubtitle}>Admin Control Deck</div>
              </div>
            </div>
          </div>
          <div style={S.headerNavRow}>
            <div style={S.headerNavPrimary}>
              {tabsOrder.map((t)=>{
                const labelMap = {
                  'missions':'MISSIONS',
                  'devices':'DEVICES',
                  'settings':'SETTINGS',
                  'text':'TEXT',
                  'media-pool':'MEDIA POOL',
                  'assigned':'ASSIGNED MEDIA',
                };
                return (
                  <button key={t} onClick={()=>setTab(t)} style={{ ...S.tab, ...(tab===t?S.tabActive:{}) }}>
                    {labelMap[t] || t.toUpperCase()}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={openNewGameModal}
                style={{ ...S.button, ...S.headerNewGameButton }}
              >
                <span style={S.newGameLabel}>
                  {!deployGameEnabled && <span aria-hidden="true" style={S.headerNewGameLight} />}
                  <span>+ New Game</span>
                </span>
              </button>
              <button
                onClick={async ()=>{
                  await saveAndPublish();
                  const isDefaultNow = !activeSlug || activeSlug === 'default';
                  setActiveSlug(isDefaultNow ? 'default' : activeSlug);
                }}
                disabled={savePubBusy}
                style={{ ...S.button, ...S.savePublishButton, opacity: savePubBusy ? 0.65 : 1 }}
              >
                {savePubBusy ? 'Saving & Publishing…' : 'Save & Publish'}
              </button>
            </div>
            {gameEnabled && (
              <div style={S.headerNavSecondary}>
                <label style={{ color:'var(--admin-muted)', fontSize:12 }}>Game:</label>
                <select value={activeSlug} onChange={(e)=>setActiveSlug(e.target.value)} style={{ ...S.input, width:280 }}>
                  <option value="default">(Default Game)</option>
                  {games.map(g=>(
                    <option key={g.slug} value={g.slug}>{g.title} — {g.slug} ({g.mode||'single'})</option>
                  ))}
                </select>
                <label style={{ color:'var(--admin-muted)', fontSize:12, display:'flex', alignItems:'center', gap:6 }}>
                  <input
                    type="checkbox"
                    checked={deployGameEnabled}
                    onChange={(e)=>setDeployEnabled(e.target.checked)}
                  />
                  Deploy game build
                </label>
                <label style={{ color:'var(--admin-muted)', fontSize:12, display:'flex', alignItems:'center', gap:6 }}>
                  Deploy delay (sec):
                  <input
                    type="number" min={0} max={120}
                    value={deployDelaySec}
                    onChange={(e)=> setDeployDelaySec(Math.max(0, Math.min(120, Number(e.target.value || 0))))}
                    style={{ ...S.input, width:90, opacity: deployGameEnabled ? 1 : 0.45 }}
                    disabled={!deployGameEnabled}
                  />
                </label>
              </div>
            )}
          </div>

          {(showProtectionIndicator || tab === 'settings') && (
            <div style={{ display:'flex', gap:16, justifyContent:'space-between', alignItems:'stretch', flexWrap:'wrap', marginBottom:16 }}>
              <div style={{ flex:'1 1 520px', minWidth:280, display:'flex', flexDirection:'column', gap:12 }}>
                {showProtectionIndicator && (
                  <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                    <div
                      style={{
                        display:'flex',
                        alignItems:'center',
                        gap:10,
                        padding:'8px 16px',
                        borderRadius:999,
                        border:`1px solid ${protectionIndicatorColor}`,
                        background:'var(--appearance-panel-bg, var(--admin-panel-bg))',
                        color: protectionIndicatorColor,
                        fontWeight:700,
                        letterSpacing:1,
                        textTransform:'uppercase',
                        boxShadow: protectionIndicatorShadow,
                      }}
                    >
                      <span style={{ display:'inline-block', width:16, height:16, borderRadius:'50%', background:protectionIndicatorColor, boxShadow: protectionIndicatorShadow }} />
                      {protectionIndicatorLabel}
                    </div>
                    <button
                      onClick={openProtectionPrompt}
                      disabled={protectionState.saving || protectionState.loading}
                      style={{
                        ...S.button,
                        ...(protectionState.enabled ? S.buttonDanger : S.buttonSuccess),
                        minWidth: 180,
                        opacity: (protectionState.saving || protectionState.loading) ? 0.7 : 1,
                      }}
                    >
                      {protectionState.saving ? 'Updating…' : protectionToggleLabel}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          {showProtectionIndicator && protectionError && (
            <div style={{ color: PROTECTION_COLOR_ALERT, fontSize: 12, marginBottom: 12 }}>
              {protectionError}
            </div>
          )}
        </div>
      </header>

      {/* MISSIONS */}
      {tab==='missions' && (
        <main style={S.wrapGrid2}>
          {/* Left list */}
          <aside style={S.sidebarTall}>
            <div style={S.sidebarBar}>
              <div style={S.noteText}>Launch a brand-new mission in this timeline.</div>
              <button
                onClick={startNew}
                style={{
                  ...S.action3DButton,
                  ...(newMissionButtonFlash ? S.action3DFlash : {}),
                }}
                title="Create a new mission and open the editor"
              >
                + New Mission
              </button>
            </div>
            <input
              placeholder="Search…"
              onChange={(e) => {
                const q=e.target.value.toLowerCase();
                document.querySelectorAll('[data-m-title]').forEach(it=>{
                  const t=(it.getAttribute('data-m-title')||'').toLowerCase();
                  it.style.display = t.includes(q) ? '' : 'none';
                });
              }}
              style={S.search}
            />
            <div>
              {(suite.missions||[]).map((m, idx)=>(
                <div key={m.id} data-m-title={(m.title||'')+' '+m.id+' '+m.type} style={S.missionItem}>
                  <div style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', gap:8, alignItems:'center' }}>
                    <button style={{ ...S.button, padding:'6px 10px' }} onClick={()=>removeMission(m.id)}>Delete</button>
                    <div onClick={()=>editExisting(m)} style={{ cursor:'pointer' }}>
                      <div style={{ fontWeight:600 }}>
                        <span style={{ opacity:.65, marginRight:6 }}>#{idx+1}</span>{m.title||m.id}
                      </div>
                      <div style={{ color:'var(--admin-muted)', fontSize:12 }}>{TYPE_LABELS[m.type] || m.type} — id: {m.id}</div>
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      <button title="Move up"   style={{ ...S.button, padding:'6px 10px' }} onClick={()=>moveMission(idx,-1)}>▲</button>
                      <button title="Move down" style={{ ...S.button, padding:'6px 10px' }} onClick={()=>moveMission(idx,+1)}>▼</button>
                      <button title="Duplicate" style={{ ...S.button, padding:'6px 10px' }} onClick={()=>duplicateMission(idx)}>⧉</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* Right: Missions Map */}
          <section style={{ position:'relative' }}>
            <div style={S.card}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:12, marginBottom:8, flexWrap:'wrap' }}>
                <div>
                  <h3 style={{ margin:0 }}>Missions Map</h3>
                  <div style={{ color:'var(--admin-muted)', fontSize:12 }}>
                    Click a <b>mission</b> pin to select. Drag the selected mission, or click the map to move it. Devices are visible here but not editable.
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <input type="checkbox" checked={showRings} onChange={(e)=>setShowRings(e.target.checked)}/> Show radius rings
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                    Selected pin size:
                    <input type="range" min={16} max={120} step={2} value={selectedPinSize}
                      disabled={selectedMissionIdx==null}
                      onChange={(e)=>setSelectedPinSize(Number(e.target.value))}
                    />
                    <code style={{ color:'var(--admin-muted)' }}>{selectedMissionIdx==null ? '—' : `${selectedPinSize}px`}</code>
                  </label>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center', marginBottom:8 }}>
                <input
                  type="range" min={5} max={500} step={5}
                  disabled={missionRadiusDisabled}
                  value={missionRadiusValue}
                  onChange={(e)=> setSelectedMissionRadius(Number(e.target.value)) }
                />
                <code style={{ color:'var(--admin-muted)' }}>
                  {selectedMissionIdx==null ? 'Select a mission to adjust radius' : `M${selectedMissionIdx+1} radius: ${missionRadiusValue} m`}
                </code>
              </div>

              <MapOverview
                missions={(suite?.missions)||[]}
                devices={(config?.devices)||[]}
                icons={config?.icons || DEFAULT_ICONS}
                showRings={showRings}
                interactive={false}
                draftDevice={null}
                selectedDevIdx={null}
                selectedMissionIdx={selectedMissionIdx}
                onDraftChange={null}
                onMoveSelected={null}
                onMoveSelectedMission={(lat,lng)=>moveSelectedMission(lat,lng)}
                onSelectDevice={null}
                onSelectMission={(i)=>{ setSelectedMissionIdx(i); }}
                mapCenter={mapCenter}
                mapZoom={mapZoom}
                defaultIconSizePx={defaultPinSize}
                selectedIconSizePx={selectedPinSize}
                readOnly={false}
                lockToRegion={false}
              />
            </div>

            {/* Mission editor (overlay) */}
            {editing && (
              <div style={S.overlay}>
                <div style={{ ...S.card, width:'min(860px, 94vw)', maxHeight:'82vh', overflowY:'auto', position:'relative' }}>
                  <div style={S.floatingBarTop}>
                    <div style={S.overlayBarSide}>
                      <button
                        style={S.cancelGlowButton}
                        onClick={cancelEdit}
                        title="Close the mission editor without saving"
                      >
                        Cancel & Close
                      </button>
                      <div style={S.noteText}>Exit safely without saving changes.</div>
                    </div>
                    <div style={S.overlayCenter}>
                      <div style={S.overlayIdRow}>
                        <span style={S.overlayIdLabel}>Mission ID</span>
                        <code style={S.overlayIdValue}>{editing.id || '—'}</code>
                      </div>
                      <h3 style={{ margin: '0', fontSize: 18 }}>
                        {editingIsNew ? 'New Mission' : 'Edit Mission'}
                      </h3>
                    </div>
                    <div style={S.overlayBarSide}>
                      <div style={S.overlayActionStack}>
                        <button
                          style={S.overlayUpdateButton}
                          onClick={handleMissionApply}
                          title={missionApplyTooltip}
                        >
                          {missionApplyButtonLabel}
                        </button>
                        <button
                          style={{
                            ...S.action3DButton,
                            ...(missionActionFlash ? S.action3DFlash : {}),
                            width: '100%',
                          }}
                          onClick={() => handleMissionSave({ close: true })}
                          title={`Save and close ${editingTitleLabel ? `${editingTitleLabel} mission` : 'this mission'}`}
                        >
                          {missionSaveButtonLabel}
                        </button>
                      </div>
                      <div style={S.noteText}>Use Update to keep working or Save &amp; Close when you are finished.</div>
                    </div>
                  </div>

                  <div style={S.missionQuickRow}>
                    <div style={S.missionIconPreview}>
                      {(() => {
                        const sel = missionIconEntryFromKey(editing.iconKey);
                        return sel?.url ? (
                          <img
                            alt="mission icon"
                            src={toDirectMediaURL(sel.url)}
                            style={{ width: 48, height: 48, objectFit: 'contain' }}
                          />
                        ) : (
                          <div style={S.missionIconPlaceholder}>icon</div>
                        );
                      })()}
                    </div>
                    <Field label="Title">
                      <input
                        style={S.input}
                        value={editing.title || ''}
                        onChange={(e) => {
                          setEditing({ ...editing, title: e.target.value });
                          setDirty(true);
                        }}
                        placeholder="Mission title"
                      />
                    </Field>
                    <Field label="Type">
                      <select
                        style={S.input}
                        value={editing.type}
                        onChange={(e) => {
                          const t = e.target.value;
                          setEditing({ ...editing, type: t, content: defaultContentForType(t) });
                          setDirty(true);
                        }}
                      >
                        {Object.keys(TYPE_FIELDS).map((k) => (
                          <option key={k} value={k}>
                            {TYPE_LABELS[k] || k}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Icon">
                      <select
                        style={S.input}
                        value={editing.iconKey || ''}
                        onChange={(e) => {
                          setEditing({ ...editing, iconKey: e.target.value });
                          setDirty(true);
                        }}
                      >
                        <option value="">(default)</option>
                        {missionIconOptions.map((it) => (
                          <option key={it.key} value={it.key}>
                            {it.name || it.key}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div style={S.noteText}>This label appears inside the admin and player timelines.</div>

                  <hr style={S.hr}/>

                  {editing.type === 'multiple_choice' && (
                    <>
                      <Field label="Question">
                        <input
                          style={S.input}
                          value={editing.content?.question || ''}
                          onChange={(e)=>{ setEditing({ ...editing, content:{ ...(editing.content||{}), question:e.target.value } }); setDirty(true); }}
                        />
                      </Field>
                      <div style={{ marginBottom: 12 }}>
                        <MultipleChoiceEditor
                          value={Array.isArray(editing.content?.choices) ? editing.content.choices : []}
                          correctIndex={editing.content?.correctIndex}
                          onChange={({ choices, correctIndex }) => {
                            setEditing({ ...editing, content: { ...editing.content, choices, correctIndex } });
                            setDirty(true);
                          }}
                        />
                      </div>
                    </>
                  )}

                  {editing.type === 'short_answer' && (
                    <>
                      <Field label="Question">
                        <input
                          style={S.input}
                          value={editing.content?.question || ''}
                          onChange={(e)=>{ setEditing({ ...editing, content:{ ...(editing.content||{}), question:e.target.value } }); setDirty(true); }}
                        />
                      </Field>
                      <Field label="Correct Answer">
                        <input
                          style={S.input}
                          value={editing.content?.answer || ''}
                          onChange={(e)=>{ setEditing({ ...editing, content:{ ...(editing.content||{}), answer:e.target.value } }); setDirty(true); }}
                        />
                      </Field>
                      <Field label="Also Accept (comma-separated) (optional)">
                        <input
                          style={S.input}
                          value={editing.content?.acceptable || ''}
                          onChange={(e)=>{ setEditing({ ...editing, content:{ ...(editing.content||{}), acceptable:e.target.value } }); setDirty(true); }}
                        />
                      </Field>
                    </>
                  )}

                  {editing.type === 'statement' && (
                    <Field label="Statement Text">
                      <textarea
                        style={{ ...S.input, height: 120, fontFamily: 'ui-monospace, Menlo' }}
                        value={editing.content?.text || ''}
                        onChange={(e) => {
                          setEditing({ ...editing, content: { ...(editing.content || {}), text: e.target.value } });
                          setDirty(true);
                        }}
                      />
                    </Field>
                  )}

                  {(editing.type==='geofence_image'||editing.type==='geofence_video') && (
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:12, color:'var(--admin-muted)', marginBottom:6 }}>Pick location & radius</div>
                      <MapPicker
                        lat={editing.content?.lat} lng={editing.content?.lng} radius={editing.content?.radiusMeters ?? 25}
                        center={mapCenter}
                        onChange={(l1,l2,rad)=>{ setEditing({ ...editing, content:{ ...editing.content, lat:l1, lng:l2, radiusMeters:clamp(rad,5,500) } }); setDirty(true); }}
                      />
                    </div>
                  )}

                  {(editing.type==='multiple_choice'||editing.type==='short_answer'||editing.type==='statement'||editing.type==='video'||editing.type==='stored_statement') && (
                    <div style={{ marginBottom:12 }}>
                      <label style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
                        <input type="checkbox" checked={!!editing.content?.geofenceEnabled}
                          onChange={(e)=>{ const on=e.target.checked;
                            const next={ ...editing.content, geofenceEnabled:on };
                            if (on && (!isFinite(Number(next.lat)) || !isFinite(Number(next.lng)))) { next.lat=mapCenter.lat; next.lng=mapCenter.lng; }
                            setEditing({ ...editing, content:next }); setDirty(true);
                          }}/> Enable geofence for this mission
                      </label>
                      {editing.content?.geofenceEnabled && (
                        <>
                          <MapPicker
                            lat={editing.content?.lat} lng={editing.content?.lng} radius={editing.content?.radiusMeters ?? 25}
                            center={mapCenter}
                            onChange={(l1,l2,rad)=>{ setEditing({ ...editing, content:{ ...editing.content, lat:l1, lng:l2, radiusMeters:clamp(rad,5,500) } }); setDirty(true); }}
                          />
                          <Field label="Cooldown (sec)">
                            <input type="number" min={0} max={3600} style={S.input}
                              value={editing.content?.cooldownSeconds ?? 30}
                              onChange={(e)=>{ const v=Number(e.target.value||0); setEditing({ ...editing, content:{ ...editing.content, cooldownSeconds:v } }); setDirty(true); }}
                            />
                          </Field>
                        </>
                      )}
                    </div>
                  )}

                  {(TYPE_FIELDS[editing.type] || [])
                    .filter(f => !(editing.type === 'multiple_choice' && f.key === 'question'))
                    .filter(f => !(editing.type === 'short_answer' && (f.key === 'question' || f.key === 'answer' || f.key === 'acceptable')))
                    .filter(f => !(editing.type === 'statement' && f.key === 'text'))
                    .map((f)=>(
                    <Field key={f.key} label={f.label}>
                      {f.type==='text' && (
                        <>
                          <input style={S.input} value={editing.content?.[f.key] || ''}
                            onChange={(e)=>{ setEditing({ ...editing, content:{ ...editing.content, [f.key]: e.target.value } }); setDirty(true); }}/>
                          {['mediaUrl','imageUrl','videoUrl','assetUrl','markerUrl'].includes(f.key) && (
                            <MediaPreview url={editing.content?.[f.key]} kind={f.key}/>
                          )}
                        </>
                      )}
                      {f.type==='number' && (
                        <input type="number" min={f.min} max={f.max} style={S.input}
                          value={editing.content?.[f.key] ?? ''} onChange={(e)=>{
                            const v = e.target.value==='' ? '' : Number(e.target.value);
                            const vClamped = (f.key==='radiusMeters') ? clamp(v,5,500) : v;
                            setEditing({ ...editing, content:{ ...editing.content, [f.key]:vClamped } }); setDirty(true);
                          }}/>
                      )}
                      {f.type==='multiline' && (
                        <textarea style={{ ...S.input, height:120, fontFamily:'ui-monospace, Menlo' }}
                          value={editing.content?.[f.key] || ''} onChange={(e)=>{
                            setEditing({ ...editing, content:{ ...editing.content, [f.key]: e.target.value } }); setDirty(true);
                          }}/>
                      )}
                    </Field>
                  ))}

                  <Field label="Points (Reward)">
                    <input type="number" style={S.input} value={editing.rewards?.points ?? 0}
                      onChange={(e)=>{ const v=e.target.value===''?0:Number(e.target.value);
                        setEditing({ ...editing, rewards:{ ...(editing.rewards||{}), points:v } }); setDirty(true); }}/>
                  </Field>

                  
                  <div style={{ marginTop:16, border:'1px solid var(--admin-border-soft)', borderRadius:10, padding:12 }}>
                    <div style={{ fontWeight:700, marginBottom:8 }}>Trigger</div>
                    <label style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <input
                        type="checkbox"
                        checked={missionTriggerState.enabled}
                        onChange={(e)=>{
                          setMissionTriggerPicker('');
                          updateMissionTrigger({ enabled: e.target.checked });
                        }}
                      />
                      <span>Trigger Device — when this device is breached or deployed it will create an action.</span>
                    </label>

                    {missionTriggerState.enabled ? (() => {
                      const trigger = missionTriggerState;
                      const actionOptions = triggerOptionSets[trigger.actionType] || [];
                      const selectedAction = actionOptions.find(opt => opt.id === trigger.actionTarget) || null;
                      const actionPreview = trigger.actionThumbnail || selectedAction?.thumbnail || '';
                      const resolvedActionPreview = actionPreview ? toDirectMediaURL(actionPreview) : '';
                      const deviceOptions = triggerOptionSets.devices || [];
                      const selectedDevice = deviceOptions.find(opt => opt.id === trigger.triggerDeviceId) || null;
                      const responseOptions = triggerOptionSets.responses || [];
                      const selectedResponse = responseOptions.find(opt => opt.id === trigger.triggeredResponseKey) || null;
                      const missionOptions = triggerOptionSets.missions || [];
                      const selectedMission = missionOptions.find(opt => opt.id === trigger.triggeredMissionId) || null;
                      const responsePreview = selectedResponse?.thumbnail ? toDirectMediaURL(selectedResponse.thumbnail) : '';
                      const devicePreview = selectedDevice?.thumbnail ? toDirectMediaURL(selectedDevice.thumbnail) : '';
                      const missionPreview = selectedMission?.thumbnail ? toDirectMediaURL(selectedMission.thumbnail) : '';
                      return (
                        <>
                          <div style={{ marginTop:12, display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                            <div style={{ fontSize:12, color:'var(--admin-muted)' }}>Action type</div>
                            <select
                              style={S.input}
                              value={trigger.actionType}
                              onChange={(e)=>{
                                setMissionTriggerPicker('');
                                updateMissionTrigger({ actionType: e.target.value, actionTarget:'', actionLabel:'', actionThumbnail:'' });
                              }}
                            >
                              <option value="media">Media</option>
                              <option value="devices">Devices</option>
                              <option value="missions">Missions</option>
                            </select>
                          </div>

                          <TriggerDropdown
                            label="Action target"
                            openKey={missionTriggerPicker}
                            setOpenKey={setMissionTriggerPicker}
                            dropdownKey="mission-action"
                            options={actionOptions}
                            selected={selectedAction}
                            onSelect={(opt)=>{
                              updateMissionTrigger({
                                actionTarget: opt?.id || '',
                                actionLabel: opt?.label || '',
                                actionThumbnail: opt?.thumbnail || '',
                              });
                            }}
                          />
                          {resolvedActionPreview && (
                            <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:12 }}>
                              <div style={{ fontSize:12, color:'var(--admin-muted)' }}>Selected action preview</div>
                              <div style={{ width:80, height:60, borderRadius:10, overflow:'hidden', border:'1px solid var(--admin-border-soft)', background:'var(--admin-tab-bg)', display:'grid', placeItems:'center' }}>
                                <img src={resolvedActionPreview} alt="action preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                              </div>
                            </div>
                          )}

                          <TriggerDropdown
                            label="Trigger Device"
                            openKey={missionTriggerPicker}
                            setOpenKey={setMissionTriggerPicker}
                            dropdownKey="mission-device"
                            options={deviceOptions}
                            selected={selectedDevice}
                            onSelect={(opt)=>{
                              updateMissionTrigger({
                                triggerDeviceId: opt?.id || '',
                                triggerDeviceLabel: opt?.label || '',
                              });
                            }}
                          />
                          {devicePreview && (
                            <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:12 }}>
                              <div style={{ fontSize:12, color:'var(--admin-muted)' }}>Device preview</div>
                              <div style={{ width:72, height:56, borderRadius:10, overflow:'hidden', border:'1px solid var(--admin-border-soft)', background:'var(--admin-tab-bg)', display:'grid', placeItems:'center' }}>
                                <img src={devicePreview} alt="device preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                              </div>
                            </div>
                          )}

                          <TriggerDropdown
                            label="Triggered Response"
                            openKey={missionTriggerPicker}
                            setOpenKey={setMissionTriggerPicker}
                            dropdownKey="mission-response"
                            options={responseOptions}
                            selected={selectedResponse}
                            onSelect={(opt)=>{
                              updateMissionTrigger({
                                triggeredResponseKey: opt?.id || '',
                              });
                            }}
                          />
                          {responsePreview && (
                            <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:12 }}>
                              <div style={{ fontSize:12, color:'var(--admin-muted)' }}>Response preview</div>
                              <div style={{ width:80, height:60, borderRadius:10, overflow:'hidden', border:'1px solid var(--admin-border-soft)', background:'var(--admin-tab-bg)', display:'grid', placeItems:'center' }}>
                                <img src={responsePreview} alt="response preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                              </div>
                            </div>
                          )}

                          <TriggerDropdown
                            label="Triggered Mission"
                            openKey={missionTriggerPicker}
                            setOpenKey={setMissionTriggerPicker}
                            dropdownKey="mission-mission"
                            options={missionOptions}
                            selected={selectedMission}
                            onSelect={(opt)=>{
                              updateMissionTrigger({
                                triggeredMissionId: opt?.id || '',
                              });
                            }}
                          />
                          {missionPreview && (
                            <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:12 }}>
                              <div style={{ fontSize:12, color:'var(--admin-muted)' }}>Triggered mission preview</div>
                              <div style={{ width:72, height:56, borderRadius:10, overflow:'hidden', border:'1px solid var(--admin-border-soft)', background:'var(--admin-tab-bg)', display:'grid', placeItems:'center' }}>
                                <img src={missionPreview} alt="mission preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })() : (
                      <div style={{ marginTop:8, color:'var(--admin-muted)', fontSize:12 }}>Enable Trigger Device to configure trigger actions.</div>
                    )}
                  </div>

                  {/* Mission Response (Correct/Wrong): below map, above Continue */}
                  <SafeBoundary
                    fallback={missionResponsesFallback}
                    onError={(error) => {
                      console.error('Mission responses render failure', error);
                      setMissionResponsesError(error);
                      const message = error?.message || error || 'unknown error';
                      setStatus(`❌ Mission responses failed to load: ${message}`);
                    }}
                    onReset={() => setMissionResponsesError(null)}
                    resetKeys={[missionResponsesError, editing, inventory]}
                  >
                    <InlineMissionResponses editing={editing} setEditing={setEditing} inventory={inventory} />
                  </SafeBoundary>

                  <hr style={S.hr} />
                  <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <input
                      type="checkbox"
                      checked={editing.showContinue !== false}
                      onChange={(e)=>{ setEditing({ ...editing, showContinue: e.target.checked }); setDirty(true); }}
                    />
                    Show “Continue” button to close this mission
                  </label>

                  <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <input type="checkbox" checked={!!editing.appearanceOverrideEnabled}
                      onChange={(e)=>{ setEditing({ ...editing, appearanceOverrideEnabled:e.target.checked }); setDirty(true); }}/>
                    Use custom appearance for this mission
                  </label>
                  {editing.appearanceOverrideEnabled && (
                    <AppearanceEditor value={editing.appearance||defaultAppearance()}
                      tone={interfaceTone}
                      onChange={(next)=>{ setEditing({ ...editing, appearance:next }); setDirty(true); }}/>
                  )}

                  {dirty && <div style={{ marginTop:6, color:'#ffd166' }}>Unsaved changes…</div>}
                </div>
              </div>
            )}
          </section>
        </main>
      )}

      {/* DEVICES */}
      {tab==='devices' && (
        <main style={S.wrapGrid2}>
          <aside style={S.sidebarTall}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:8, marginBottom:8 }}>
              <form onSubmit={devSearch} style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:8 }}>
                <input placeholder="Search address or place…" style={S.input} value={devSearchQ} onChange={(e)=>setDevSearchQ(e.target.value)} />
                <button type="button" style={S.button} onClick={useMyLocation}>📍 My location</button>
                <button type="submit" disabled={devSearching} style={S.button}>{devSearching ? 'Searching…' : 'Search'}</button>
              </form>

              <div style={{ background:'var(--admin-input-bg)', border:'1px solid var(--admin-border-soft)', borderRadius:10, padding:8, maxHeight:180, overflow:'auto', display: devResults.length>0 ? 'block' : 'none' }}>
                {devResults.map((r,i)=>(
                  <div key={i} onClick={()=>applySearchResult(r)} style={{ padding:'6px 8px', cursor:'pointer', borderBottom:'1px solid var(--admin-border-soft)' }}>
                    <div style={{ fontWeight:600 }}>{r.display_name}</div>
                    <div style={{ color:'var(--admin-muted)', fontSize:12 }}>lat {Number(r.lat).toFixed(6)}, lng {Number(r.lon).toFixed(6)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={S.sidebarBar}>
              <div style={S.noteText}>Deploy devices and markers from this control strip.</div>
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', justifyContent:'flex-end' }}>
                {selectedDevIdx!=null && (
                  <button
                    style={S.button}
                    onClick={()=>{ setSelectedDevIdx(null); closeDeviceEditor(); }}
                    title="Deselect the highlighted device"
                  >
                    Clear selection
                  </button>
                )}
                <button
                  style={{
                    ...S.action3DButton,
                    ...(addDeviceButtonFlash ? S.action3DFlash : {}),
                  }}
                  onClick={addDevice}
                  title="Create a new device draft"
                >
                  + Add Device
                </button>
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {(devices||[]).map((x,i)=>{
                const iconUrl = x.iconKey ? deviceIconUrlFromKey(x.iconKey) : '';
                const selected = selectedDevIdx === i;
                const hasCoords = typeof x.lat === 'number' && typeof x.lng === 'number';
                return (
                  <div
                    key={x.id||i}
                    onClick={()=>openDeviceEditor(i)}
                    style={{
                      display:'grid',
                      gridTemplateColumns:'56px 1fr auto',
                      gap:12,
                      alignItems:'center',
                      padding:12,
                      borderRadius:12,
                      border:`1px solid ${selected ? 'rgba(45, 212, 191, 0.35)' : 'var(--admin-border-soft)'}`,
                      background:selected ? 'var(--admin-tab-active-bg)' : 'var(--appearance-panel-bg, var(--admin-panel-bg))',
                      cursor:'pointer',
                    }}
                  >
                    <div style={{ width:52, height:52, borderRadius:10, background:'var(--appearance-panel-bg, var(--admin-panel-bg))', border:'1px solid var(--admin-border-soft)', display:'grid', placeItems:'center', overflow:'hidden' }}>
                      {iconUrl
                        ? <img alt={x.title || 'device icon'} src={toDirectMediaURL(iconUrl)} style={{ width:'100%', height:'100%', objectFit:'contain' }}/>
                        : <div style={{ color:'var(--admin-muted)', fontSize:12, textAlign:'center', padding:'6px 4px' }}>{(x.type||'D').slice(0,1).toUpperCase()}</div>}
                    </div>
                    <div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                        <div style={{ fontWeight:600 }}>{`D${i+1}`} — {x.title || '(untitled)'}</div>
                        <div style={{ fontSize:12, color:'var(--admin-muted)' }}>{hasCoords ? `${Number(x.lat).toFixed(4)}, ${Number(x.lng).toFixed(4)}` : 'Not placed'}</div>
                      </div>
                      <div style={{ marginTop:6, display:'flex', gap:8, flexWrap:'wrap', fontSize:12 }}>
                        <span style={S.chip}>{x.type}</span>
                        <span style={S.chip}>Radius {x.pickupRadius} m</span>
                        <span style={S.chip}>Effect {x.effectSeconds}s</span>
                      </div>
                    </div>
                    <div onClick={(e)=>e.stopPropagation()} style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button title="Move up" style={{ ...S.button, padding:'6px 10px' }} disabled={i===0} onClick={()=>moveDevice(i,-1)}>▲</button>
                        <button title="Move down" style={{ ...S.button, padding:'6px 10px' }} disabled={i===(devices?.length||0)-1} onClick={()=>moveDevice(i,+1)}>▼</button>
                      </div>
                      <div style={{ display:'flex', gap:6 }}>
                        <button title="Duplicate" style={{ ...S.button, padding:'6px 10px' }} onClick={()=>duplicateDevice(i)}>⧉</button>
                        <button title="Delete" style={{ ...S.button, ...S.buttonDanger, padding:'6px 10px' }} onClick={()=>deleteDevice(i)}>🗑</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {(devices||[]).length===0 && <div style={{ color:'var(--admin-muted)' }}>No devices yet. Use “Add Device” to place devices.</div>}
          </aside>

          <section style={{ position:'relative' }}>
            <div style={S.card}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:12, marginBottom:8, flexWrap:'wrap' }}>
                <div>
                  <h3 style={{ margin:0 }}>Devices Map</h3>
                  <div style={{ color:'var(--admin-muted)', fontSize:12 }}>
                    Select a <b>device</b> pin to move it. Map uses your **Game Region** center/zoom.
                  </div>
                </div>
              </div>

              {isDeviceEditorOpen && (() => {
                const trigger = mergeTriggerState(devDraft.trigger);
                const actionOptions = triggerOptionSets[trigger.actionType] || [];
                const selectedAction = actionOptions.find(opt => opt.id === trigger.actionTarget) || null;
                const previewThumb = trigger.actionThumbnail || selectedAction?.thumbnail || '';
                const resolvedPreview = previewThumb ? toDirectMediaURL(previewThumb) : '';
                return (
                  <div style={{ border:'1px solid var(--admin-border-soft)', borderRadius:10, padding:12, marginBottom:12 }}>
                    <div style={S.floatingBarTop}>
                      <div style={S.overlayBarSide}>
                        <button
                          style={S.cancelGlowButton}
                          onClick={cancelDeviceEditor}
                          title="Close the device editor without saving"
                        >
                          Cancel & Close
                        </button>
                        <div style={S.noteText}>Use when you need to exit without storing updates.</div>
                      </div>
                      <div style={S.overlayCenter}>
                        <div style={S.overlayIdRow}>
                          <span style={S.overlayIdLabel}>Device ID</span>
                          <code style={S.overlayIdValue}>{devDraft.id || '—'}</code>
                        </div>
                        <h4 style={{ margin:'0 0 6px 0' }}>
                          {deviceEditorMode === 'new' ? 'New Device' : 'Edit Device'}
                        </h4>
                        <div style={{ marginTop:4 }}>
                          <button
                            type="button"
                            style={S.subtleActionButton}
                            onClick={resetDeviceEditor}
                            title="Restore the draft to its last saved state"
                          >
                            Reset draft
                          </button>
                        </div>
                        <div style={S.noteText}>Update the title, type, or trigger settings before saving.</div>
                      </div>
                      <div style={S.overlayBarSide}>
                        <div style={S.overlayActionStack}>
                          <button
                            style={S.overlayUpdateButton}
                            onClick={handleDeviceApply}
                            title={deviceApplyTooltip}
                          >
                            {deviceApplyButtonLabel}
                          </button>
                          <button
                            style={{
                              ...S.action3DButton,
                              ...(deviceActionFlash ? S.action3DFlash : {}),
                              width: '100%',
                            }}
                            onClick={() => handleDeviceSave({ close: true })}
                            title={`Save and close ${deviceTitleLabel ? `${deviceTitleLabel} device` : 'this device'}`}
                          >
                            {deviceSaveButtonLabel}
                          </button>
                        </div>
                        <div style={S.noteText}>Tap Update to keep the editor open or Save &amp; Close to finish.</div>
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'64px 1fr 1fr 1fr 1fr', gap:8, alignItems:'center' }}>
                      <div>
                        {devDraft.iconKey
                          ? <img alt="icon" src={toDirectMediaURL(deviceIconUrlFromKey(devDraft.iconKey))} style={{ width:48, height:48, objectFit:'contain', border:'1px solid var(--admin-border-soft)', borderRadius:8 }}/>
                          : <div style={{ width:48, height:48, border:'1px dashed var(--admin-border-soft)', borderRadius:8, display:'grid', placeItems:'center', color:'var(--admin-muted)' }}>icon</div>}
                      </div>
                      <Field label="Title"><input style={S.input} value={devDraft.title} onChange={(e)=>setDevDraft(d=>({ ...d, title:e.target.value }))}/></Field>
                      <Field label="Type">
                        <select style={S.input} value={devDraft.type} onChange={(e)=>setDevDraft(d=>({ ...d, type:e.target.value }))}>
                          {DEVICE_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </Field>
                      <Field label="Icon">
                        <select style={S.input} value={devDraft.iconKey} onChange={(e)=>setDevDraft(d=>({ ...d, iconKey:e.target.value }))}>
                          <option value="">(default)</option>
                          {(config?.icons?.devices||[]).map(it=><option key={it.key} value={it.key}>{it.name||it.key}</option>)}
                        </select>
                      </Field>
                      <Field label="Effect (sec)">
                        <input type="number" min={5} max={3600} style={S.input} value={devDraft.effectSeconds}
                          onChange={(e)=>setDevDraft(d=>({ ...d, effectSeconds: clamp(Number(e.target.value||0),5,3600) }))}/>
                      </Field>
                    </div>

                    <div style={{ marginTop:14, border:'1px solid var(--admin-border-soft)', borderRadius:10, padding:12 }}>
                      <div style={{ fontWeight:700, marginBottom:8 }}>Trigger</div>
                      <label style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <input
                          type="checkbox"
                          checked={trigger.enabled}
                          onChange={(e)=>{
                            const checked = e.target.checked;
                            setDeviceTriggerPicker('');
                            setDevDraft(d=>({ ...d, trigger: mergeTriggerState(d.trigger, { enabled: checked }) }));
                          }}
                        />
                        <span>
                          Trigger Device — when this device is breached or deployed it will create an action.
                        </span>
                      </label>

                      {trigger.enabled ? (
                        <>
                          <div style={{ marginTop:12, display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                            <div style={{ fontSize:12, color:'var(--admin-muted)' }}>Action type</div>
                            <select
                              style={S.input}
                              value={trigger.actionType}
                              onChange={(e)=>{
                                const nextType = e.target.value;
                                setDeviceTriggerPicker('');
                                setDevDraft(d=>({
                                  ...d,
                                  trigger: mergeTriggerState(d.trigger, {
                                    actionType: nextType,
                                    actionTarget: '',
                                    actionLabel: '',
                                    actionThumbnail: '',
                                  }),
                                }));
                              }}
                            >
                              <option value="media">Media</option>
                              <option value="devices">Devices</option>
                              <option value="missions">Missions</option>
                            </select>
                          </div>

                          <div style={{ marginTop:12 }}>
                            <div style={{ fontSize:12, color:'var(--admin-muted)', marginBottom:6 }}>Action target</div>
                            <div style={{ position:'relative' }}>
                              <button
                                type="button"
                                style={{ ...S.button, width:'100%', justifyContent:'space-between', display:'flex', alignItems:'center' }}
                                onClick={()=>setDeviceTriggerPicker(prev => prev === 'action' ? '' : 'action')}
                              >
                                <span>{selectedAction ? selectedAction.label : 'Select action target'}</span>
                                <span style={{ opacity:0.6 }}>▾</span>
                              </button>
                              {deviceTriggerPicker === 'action' && (
                                <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, zIndex:30, maxHeight:240, overflowY:'auto', border:'1px solid var(--admin-border-soft)', borderRadius:10, background:'var(--appearance-panel-bg, var(--admin-panel-bg))', boxShadow:'0 16px 32px rgba(0,0,0,0.4)' }}>
                                  {actionOptions.length === 0 ? (
                                    <div style={{ padding:12, color:'var(--admin-muted)' }}>No options available.</div>
                                  ) : actionOptions.map(opt => (
                                    <div
                                      key={opt.id}
                                      onClick={()=>{
                                        setDevDraft(d=>({
                                          ...d,
                                          trigger: mergeTriggerState(d.trigger, {
                                            actionTarget: opt.id,
                                            actionLabel: opt.label,
                                            actionThumbnail: opt.thumbnail,
                                          }),
                                        }));
                                        setDeviceTriggerPicker('');
                                      }}
                                      style={{ display:'grid', gridTemplateColumns:'56px 1fr', gap:10, alignItems:'center', padding:'8px 12px', cursor:'pointer', borderBottom:'1px solid var(--admin-border-soft)' }}
                                    >
                                      <div style={{ width:56, height:42, borderRadius:8, overflow:'hidden', background:'var(--admin-tab-bg)', display:'grid', placeItems:'center' }}>
                                        {opt.thumbnail ? (
                                          <img src={toDirectMediaURL(opt.thumbnail)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                        ) : (
                                          <div style={{ fontSize:12, color:'var(--admin-muted)' }}>No preview</div>
                                        )}
                                      </div>
                                      <div>
                                        <div style={{ fontWeight:600 }}>{opt.label}</div>
                                        <div style={{ fontSize:12, color:'var(--admin-muted)' }}>{opt.id}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            {resolvedPreview && (
                              <div style={{ marginTop:12, display:'flex', gap:12, alignItems:'center' }}>
                                <div style={{ fontSize:12, color:'var(--admin-muted)' }}>Selected preview</div>
                                <div style={{ width:80, height:60, borderRadius:10, overflow:'hidden', border:'1px solid var(--admin-border-soft)', background:'var(--admin-tab-bg)', display:'grid', placeItems:'center' }}>
                                  <img src={resolvedPreview} alt="preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div style={{ marginTop:8, color:'var(--admin-muted)', fontSize:12 }}>Enable Trigger Device to configure actions.</div>
                      )}
                    </div>

                    <div style={{ marginTop:8, color:'var(--admin-muted)', fontSize:12 }}>
                      {devDraft.lat==null ? 'Click the map or search an address to set location'
                        : <>lat {Number(devDraft.lat).toFixed(6)}, lng {Number(devDraft.lng).toFixed(6)}</>}
                    </div>
                  </div>
                );
              })()}

              <div style={{ display:'grid', gap:8, marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <input type="checkbox" checked={showRings} onChange={(e)=>setShowRings(e.target.checked)}/> Show radius rings
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                    Selected pin size:
                    <input type="range" min={16} max={120} step={2} value={selectedPinSize}
                      disabled={selectedDevIdx==null}
                      onChange={(e)=>setSelectedPinSize(Number(e.target.value))}
                    />
                    <code style={{ color:'var(--admin-muted)' }}>{selectedDevIdx==null ? '—' : `${selectedPinSize}px`}</code>
                  </label>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center' }}>
                  <input
                    type="range" min={5} max={2000} step={5}
                    disabled={deviceRadiusDisabled}
                    value={deviceRadiusValue}
                    onChange={(e)=>{
                      const r = Number(e.target.value);
                      if (selectedDevIdx!=null) setSelectedDeviceRadius(r);
                      else setDevDraft(d=>({ ...d, pickupRadius: r }));
                    }}
                  />
                  <code style={{ color:'var(--admin-muted)' }}>
                    {selectedDevIdx!=null ? `D${selectedDevIdx+1} radius: ${deviceRadiusValue} m`
                     : isAddingDevice ? `New device radius: ${deviceRadiusValue} m`
                     : 'Select a device to adjust radius'}
                  </code>
                </div>
              </div>

              <MapOverview
                missions={(suite?.missions)||[]}
                devices={devices}
                icons={config?.icons||DEFAULT_ICONS}
                showRings={showRings}
                mapCenter={mapCenter}
                mapZoom={mapZoom}
                defaultIconSizePx={defaultPinSize}
                selectedIconSizePx={selectedPinSize}
                interactive={isAddingDevice}
                draftDevice={isAddingDevice ? { lat:devDraft.lat, lng:devDraft.lng, radius:devDraft.pickupRadius } : null}
                selectedDevIdx={selectedDevIdx}
                selectedMissionIdx={null}
                onDraftChange={isAddingDevice ? ((lat,lng)=>setDevDraft(d=>({ ...d, lat, lng }))) : null}
                onMoveSelected={(lat,lng)=>moveSelectedDevice(lat,lng)}
                onMoveSelectedMission={null}
                onSelectDevice={(i)=>{ openDeviceEditor(i); }}
                onSelectMission={null}
                readOnly={false}
                lockToRegion={true}
              />
            </div>
          </section>
        </main>
      )}

      {/* SETTINGS */}
      {tab==='settings' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <h3 style={{ marginTop:0 }}>Game Settings</h3>
            <div style={S.gameTitleRow}>
              <div style={S.readonlyField}>
                <div style={S.fieldLabel}>Game Title</div>
                <div style={S.readonlyValue} title={headerGameTitle}>{headerGameTitle}</div>
                <div style={S.noteText}>Titles are managed per game. Create a new game to set a different name.</div>
              </div>
              <div style={S.readonlyField}>
                <div style={S.fieldLabel}>Slug</div>
                <code style={S.readonlyCode}>{config?.game?.slug || slugForMeta}</code>
                <div style={S.noteText}>Each slug maps to <code>/public/games/[slug]</code> for config, missions, and covers.</div>
              </div>
            </div>
            <div style={S.coverControlsRow}>
              <div
                onDragOver={(e)=>{ e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; setCoverDropActive(true); }}
                onDragLeave={(e)=>{ e.preventDefault(); setCoverDropActive(false); }}
                onDrop={(e)=>{
                  e.preventDefault();
                  setCoverDropActive(false);
                  const file = e.dataTransfer?.files?.[0];
                  if (file) handleCoverFile(file);
                }}
                style={{ ...S.coverDropZone, ...(coverDropActive ? S.coverDropZoneActive : {}) }}
              >
                {coverPreviewUrl ? (
                  <img src={coverPreviewUrl} alt="Cover preview" style={S.coverDropImage} />
                ) : (
                  <div style={S.coverDropPlaceholder}>
                    <strong>Drag & drop cover art</strong>
                    <span>JPG or PNG · under 5&nbsp;MB · ideal at 16:9</span>
                  </div>
                )}
              </div>
              <div style={S.coverActionsColumn}>
                <div style={S.coverActionButtons}>
                  <button
                    style={{ ...S.button, ...S.saveCoverButton, opacity: hasCoverForSave ? 1 : 0.45 }}
                    onClick={saveCoverImageOnly}
                    disabled={!hasCoverForSave}
                  >
                    Save Cover Image
                  </button>
                  <button style={S.button} onClick={()=>coverFileInputRef.current?.click()}>Upload image</button>
                  <input
                    ref={coverFileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display:'none' }}
                    onChange={(e)=>{
                      const file = e.target.files?.[0];
                      if (file) handleCoverFile(file);
                      if (e.target) e.target.value = '';
                    }}
                  />
                  <button style={S.button} onClick={openCoverPicker} disabled={coverPickerLoading}>
                    {coverPickerLoading ? 'Loading media…' : 'Media pool'}
                  </button>
                  <button
                    style={{ ...S.button, ...S.buttonDanger }}
                    onClick={clearCoverImage}
                    disabled={!config?.game?.coverImage}
                  >
                    Remove
                  </button>
                </div>
                {uploadStatus && (
                  <div style={S.coverActionStatus}>{uploadStatus}</div>
                )}
                <div style={S.coverActionHint}>
                  Tip: <strong>Save Cover Image</strong> stores this artwork right away and also copies it to <code>/media/covers</code> for reuse.
                </div>
              </div>
            </div>
            <div style={{ marginTop: 18 }} />
            <Field label="Saved Games">
              <select
                style={S.input}
                value={activeSlug}
                onChange={(e)=>setActiveSlug(e.target.value)}
              >
                {selectGameOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <div style={S.noteText}>
                Switch to another saved escape ride. Use the “+ New Game” control in the top navigation to add a title.
              </div>
            </Field>
            <Field label="Game Type">
              <select style={S.input} value={config.game.type}
                onChange={(e)=>setConfig({ ...config, game:{ ...config.game, type:e.target.value } })}>
                {GAME_TYPES.map((g)=><option key={g} value={g}>{g}</option>)}
              </select>
              <div style={S.noteText}>Pick the base structure for missions and pacing.</div>
            </Field>
            <Field label="Game Tags (comma separated)">
              <input
                style={S.input}
                value={gameTagsDraft}
                onChange={(e)=>updateGameTagsDraft(e.target.value)}
                placeholder="default-game, mystery"
              />
              <div style={S.noteText}>
                The current slug and <code>default-game</code> are enforced automatically.
              </div>
            </Field>
            <Field label="Game Deployment">
              <label style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input
                  type="checkbox"
                  checked={deployGameEnabled}
                  onChange={(e)=>setDeployEnabled(e.target.checked)}
                />
                Enable publishing to the live game build
              </label>
              <div style={S.noteText}>
                When disabled, Save & Publish only updates the admin data and skips deploying a game bundle.
              </div>
            </Field>
            <Field label="Stripe Splash Page">
              <label style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input type="checkbox" checked={config.splash.enabled}
                  onChange={(e)=>setConfig({ ...config, splash:{ ...config.splash, enabled:e.target.checked } })}/>
                Enable Splash (game code & Stripe)
              </label>
              <div style={S.noteText}>Toggles the landing experience with access code + payment prompts.</div>
            </Field>
          </div>

          <div style={{ ...S.card, marginTop:16 }}>
            <h3 style={{ marginTop:0 }}>Game Region & Geofence</h3>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
              <Field label="Default Map Center — Latitude">
                <input
                  type="number" step="0.000001" style={S.input}
                  value={config.map?.centerLat ?? ''}
                  onChange={(e)=>setConfig({ ...config, map:{ ...(config.map||{}), centerLat: Number(e.target.value||0) } })}
                />
              </Field>
              <Field label="Default Map Center — Longitude">
                <input
                  type="number" step="0.000001" style={S.input}
                  value={config.map?.centerLng ?? ''}
                  onChange={(e)=>setConfig({ ...config, map:{ ...(config.map||{}), centerLng: Number(e.target.value||0) } })}
                />
              </Field>
              <Field label="Find center by address/city">
                <form onSubmit={searchMapCenter} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8 }}>
                  <input placeholder="Address / City" value={mapSearchQ} onChange={(e)=>setMapSearchQ(e.target.value)} style={S.input}/>
                  <button type="submit" className="button" style={S.button} disabled={mapSearching}>{mapSearching?'Searching…':'Search'}</button>
                </form>
                <div style={{ background:'var(--admin-input-bg)', border:'1px solid var(--admin-border-soft)', borderRadius:10, padding:8, marginTop:8, maxHeight:160, overflow:'auto', display: mapResults.length>0 ? 'block' : 'none' }}>
                  {mapResults.map((r,i)=>(
                    <div key={i} onClick={()=>useCenterResult(r)} style={{ padding:'6px 8px', cursor:'pointer', borderBottom:'1px solid var(--admin-border-soft)' }}>
                      <div style={{ fontWeight:600 }}>{r.display_name}</div>
                      <div style={{ color:'var(--admin-muted)', fontSize:12 }}>lat {Number(r.lat).toFixed(6)}, lng {Number(r.lon).toFixed(6)}</div>
                    </div>
                  ))}
                </div>
              </Field>
              <Field label="Default Zoom">
                <input
                  type="number" min={2} max={20} style={S.input}
                  value={config.map?.defaultZoom ?? 13}
                  onChange={(e)=>setConfig({ ...config, map:{ ...(config.map||{}), defaultZoom: clamp(Number(e.target.value||13), 2, 20) } })}
                />
              </Field>
              <Field label="Geofence Mode">
                <select
                  style={S.input}
                  value={config.geofence?.mode || 'test'}
                  onChange={(e)=>setConfig({ ...config, geofence:{ ...(config.geofence||{}), mode: e.target.value } })}
                >
                  <option value="test">Test — click to enter (dev)</option>
                  <option value="live">Live — GPS radius only</option>
                </select>
              </Field>
            </div>
            <div style={{ color:'var(--admin-muted)', marginTop:8, fontSize:12 }}>
              These defaults keep pins in the same region. “Geofence Mode” can be used by the Game client to allow click-to-enter in test vs GPS in live.
            </div>
          </div>

          <div style={{ ...S.card, marginTop:16 }}>
            <h3 style={{ marginTop:0 }}>Maintenance</h3>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {gameEnabled && (
                <button
                  style={{ ...S.button, ...S.buttonDanger }}
                  onClick={()=> setConfirmDeleteOpen(true)}
                >
                  🗑 Delete Game
                </button>
              )}
              <button style={S.button} onClick={scanProject}>🔎 Scan media usage (find unused)</button>
            </div>
          </div>

          <div style={{ ...S.card, marginTop:16 }}>
            <h3 style={{ marginTop:0 }}>Appearance (Global)</h3>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, color:'var(--admin-muted)', marginBottom:8 }}>Interface tone</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[
                  { key:'light', label:'☀️ Light — dark text' },
                  { key:'dark', label:'🌙 Dark — light text' },
                ].map((option) => {
                  const active = interfaceTone === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={()=>updateInterfaceTone(option.key)}
                      style={{
                        borderRadius:12,
                        padding:'8px 14px',
                        border: active ? '1px solid var(--admin-accent)' : '1px solid var(--admin-border-soft)',
                        background: active ? 'var(--admin-tab-active-bg)' : 'var(--admin-tab-bg)',
                        color:'var(--admin-body-color)',
                        cursor:'pointer',
                        fontWeight: active ? 600 : 500,
                        boxShadow: active ? '0 0 0 1px rgba(255,255,255,0.08)' : 'none',
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ color:'var(--admin-muted)', fontSize:12, marginTop:8 }}>
                Switch between bright control-room surfaces or a night-mode deck. The tone applies to the admin UI and live game backgrounds.
              </div>
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, color:'var(--admin-muted)', marginBottom:8 }}>Theme skins</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:8 }}>
                {APPEARANCE_SKINS.map((skin)=>{
                  const active = selectedAppearanceSkin === skin.key;
                  const previewBg = skin.appearance.screenBgImage && skin.appearance.screenBgImageEnabled !== false
                    ? `linear-gradient(rgba(0,0,0,${skin.appearance.screenBgOpacity}), rgba(0,0,0,${skin.appearance.screenBgOpacity})), url(${toDirectMediaURL(skin.appearance.screenBgImage)}) center/cover no-repeat`
                    : `linear-gradient(rgba(0,0,0,${skin.appearance.screenBgOpacity}), rgba(0,0,0,${skin.appearance.screenBgOpacity})), ${skin.appearance.screenBgColor}`;
                  return (
                    <button
                      key={skin.key}
                      type="button"
                      onClick={()=>applyAppearanceSkin(skin.key)}
                      style={{
                        borderRadius:12,
                        border:`1px solid ${active ? 'var(--admin-accent)' : 'var(--admin-border-soft)'}`,
                        background: active ? 'var(--admin-tab-active-bg)' : 'var(--admin-tab-bg)',
                        padding:12,
                        textAlign:'left',
                        color:'var(--admin-body-color)',
                        cursor:'pointer',
                      }}
                    >
                      <div style={{ fontWeight:600 }}>{skin.label}</div>
                      <div style={{ fontSize:12, color:'var(--admin-muted)', margin:'4px 0 8px 0' }}>{skin.description}</div>
                      <div style={{
                        border:'1px dashed var(--admin-border-soft)',
                        borderRadius:8,
                        padding:10,
                        background: previewBg,
                        color: skin.appearance.fontColor,
                        fontFamily: skin.appearance.fontFamily,
                        fontSize: Math.max(14, Math.min(20, skin.appearance.fontSizePx * 0.7)),
                        textAlign: skin.appearance.textAlign,
                      }}>
                        Preview text
                      </div>
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop:8, fontSize:12, color:'var(--admin-muted)' }}>
                Selected skin: <strong>{selectedAppearanceSkinLabel}</strong>
              </div>
            </div>
            <AppearanceEditor
              value={config.appearance||defaultAppearance()}
              tone={interfaceTone}
              onChange={(next)=>{
                setConfig(prev => {
                  const base = prev || {};
                  const retainedSkin = base.appearanceSkin && ADMIN_SKIN_TO_UI.has(base.appearanceSkin)
                    ? base.appearanceSkin
                    : detectAppearanceSkin(next, base.appearanceSkin);
                  return {
                    ...base,
                    appearance: next,
                    appearanceSkin: retainedSkin,
                  };
                });
                setDirty(true);
                setStatus('🎨 Updated appearance settings');
              }}
            />
            <div style={{ color:'var(--admin-muted)', marginTop:8, fontSize:12 }}>
              Tip: keep vertical alignment on <b>Top</b> so text doesn’t cover the backpack.
            </div>
          </div>

          <div style={{ ...S.card, marginTop:16 }}>
            <h3 style={{ marginTop:0 }}>Operator ↔ GPT Log</h3>
            {status && (
              <div style={{ color:'var(--admin-muted)', marginBottom:12, whiteSpace:'pre-wrap' }}>{status}</div>
            )}
            <div style={S.conversationLog}>
              {statusLog.length === 0 ? (
                <div style={{ color:'var(--admin-muted)', fontSize:12 }}>No exchanges recorded yet.</div>
              ) : (
                <div style={S.conversationLogEntries}>
                  {statusLog.slice().reverse().map((entry, idx) => (
                    <div key={`${entry.timestamp}-${idx}`} style={S.conversationLogRow}>
                      <span style={{ ...S.conversationBadge, ...(entry.speaker === 'GPT' ? S.conversationBadgeGpt : S.conversationBadgeYou) }}>
                        {entry.speaker}
                      </span>
                      <span style={S.conversationMessage}>{entry.text}</span>
                      <time style={S.conversationTime} dateTime={entry.timestamp}>
                        {formatLocalDateTime(entry.timestamp)}
                      </time>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ ...S.card, marginTop:16 }}>
            <h3 style={{ marginTop:0 }}>Repository Snapshot</h3>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
              <div>
                <div style={S.fieldLabel}>Repository</div>
                <div style={S.readonlyValue}>{metaOwnerRepo || 'unknown'}</div>
              </div>
              <div>
                <div style={S.fieldLabel}>Branch</div>
                <div style={S.readonlyValue}>{metaBranchLabel}</div>
              </div>
              <div>
                <div style={S.fieldLabel}>Commit</div>
                <div style={S.readonlyValue}>{metaCommitLabel || '—'}</div>
              </div>
              <div>
                <div style={S.fieldLabel}>Vercel Deployment</div>
                <div style={S.readonlyValue}>{metaDeploymentUrl ? metaDeploymentUrl.replace(/^https?:\/\//, '') : (metaDeploymentState || '—')}</div>
              </div>
            </div>
            <div style={{ color:'var(--admin-muted)', marginTop:12, fontSize:12 }}>
              Snapshot taken at {metaTimestampLabel || formatLocalDateTime(new Date())}.
            </div>
          </div>
          <footer style={S.settingsMetaFooter}>
            <div style={S.settingsMetaFooterRow}>
              <span><strong>Repo:</strong> {metaOwnerRepo || 'unknown'}</span>
              <span><strong>Branch:</strong> {metaBranchLabel}</span>
              <span>
                <strong>Commit:</strong>{' '}
                {metaCommitUrl ? (
                  <a href={metaCommitUrl} target="_blank" rel="noreferrer" style={S.settingsMetaFooterLink}>
                    {metaCommitShort || metaCommitLabel || '—'}
                  </a>
                ) : (
                  metaCommitShort || metaCommitLabel || '—'
                )}
              </span>
              <span>
                <strong>Deployment:</strong>{' '}
                {metaDeploymentUrl ? (
                  <a href={metaDeploymentUrl} target="_blank" rel="noreferrer" style={S.settingsMetaFooterLink}>
                    {metaDeploymentUrl.replace(/^https?:\/\//, '')}
                  </a>
                ) : (
                  metaDeploymentState || '—'
                )}
              </span>
              <span><strong>Snapshot:</strong> {metaTimestampLabel || formatLocalDateTime(new Date())}</span>
            </div>
          </footer>
      </main>
    )}

      {/* TEXT rules */}
      {tab==='text' && <TextTab config={config} setConfig={setConfig} />}

      {/* MEDIA POOL — with sub-tabs and per-file usage counts */}
      {tab==='media-pool' && (
        <MediaPoolTab
          suite={suite}
          config={config}
          setConfig={setConfig}
          uploadStatus={uploadStatus}
          setUploadStatus={setUploadStatus}
          uploadToRepo={async (file, options)=> {
            const url = await (async ()=>{ try { return await uploadToRepo(file, options); } catch { return ''; }})();
            return url;
          }}
          onInventoryRefresh={syncInventory}
        />
      )}

      {/* ASSIGNED MEDIA — renamed Media tab */}
      {tab==='assigned' && (
        <AssignedMediaPageTab
          config={config}
          setConfig={setConfig}
          onReapplyDefaults={()=>setConfig(c=> (c ? applyDefaultIcons(c) : c))}
          inventory={inventory}
          devices={devices}
          missions={suite?.missions || []}
          assignedMediaError={assignedMediaError}
          setAssignedMediaError={setAssignedMediaError}
          setStatus={setStatus}
        />
      )}

      {coverPickerOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'grid', placeItems:'center', zIndex:1600, padding:16 }}>
          <div style={{ ...S.card, width:'min(680px, 94vw)', maxHeight:'80vh', overflowY:'auto' }}>
            <h3 style={{ marginTop:0 }}>Select Cover Image</h3>
            {coverPickerLoading ? (
              <div style={{ color:'#9fb0bf' }}>Loading media…</div>
            ) : coverPickerItems.length === 0 ? (
              <div style={{ color:'#9fb0bf' }}>
                No cover-ready images found. Upload a new file or add art to the media pool.
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12 }}>
                {coverPickerItems.map((item) => (
                  <button
                    key={item.url}
                    onClick={()=>applyCoverFromUrl(item.url)}
                    style={{
                      border:'1px solid #2a323b',
                      borderRadius:12,
                      background:'#0b0c10',
                      padding:0,
                      cursor:'pointer',
                      overflow:'hidden',
                      textAlign:'left',
                    }}
                  >
                    <img
                      src={toDirectMediaURL(item.url)}
                      alt={item.name || item.url}
                      style={{ width:'100%', height:120, objectFit:'cover' }}
                    />
                    <div style={{ padding:'6px 8px', fontSize:12, color:'#9fb0bf' }}>{item.name || item.url}</div>
                  </button>
                ))}
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
              <button style={S.button} onClick={()=>setCoverPickerOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* TEST */}
      {tab==='test' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <h3 style={{ margin:0 }}>Play Test</h3>
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <label>Channel:&nbsp;
                  <select value={testChannel} onChange={(e)=>setTestChannel(e.target.value)} style={S.input}>
                    <option value="draft">draft</option>
                    <option value="published">published</option>
                  </select>
                </label>
                <button style={S.button} onClick={()=>setPreviewNonce(n=>n+1)}>Reload preview</button>
                <TestLauncher slug={activeSlugForClient} channel={testChannel} preferPretty={true} popup={false}/>
              </div>
            </div>
            {!gameBase && <div style={{ color:'var(--admin-muted)', marginBottom:8 }}>Set NEXT_PUBLIC_GAME_ORIGIN to enable preview.</div>}
            {gameBase && (
              <iframe
                key={previewNonce} // hard refresh on nonce change
                src={`${gameBase}/?${new URLSearchParams({
                  ...(activeSlugForClient ? { slug: activeSlugForClient } : {}),
                  channel: testChannel,
                  preview: '1',
                  cb: String(Date.now())
                }).toString()}`}
                style={{ width:'100%', height:'70vh', border:'1px solid var(--admin-border-soft)', borderRadius:12 }}
              />
            )}
          </div>
        </main>
      )}

      {protectionPrompt.open && (
        <div style={{ ...S.modalBackdrop, zIndex: 4200 }}>
          <div style={{ ...S.card, ...S.modalCard }}>
            <div style={S.modalTopBar}>
              <button style={S.cancelGlowButton} onClick={closeProtectionPrompt}>Cancel & Close</button>
              <div style={S.modalTitle}>
                {protectionPrompt.mode === 'enable' ? 'Enable Protection' : 'Disable Protection'}
              </div>
              <button
                style={S.modalCloseButton}
                onClick={closeProtectionPrompt}
                aria-label="Close protection dialog"
              >
                ×
              </button>
            </div>
            <form
              style={S.modalContent}
              onSubmit={(event) => {
                event.preventDefault();
                submitProtectionPrompt();
              }}
            >
              <div style={S.noteText}>
                {protectionPrompt.mode === 'enable'
                  ? 'Set a password to require authentication before anyone enters the Admin Control Deck.'
                  : 'Confirm the current password to disable the lock and return to open access.'}
              </div>
              <Field label="Password">
                <input
                  type="password"
                  style={S.input}
                  value={protectionPrompt.password}
                  onChange={(e)=>setProtectionPrompt((prev)=>({ ...prev, password: e.target.value }))}
                  placeholder="Enter password"
                  autoFocus
                />
              </Field>
              {protectionPrompt.requireConfirm && (
                <Field label="Confirm Password">
                  <input
                    type="password"
                    style={S.input}
                    value={protectionPrompt.confirm}
                    onChange={(e)=>setProtectionPrompt((prev)=>({ ...prev, confirm: e.target.value }))}
                    placeholder="Re-enter password"
                  />
                </Field>
              )}
              {protectionPrompt.error && (
                <div style={{ ...S.modalStatus, color: PROTECTION_COLOR_ALERT }}>
                  {protectionPrompt.error}
                </div>
              )}
              <div style={{ display:'flex', justifyContent:'flex-end', gap:12 }}>
                <button
                  type="submit"
                  style={{
                    ...S.button,
                    ...(protectionPrompt.mode === 'enable' ? S.buttonSuccess : S.buttonDanger),
                    minWidth: 220,
                    opacity: protectionState.saving ? 0.7 : 1,
                    cursor: protectionState.saving ? 'wait' : 'pointer',
                  }}
                  disabled={protectionState.saving}
                >
                  {protectionState.saving
                    ? 'Saving…'
                    : (protectionPrompt.mode === 'enable' ? 'Enable Protection' : 'Disable Protection')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Game modal */}
      {showNewGame && (
        <div style={S.modalBackdrop}>
          <div style={{ ...S.card, ...S.modalCard }}>
            <div style={S.modalTopBar}>
              <button style={S.cancelGlowButton} onClick={handleNewGameModalClose}>Cancel & Close</button>
              <div style={S.modalTitleStack}>
                <div style={S.modalTitle}>Create New Game</div>
                {!deployGameEnabled && (
                  <div style={S.modalPublishWarning}>
                    <span aria-hidden="true" style={S.modalPublishLight} />
                    <span>Turn on Publishing to create a game</span>
                  </div>
                )}
              </div>
              <button style={S.modalCloseButton} onClick={handleNewGameModalClose} aria-label="Close new game dialog">×</button>
            </div>
            <div style={S.modalContent}>
              {!gameEnabled && (
                <div style={S.modalStatusError}>
                  Game project publishing is currently disabled. Enable it in settings before creating a new game.
                </div>
              )}
              <Field label="Game Title">
                <input
                  style={S.input}
                  value={newTitle}
                  onChange={(e)=>setNewTitle(e.target.value)}
                  placeholder="Starship Escape"
                />
                <div style={S.noteText}>This name appears wherever the game is listed.</div>
              </Field>
              <Field label="Slug (folder name)">
                <input
                  style={S.input}
                  value={newGameSlug}
                  onChange={(e)=>handleNewSlugInput(e.target.value)}
                  placeholder="starship-escape"
                />
                <div style={S.noteText}>Stored at <code>/public/games/[slug]</code> alongside missions and config.</div>
              </Field>
              <Field label="Game Type">
                <select style={S.input} value={newType} onChange={(e)=>setNewType(e.target.value)}>
                  {GAME_TYPES.map((t)=>(<option key={t} value={t}>{t}</option>))}
                </select>
                <div style={S.noteText}>Select a template for default mission pacing.</div>
              </Field>
              <Field label="Mode">
                <select style={S.input} value={newMode} onChange={(e)=>setNewMode(e.target.value)}>
                  <option value="single">Single Player</option>
                  <option value="head2head">Head to Head (2)</option>
                  <option value="multi">Multiple (4)</option>
                </select>
                <div style={S.noteText}>Defines how many players join each session.</div>
              </Field>
              <Field label="Duration (minutes — 0 = infinite)">
                <input
                  type="number"
                  min={0}
                  max={24*60}
                  style={S.input}
                  value={newDurationMin}
                  onChange={(e)=>setNewDurationMin(Math.max(0, Number(e.target.value||0)))}
                />
                <div style={S.noteText}>Players see this countdown during the mission.</div>
              </Field>
              <Field label="Alert before end (minutes)">
                <input
                  type="number"
                  min={1}
                  max={120}
                  style={S.input}
                  value={newAlertMin}
                  onChange={(e)=>setNewAlertMin(Math.max(1, Number(e.target.value||1)))}
                />
                <div style={S.noteText}>Send a warning before time is up.</div>
              </Field>
              <Field label="Short Description">
                <textarea
                  style={{ ...S.input, minHeight: 80 }}
                  value={newShortDesc}
                  onChange={(e)=>setNewShortDesc(e.target.value)}
                  placeholder="One-sentence teaser for listings"
                />
                <div style={S.noteText}>Great for cards, previews, and quick share links.</div>
              </Field>
              <Field label="Long Description">
                <textarea
                  style={{ ...S.input, minHeight: 140 }}
                  value={newLongDesc}
                  onChange={(e)=>setNewLongDesc(e.target.value)}
                  placeholder="Give players the full briefing for this escape ride"
                />
                <div style={S.noteText}>Appears on marketing pages and internal docs.</div>
              </Field>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize:12, color:'var(--admin-muted)', marginBottom:6 }}>Cover Image</div>
                <div
                  onDragOver={(e)=>{ e.preventDefault(); setNewCoverDropActive(true); }}
                  onDragLeave={(e)=>{ e.preventDefault(); setNewCoverDropActive(false); }}
                  onDrop={(e)=>{
                    e.preventDefault();
                    setNewCoverDropActive(false);
                    const file = e.dataTransfer?.files?.[0];
                    if (file) handleNewGameCoverFile(file);
                  }}
                  style={{ ...S.coverDropZone, ...(newCoverDropActive ? S.coverDropZoneActive : {}) }}
                >
                  {newCoverPreview ? (
                    <img src={newCoverPreview} alt="New game cover" style={S.coverDropImage} />
                  ) : (
                    <div style={S.coverDropPlaceholder}>
                      <strong>Drag & drop cover art</strong>
                      <span>PNG or JPG · under 5 MB · shows beside the admin header</span>
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
                  <button type="button" style={S.button} onClick={()=>newGameCoverInputRef.current?.click()}>Upload cover</button>
                  <input
                    ref={newGameCoverInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display:'none' }}
                    onChange={(e)=>{
                      const file = e.target.files?.[0];
                      if (file) handleNewGameCoverFile(file);
                      if (e.target) e.target.value = '';
                    }}
                  />
                  <button type="button" style={S.button} onClick={loadNewCoverOptions} disabled={newCoverLookupLoading}>
                    {newCoverLookupLoading ? 'Loading…' : 'Import from Media Pool'}
                  </button>
                  <button
                    type="button"
                    style={{ ...S.button, ...S.buttonDanger }}
                    onClick={clearNewGameCover}
                    disabled={!newCoverPreview && !newCoverSelectedUrl}
                  >
                    Clear cover
                  </button>
                </div>
                <div style={S.noteText}>Upload new artwork or reuse an existing asset.</div>
                {newCoverOptions.length > 0 && (
                  <div style={S.modalCoverGrid}>
                    {newCoverOptions.map((item) => (
                      <button
                        key={item.url}
                        type="button"
                        onClick={()=>applyNewCoverFromUrl(item.url)}
                        style={{
                          ...S.modalCoverButton,
                          ...(newCoverSelectedUrl === item.url ? S.modalCoverButtonActive : {}),
                        }}
                      >
                        <img src={toDirectMediaURL(item.url)} alt={item.name || item.url} style={S.modalCoverThumb} />
                        <div style={S.modalCoverLabel}>{item.name || item.url}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {newGameStatus && <div style={S.modalStatus}>{newGameStatus}</div>}
              <div style={{ display:'flex', justifyContent:'flex-end', gap:12, flexWrap:'wrap' }}>
                <button
                  style={{
                    ...S.action3DButton,
                    ...(newGameBusy ? { opacity:0.7, cursor:'wait' } : {}),
                    ...(!deployGameEnabled ? { opacity:0.55, cursor:'not-allowed' } : {}),
                  }}
                  onClick={handleCreateNewGame}
                  disabled={newGameBusy || !deployGameEnabled}
                >
                  {newGameBusy ? 'Creating…' : 'Save New Game'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {gameEnabled && confirmDeleteOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'grid', placeItems:'center', zIndex:3000 }}>
          <div style={{ ...S.card, width:420 }}>
            <h3 style={{ marginTop:0 }}>Delete Game</h3>
            <div style={{ color:'var(--admin-body-color)', marginBottom:12 }}>
              Are you sure you want to delete <b>{config?.game?.title || (activeSlug || 'this game')}</b>?
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button style={S.button} onClick={()=>setConfirmDeleteOpen(false)}>Cancel</button>
              <button
                style={{ ...S.button, ...S.buttonDanger }}
                onClick={reallyDeleteGame}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Sub-tabs & Components ───────────────────────── */
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--admin-muted)', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
function MultipleChoiceEditor({ value, correctIndex, onChange }) {
  const [local, setLocal] = useState(Array.isArray(value) ? value.slice(0, 5) : []);
  const [correct, setCorrect] = useState(Number.isInteger(correctIndex) ? correctIndex : undefined);
  useEffect(()=>{ setLocal(Array.isArray(value)?value.slice(0,5):[]); },[value]);
  useEffect(()=>{ setCorrect(Number.isInteger(correctIndex)?correctIndex:undefined); },[correctIndex]);
  function sync(nextChoices, nextCorrect) {
    const trimmed = nextChoices.map(s=>(s || '').trim()).filter(Boolean).slice(0,5);
    const ci = Number.isInteger(nextCorrect) && nextCorrect < trimmed.length ? nextCorrect : undefined;
    onChange({ choices: trimmed, correctIndex: ci });
  }
  return (
    <div style={{ border:'1px solid var(--admin-border-soft)', borderRadius:10, padding:12 }}>
      <div style={{ fontWeight:600, marginBottom:8 }}>Choices (A–E)</div>
      {[0,1,2,3,4].map((i)=>(
        <div key={i} style={{ display:'grid', gridTemplateColumns:'24px 1fr', alignItems:'center', gap:8, marginBottom:8 }}>
          <input type="radio" name="mcq-correct" checked={correct===i} onChange={()=>{ setCorrect(i); sync(local,i); }} title="Mark as correct"/>
          <input placeholder={`Choice ${String.fromCharCode(65+i)}`} style={S.input} value={local[i]||''}
            onChange={(e)=>{ const next=[...local]; next[i]=e.target.value; setLocal(next); sync(next, correct); }}/>
        </div>
      ))}
      <div style={{ color:'var(--admin-muted)', fontSize:12 }}>Leave blanks for unused options. Exactly one radio can be marked correct.</div>
    </div>
  );
}
function MediaPreview({ url, kind }) {
  if (!url) return null;
  const u = toDirectMediaURL(String(url).trim());
  const lower = u.toLowerCase();
  const isVideo = /\.(mp4|webm|mov)(\?|#|$)/.test(lower);
  const isImage = /\.(png|jpg|jpeg|gif|webp)(\?|#|$)/.test(lower) || u.includes('drive.google.com/uc?export=view');
  const isAudio = /\.(mp3|wav|ogg|m4a|aiff|aif)(\?|#|$)/.test(lower);
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ color:'var(--admin-muted)', fontSize:12, marginBottom:6 }}>Preview ({kind})</div>
      {isVideo ? (
        <video src={u} controls style={{ width:'100%', maxHeight:260, borderRadius:10, border:'1px solid var(--admin-border-soft)' }}/>
      ) : isImage ? (
        <img src={u} alt="preview" style={{ width:'100%', maxHeight:260, objectFit:'contain', borderRadius:10, border:'1px solid var(--admin-border-soft)' }}/>
      ) : isAudio ? (
        <audio src={u} controls style={{ width:'100%' }} />
      ) : (
        <a href={u} target="_blank" rel="noreferrer" style={{ color:'var(--admin-muted)', textDecoration:'underline' }}>Open media</a>
      )}
    </div>
  );
}

/* Styles */
const S = {
  body: {
    background: 'transparent',
    color: 'var(--appearance-font-color, var(--admin-body-color))',
    minHeight: '100vh',
    fontFamily: 'var(--appearance-font-family, var(--admin-font-family))',
  },
  metaBanner: {
    background: 'rgba(7, 12, 18, 0.82)',
    backdropFilter: 'blur(14px)',
    color: 'var(--appearance-font-color, var(--admin-body-color))',
    borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
    padding: '8px 16px',
    boxShadow: '0 18px 36px rgba(2, 6, 12, 0.45)',
  },
  metaBannerLine: {
    maxWidth: 1400,
    margin: '0 auto',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaCommitBlock: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaCommitLink: {
    color: 'var(--admin-link-color, #60a5fa)',
    textDecoration: 'none',
    fontWeight: 600,
  },
  metaCommitCode: {
    fontFamily: 'monospace',
    fontSize: 11,
    background: 'rgba(148, 163, 184, 0.12)',
    color: 'var(--appearance-font-color, var(--admin-body-color))',
    padding: '2px 6px',
    borderRadius: 6,
    lineHeight: 1.4,
    wordBreak: 'break-all',
  },
  metaBadge: {
    padding: '2px 8px',
    borderRadius: 999,
    background: 'rgba(59, 130, 246, 0.16)',
    color: '#9cc0ff',
    fontSize: 12,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  metaMuted: {
    color: 'var(--admin-muted)',
    fontSize: 12,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  metaLink: {
    color: 'var(--admin-link-color, #60a5fa)',
    textDecoration: 'none',
    fontWeight: 600,
  },
  metaBannerError: {
    color: '#f87171',
    fontWeight: 600,
  },
  header: {
    padding: 20,
    background: 'rgba(248, 250, 252, 0.72)',
    backdropFilter: 'blur(18px)',
    borderBottom: '1px solid rgba(148, 163, 184, 0.28)',
    position: 'sticky',
    top: 0,
    zIndex: 40,
    boxShadow: '0 18px 30px rgba(15, 23, 42, 0.18)',
    color: 'var(--admin-body-color)',
  },
  conversationLog: {
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    border: '1px solid rgba(148, 163, 184, 0.25)',
    background: 'rgba(241, 245, 249, 0.78)',
    boxShadow: '0 14px 28px rgba(15, 23, 42, 0.12)',
  },
  conversationLogHeading: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    color: '#334155',
    fontWeight: 700,
    marginBottom: 10,
  },
  conversationLogEntries: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 200,
    overflowY: 'auto',
  },
  conversationLogRow: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    gap: 12,
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: 10,
    background: 'rgba(255, 255, 255, 0.72)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
  },
  conversationBadge: {
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    padding: '3px 10px',
    borderRadius: 999,
    background: 'rgba(51, 65, 85, 0.08)',
    color: '#0f172a',
    fontWeight: 700,
  },
  conversationBadgeGpt: {
    background: 'rgba(59, 130, 246, 0.16)',
    color: '#1d4ed8',
  },
  conversationBadgeYou: {
    background: 'rgba(16, 185, 129, 0.16)',
    color: '#047857',
  },
  conversationMessage: {
    color: '#1e293b',
    fontSize: 14,
    lineHeight: 1.4,
  },
  conversationTime: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  wrap: { maxWidth: 1400, margin: '0 auto', padding: 16 },
  wrapGrid2: { display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, alignItems: 'start', maxWidth: 1400, margin: '0 auto', padding: 16 },
  sidebarTall: {
    background: 'var(--appearance-panel-bg, var(--admin-panel-bg))',
    border: 'var(--appearance-panel-border, var(--admin-panel-border))',
    borderRadius: 18,
    padding: 14,
    position: 'sticky',
    top: 20,
    height: 'calc(100vh - 140px)',
    overflow: 'auto',
    boxShadow: 'var(--appearance-panel-shadow, var(--admin-panel-shadow))',
  },
  sidebarBar: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 12,
    marginBottom: 12,
    borderRadius: 14,
    border: '1px solid var(--admin-border-soft)',
    background: 'var(--appearance-panel-bg, var(--admin-panel-bg))',
    boxShadow: '0 12px 24px rgba(8, 13, 19, 0.35)',
  },
  card: {
    position: 'relative',
    background: 'var(--appearance-panel-bg, var(--admin-panel-bg))',
    border: 'var(--appearance-panel-border, var(--admin-panel-border))',
    borderRadius: 18,
    padding: 18,
    boxShadow: 'var(--appearance-panel-shadow, var(--admin-panel-shadow))',
  },
  settingsMetaFooter: {
    marginTop: 16,
    padding: '14px 18px',
    borderRadius: 14,
    border: '1px solid var(--admin-border-soft)',
    background: 'var(--appearance-panel-bg, var(--admin-panel-bg))',
    boxShadow: 'var(--appearance-panel-shadow, var(--admin-panel-shadow))',
    color: 'var(--admin-muted)',
    fontSize: 12,
  },
  settingsMetaFooterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'center',
  },
  settingsMetaFooterLink: {
    color: 'var(--admin-link-color, #60a5fa)',
    textDecoration: 'none',
    fontWeight: 600,
  },
  inlineCode: {
    fontFamily: 'monospace',
    background: 'rgba(148, 163, 184, 0.16)',
    color: 'var(--appearance-font-color, var(--admin-body-color))',
    padding: '2px 6px',
    borderRadius: 6,
  },
  floatingBarTop: {
    position: 'sticky',
    top: 0,
    zIndex: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
    padding: '12px 0',
    background: 'var(--appearance-panel-bg, var(--admin-panel-bg))',
    borderBottom: '1px solid var(--admin-border-soft)',
  },
  floatingBarBottom: {
    position: 'sticky',
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '12px 0',
    marginTop: 18,
    background: 'var(--appearance-panel-bg, var(--admin-panel-bg))',
    borderTop: '1px solid var(--admin-border-soft)',
  },
  missionItem: { borderBottom: '1px solid var(--admin-border-soft)', padding: '10px 4px' },
  noteText: { marginTop: 6, fontSize: 12, color: 'var(--admin-muted)' },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 12,
    border: 'var(--admin-input-border)',
    background: 'var(--admin-input-bg)',
    color: 'var(--admin-input-color)',
    boxShadow: 'var(--admin-glass-sheen)',
  },
  button: {
    padding: '10px 14px',
    borderRadius: 12,
    border: 'var(--admin-button-border)',
    background: 'var(--admin-button-bg)',
    color: 'var(--admin-button-color)',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'background 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease',
    boxShadow: 'var(--admin-glass-sheen)',
  },
  buttonDanger: {
    border: 'var(--admin-danger-border)',
    background: 'var(--admin-danger-bg)',
    color: 'var(--admin-body-color)',
  },
  buttonSuccess: {
    border: 'var(--admin-success-border)',
    background: 'var(--admin-success-bg)',
    color: 'var(--admin-body-color)',
  },
  floatingButton: {
    padding: '10px 18px',
    borderRadius: 14,
    border: '1px solid var(--admin-button-border)',
    background: 'var(--admin-button-bg)',
    color: 'var(--admin-button-color)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    minWidth: 160,
    letterSpacing: 0.5,
    boxShadow: 'var(--admin-glass-sheen)',
    transition: 'background 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease',
  },
  floatingSave: {
    background: 'linear-gradient(92deg, #1f7a32, #2dd36f)',
    border: '1px solid rgba(56, 161, 105, 0.8)',
    color: '#e9ffe9',
    boxShadow: '0 0 18px rgba(56, 161, 105, 0.55)',
  },
  floatingCancel: {
    background: 'linear-gradient(92deg, #7a2d00, #ff8800)',
    border: '1px solid rgba(255, 136, 0, 0.8)',
    color: '#fff4dd',
    boxShadow: '0 0 18px rgba(255, 136, 0, 0.55)',
  },
  action3DButton: {
    padding: '12px 20px',
    borderRadius: 16,
    border: '1px solid rgba(34, 197, 94, 0.85)',
    background: 'linear-gradient(165deg, #0b4224, #22c55e)',
    color: '#ecfdf5',
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    boxShadow: '0 18px 28px rgba(12, 83, 33, 0.6), inset 0 2px 0 rgba(255, 255, 255, 0.15)',
    cursor: 'pointer',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  },
  action3DFlash: {
    boxShadow: '0 0 28px rgba(34, 197, 94, 0.75), 0 22px 34px rgba(12, 83, 33, 0.55)',
    transform: 'translateY(-2px)',
  },
  cancelGlowButton: {
    padding: '10px 18px',
    borderRadius: 999,
    border: '1px solid rgba(248, 113, 113, 0.6)',
    background: 'linear-gradient(140deg, #4c0519, #f87171)',
    color: '#ffe4e6',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    boxShadow: '0 0 22px rgba(248, 113, 113, 0.55)',
    cursor: 'pointer',
  },
  overlayUpdateButton: {
    padding: '10px 18px',
    borderRadius: 999,
    border: '1px solid rgba(59, 130, 246, 0.6)',
    background: 'linear-gradient(135deg, #1d4ed8, #38bdf8)',
    color: '#e0f2fe',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    boxShadow: '0 0 20px rgba(59, 130, 246, 0.45)',
    cursor: 'pointer',
    width: '100%',
  },
  deviceMapFooter: {
    marginTop: 12,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    flexWrap: 'wrap',
  },
  saveCoverButton: {
    background: 'linear-gradient(92deg, #047857, #34d399)',
    border: '1px solid rgba(52, 211, 153, 0.6)',
    color: '#ecfdf5',
    boxShadow: '0 16px 28px rgba(5, 150, 105, 0.35)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontWeight: 700,
  },
  savePublishButton: {
    background: 'linear-gradient(95deg, #2563eb, #38bdf8)',
    border: '1px solid rgba(59, 130, 246, 0.6)',
    color: '#f8fafc',
    boxShadow: '0 20px 36px rgba(37, 99, 235, 0.45)',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontWeight: 800,
    padding: '12px 20px',
  },
  headerNewGameButton: {
    background: 'linear-gradient(100deg, #7c3aed, #a855f7)',
    border: '1px solid rgba(168, 85, 247, 0.65)',
    color: '#fdf4ff',
    boxShadow: '0 18px 32px rgba(124, 58, 237, 0.35)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontWeight: 700,
    padding: '10px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  newGameLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  headerNewGameLight: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#ef4444',
    boxShadow: '0 0 12px rgba(239, 68, 68, 0.65)',
  },
  headerTopRow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 6,
    marginBottom: 20,
  },
  headerTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  headerCoverFrame: {
    width: 68,
    height: 68,
    borderRadius: 16,
    overflow: 'hidden',
    border: '1px solid rgba(148, 163, 184, 0.4)',
    background: 'rgba(15, 23, 42, 0.7)',
    display: 'grid',
    placeItems: 'center',
    boxShadow: '0 18px 32px rgba(2, 6, 12, 0.55)',
  },
  headerCoverThumb: { width: '100%', height: '100%', objectFit: 'cover' },
  headerCoverPlaceholder: {
    fontSize: 11,
    color: 'var(--admin-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    textAlign: 'center',
    padding: '0 6px',
  },
  headerTitleColumn: {
    display: 'grid',
    justifyItems: 'flex-start',
    textAlign: 'left',
    gap: 4,
  },
  headerGameTitle: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    fontSize: 13,
    letterSpacing: '0.3em',
    textTransform: 'uppercase',
    color: 'var(--admin-muted)',
  },
  headerNavRow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  headerNavPrimary: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerNavSecondary: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  gameTitleRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 16,
    alignItems: 'stretch',
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    color: 'var(--admin-muted)',
  },
  readonlyField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '12px 16px',
    borderRadius: 14,
    border: '1px solid var(--admin-border-soft)',
    background: 'var(--admin-input-bg)',
    boxShadow: 'var(--admin-glass-sheen)',
  },
  readonlyValue: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '0.06em',
    wordBreak: 'break-word',
  },
  readonlyCode: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid var(--admin-border-soft)',
    background: 'var(--admin-tab-bg)',
    fontWeight: 600,
    letterSpacing: '0.08em',
  },
  coverControlsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 18,
    alignItems: 'stretch',
  },
  coverDropZone: {
    flex: '1 1 380px',
    minHeight: 280,
    border: '1px dashed rgba(94, 234, 212, 0.35)',
    borderRadius: 20,
    background: 'rgba(15, 23, 42, 0.75)',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    transition: 'border 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
  },
  coverDropZoneActive: {
    border: '1px dashed rgba(94, 234, 212, 0.8)',
    boxShadow: '0 0 24px rgba(94, 234, 212, 0.35)',
    background: 'rgba(15, 32, 27, 0.85)',
  },
  coverDropImage: { width: '50%', height: '50%', objectFit: 'cover', borderRadius: 16, boxShadow: '0 12px 32px rgba(15, 23, 42, 0.35)' },
  coverDropPlaceholder: {
    color: '#9fb0bf',
    fontSize: 13,
    textAlign: 'center',
    display: 'grid',
    gap: 6,
    padding: 16,
    justifyItems: 'center',
    letterSpacing: '0.05em',
  },
  coverActionsColumn: {
    flex: '0 0 240px',
    minWidth: 220,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  coverActionButtons: {
    display: 'grid',
    gap: 10,
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  },
  coverActionStatus: {
    fontSize: 12,
    color: 'var(--admin-muted)',
  },
  coverActionHint: {
    fontSize: 12,
    color: 'var(--admin-muted)',
  },
  mediaDropZone: {
    marginTop: 12,
    padding: '14px 18px',
    borderRadius: 16,
    border: '1px dashed rgba(148, 163, 184, 0.4)',
    background: 'rgba(226, 232, 240, 0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    transition: 'border 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
  },
  mediaDropZoneActive: {
    border: '1px dashed rgba(59, 130, 246, 0.65)',
    background: 'rgba(191, 219, 254, 0.72)',
    boxShadow: '0 16px 32px rgba(59, 130, 246, 0.25)',
  },
  mediaDropHeadline: {
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#1e293b',
    fontSize: 13,
  },
  mediaDropHint: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
  },
  mediaDropBrowse: {
    padding: '10px 16px',
    borderRadius: 12,
    border: '1px solid rgba(14, 165, 233, 0.6)',
    background: 'linear-gradient(96deg, #0ea5e9, #38bdf8)',
    color: '#f8fafc',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(14, 165, 233, 0.35)',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  },
  tab: {
    padding: '8px 12px',
    borderRadius: 12,
    border: 'var(--admin-button-border)',
    background: 'var(--admin-tab-bg)',
    color: 'var(--admin-body-color)',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  },
  tabActive: { background: 'var(--admin-tab-active-bg)', boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' },
  search: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 12,
    border: 'var(--admin-input-border)',
    background: 'var(--admin-input-bg)',
    color: 'var(--admin-input-color)',
    marginBottom: 10,
    boxShadow: 'var(--admin-glass-sheen)',
  },
  hr: { border: '1px solid var(--admin-border-soft)', borderBottom: 'none', margin: '12px 0' },
  overlay: { position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.55)', zIndex: 2000, padding: 16 },
  overlayBarSide: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    minWidth: 180,
  },
  overlayActionStack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
    width: '100%',
  },
  overlayCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    textAlign: 'center',
  },
  overlayIdRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  overlayIdLabel: {
    fontSize: 12,
    color: 'var(--admin-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  overlayIdValue: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--admin-body-color)',
    background: 'var(--admin-tab-bg)',
    padding: '4px 12px',
    borderRadius: 999,
  },
  missionQuickRow: {
    display: 'grid',
    gridTemplateColumns: '64px 1fr 1fr 1fr',
    gap: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  missionIconPreview: {
    width: 56,
    height: 56,
    borderRadius: 10,
    border: '1px solid var(--admin-border-soft)',
    background: 'var(--admin-tab-bg)',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
  },
  missionIconPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'grid',
    placeItems: 'center',
    fontSize: 12,
    color: 'var(--admin-muted)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  chip: { fontSize: 11, color: 'var(--admin-muted)', border: 'var(--admin-chip-border)', padding: '2px 6px', borderRadius: 999, background: 'var(--admin-chip-bg)' },
  muted: { color: 'var(--admin-muted)' },
  errorPanel: {
    border: '1px solid var(--admin-border-soft)',
    borderRadius: 14,
    padding: 16,
    background: 'var(--appearance-panel-bg, var(--admin-panel-bg))',
    boxShadow: 'var(--appearance-panel-shadow, var(--admin-panel-shadow))',
    color: 'var(--appearance-font-color, var(--admin-body-color))',
    display: 'grid',
    gap: 10,
  },
  errorPanelTitle: { fontWeight: 700, fontSize: 16 },
  errorPanelMessage: { fontSize: 13, color: 'var(--admin-muted)', whiteSpace: 'pre-wrap' },
  errorPanelActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  subtleActionButton: {
    padding: '4px 12px',
    borderRadius: 999,
    border: '1px solid var(--admin-border-soft)',
    background: 'var(--admin-tab-bg)',
    color: 'var(--admin-muted)',
    cursor: 'pointer',
    fontSize: 12,
    boxShadow: 'var(--admin-glass-sheen)',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(5, 12, 20, 0.82)',
    backdropFilter: 'blur(14px)',
    display: 'grid',
    placeItems: 'center',
    padding: 24,
    zIndex: 4000,
  },
  modalCard: {
    width: 'min(720px, 96vw)',
    maxHeight: '82vh',
    padding: 0,
    overflow: 'hidden',
  },
  modalTopBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '16px 20px',
    borderBottom: '1px solid var(--admin-border-soft)',
    background: 'var(--appearance-panel-bg, var(--admin-panel-bg))',
    position: 'sticky',
    top: 0,
    zIndex: 5,
  },
  modalTitleStack: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  modalTitle: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  modalPublishWarning: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: '#ef4444',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  modalPublishLight: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: '#ef4444',
    boxShadow: '0 0 16px rgba(239, 68, 68, 0.45)',
  },
  modalCloseButton: {
    border: 'none',
    background: 'transparent',
    color: 'var(--admin-muted)',
    fontSize: 28,
    lineHeight: 1,
    cursor: 'pointer',
    padding: 4,
  },
  modalContent: {
    padding: '20px 24px 24px',
    display: 'grid',
    gap: 16,
    maxHeight: 'calc(82vh - 72px)',
    overflowY: 'auto',
  },
  modalCoverGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
    marginTop: 12,
  },
  modalCoverButton: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    border: '1px solid var(--admin-border-soft)',
    borderRadius: 14,
    padding: 12,
    background: 'var(--admin-tab-bg)',
    color: 'var(--admin-body-color)',
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border 0.2s ease',
  },
  modalCoverButtonActive: {
    border: '1px solid rgba(59, 130, 246, 0.85)',
    boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.35)',
  },
  modalCoverThumb: {
    width: '100%',
    height: 120,
    objectFit: 'cover',
    borderRadius: 10,
    background: '#0f172a',
  },
  modalCoverLabel: {
    fontSize: 12,
    color: 'var(--admin-muted)',
    textAlign: 'left',
    wordBreak: 'break-word',
  },
  modalStatus: {
    fontSize: 13,
    color: 'var(--admin-muted)',
    minHeight: 20,
  },
  modalStatusError: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: 600,
  },
};

/* MapOverview — shows missions + devices */
function MapOverview({
  missions = [], devices = [], icons = DEFAULT_ICONS, showRings = true,
  interactive = false, draftDevice = null,
  selectedDevIdx = null, selectedMissionIdx = null,
  onDraftChange = null, onMoveSelected = null, onMoveSelectedMission = null,
  onSelectDevice = null, onSelectMission = null,
  mapCenter = { lat:44.9778, lng:-93.2650 }, mapZoom = 13,
  defaultIconSizePx = 24, selectedIconSizePx = 28,
  readOnly = false,
  lockToRegion = false,
}) {
  const divRef = React.useRef(null);
  const [leafletReady, setLeafletReady] = React.useState(!!(typeof window !== 'undefined' && window.L));

  function getMissionPos(m){ const c=m?.content||{}; const lat=Number(c.lat), lng=Number(c.lng); if(!isFinite(lat)||!isFinite(lng))return null; return [lat,lng]; }
  function getDevicePos(d){ const lat=Number(d?.lat),lng=Number(d?.lng); if(!isFinite(lat)||!isFinite(lng))return null; return [lat,lng]; }
  function iconUrl(kind,key){ if(!key)return''; const list=icons?.[kind]||[]; const it=list.find(x=>x.key===key); return it?toDirectMediaURL(it.url||''):''; }
  function numberedIcon(number, imgUrl, color='#60a5fa', highlight=false, size=24){
    const s = Math.max(12, Math.min(64, Number(size)||24));
    const img = imgUrl
      ? `<img src="${imgUrl}" style="width:${s}px;height:${s}px;border-radius:50%;object-fit:cover;border:2px solid ${highlight?'#22c55e':'white'};box-shadow:0 0 0 2px #1f2937"/>`
      : `<div style="width:${s-4}px;height:${s-4}px;border-radius:50%;background:${color};border:2px solid ${highlight?'#22c55e':'white'};box-shadow:0 0 0 2px #1f2937"></div>`;
    const font = Math.round(s*0.5);
    return window.L.divIcon({
      className:'num-pin',
      html:`<div style="position:relative;display:grid;place-items:center">${img}<div style="position:absolute;bottom:-${Math.round(s*0.45)}px;left:50%;transform:translateX(-50%);font-weight:700;font-size:${font}px;color:#fff;text-shadow:0 1px 2px #000">${number}</div></div>`,
      iconSize:[s, s+4], iconAnchor:[s/2, s/2]
    });
  }

  useEffect(()=>{ if(typeof window==='undefined')return;
    if(window.L){ setLeafletReady(true); return; }
    const linkId='leaflet-css';
    if(!document.getElementById(linkId)){
      const link=document.createElement('link'); link.id=linkId; link.rel='stylesheet'; link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link);
    }
    const s=document.createElement('script'); s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.async=true; s.onload=()=>setLeafletReady(true); document.body.appendChild(s);
  },[]);

  useEffect(()=>{
    if(!leafletReady || !divRef.current || typeof window==='undefined') return;
    const L = window.L; if (!L) return;

    const initialCenter = [mapCenter?.lat ?? 44.9778, mapCenter?.lng ?? -93.2650];
    const initialZoom = mapZoom ?? 13;

    if(!divRef.current._leaflet_map){
      const map=L.map(divRef.current,{ center:initialCenter, zoom:initialZoom });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{ maxZoom:19, attribution:'© OpenStreetMap contributors' }).addTo(map);
      divRef.current._leaflet_map=map;
    }
    const map=divRef.current._leaflet_map;

    if(!map._layerGroup) map._layerGroup=L.layerGroup().addTo(map);
    map._layerGroup.clearLayers();
    const layer=map._layerGroup;
    const bounds=L.latLngBounds([]);

    // Missions
    (missions||[]).forEach((m,idx)=>{
      const pos=getMissionPos(m); if(!pos) return;
      const url = m.iconUrl ? toDirectMediaURL(m.iconUrl) : iconUrl('missions', m.iconKey);
      const isSel = (selectedMissionIdx===idx);
      const size = isSel ? selectedIconSizePx : defaultIconSizePx;
      const marker=L.marker(pos,{icon:numberedIcon(idx+1,url,'#60a5fa',isSel,size), draggable:(!readOnly && isSel)}).addTo(layer);
      const rad=Number(m.content?.radiusMeters||0);
      let circle=null;
      if(showRings && rad>0) { circle=L.circle(pos,{ radius:rad, color:'#60a5fa', fillOpacity:0.08 }).addTo(layer); }
      if (onSelectMission) {
        marker.on('click',(ev)=>{ ev.originalEvent?.preventDefault?.(); ev.originalEvent?.stopPropagation?.(); onSelectMission(idx); });
      }
      if(!readOnly && isSel && onMoveSelectedMission){
        marker.on('drag',()=>{ if(circle) circle.setLatLng(marker.getLatLng()); });
        marker.on('dragend',()=>{ const p=marker.getLatLng(); onMoveSelectedMission(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))); });
      }
      bounds.extend(pos);
    });

    // Devices
    (devices||[]).forEach((d,idx)=>{
      const pos=getDevicePos(d); if(!pos) return;
      const url=iconUrl('devices', d.iconKey);
      const hl = (selectedDevIdx===idx);
      const size = hl ? selectedIconSizePx : defaultIconSizePx;
      const marker=L.marker(pos,{icon:numberedIcon(`D${idx+1}`,url,'#f59e0b',hl,size), draggable:(!readOnly && hl && !!onMoveSelected)}).addTo(layer);
      const rad=Number(d.pickupRadius||0);
      let circle=null;
      if(showRings && rad>0) { circle=L.circle(pos,{ radius:rad, color:'#f59e0b', fillOpacity:0.08 }).addTo(layer); }
      if (onSelectDevice) {
        marker.on('click',(ev)=>{ ev.originalEvent?.preventDefault?.(); ev.originalEvent?.stopPropagation?.(); onSelectDevice(idx); });
      }
      if(!readOnly && hl && onMoveSelected){
        marker.on('drag',()=>{ if(circle) circle.setLatLng(marker.getLatLng()); });
        marker.on('dragend',()=>{ const p=marker.getLatLng(); onMoveSelected(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))); });
      }
      bounds.extend(pos);
    });

    // Draft device (Devices tab)
    if(!readOnly && draftDevice && typeof draftDevice.lat==='number' && typeof draftDevice.lng==='number'){
      const pos=[draftDevice.lat, draftDevice.lng];
      const mk=L.marker(pos,{ icon:numberedIcon('D+','', '#34d399',true,selectedIconSizePx), draggable:true }).addTo(layer);
      if(showRings && Number(draftDevice.radius)>0){
        const c=L.circle(pos,{ radius:Number(draftDevice.radius), color:'#34d399', fillOpacity:0.08 }).addTo(layer);
        mk.on('drag',()=>c.setLatLng(mk.getLatLng()));
      }
      mk.on('dragend',()=>{ const p=mk.getLatLng(); onDraftChange && onDraftChange(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))); });
      bounds.extend(pos);
    }

    // Click handler
    if (map._clickHandler) map.off('click', map._clickHandler);
    map._clickHandler = (e) => {
      if (readOnly) return;
      const lat=e.latlng.lat, lng=e.latlng.lng;
      if (interactive && onDraftChange) { onDraftChange(Number(lat.toFixed(6)), Number(lng.toFixed(6))); return; }
      if (selectedDevIdx!=null && onMoveSelected) { onMoveSelected(Number(lat.toFixed(6)), Number(lng.toFixed(6))); return; }
      if (selectedMissionIdx!=null && onMoveSelectedMission) { onMoveSelectedMission(Number(lat.toFixed(6)), Number(lng.toFixed(6))); return; }
    };
    map.on('click', map._clickHandler);

    if (lockToRegion) {
      map.setView(initialCenter, initialZoom);
    } else if(bounds.isValid()) {
      map.fitBounds(bounds.pad(0.2));
    } else {
      map.setView(initialCenter, initialZoom);
    }
  },[
    leafletReady, missions, devices, icons, showRings, interactive, draftDevice,
    selectedDevIdx, selectedMissionIdx, onDraftChange, onMoveSelected, onMoveSelectedMission,
    onSelectDevice, onSelectMission, mapCenter, mapZoom, defaultIconSizePx, selectedIconSizePx, readOnly, lockToRegion
  ]);

  return (
    <div>
      {!leafletReady && <div style={{ color:'var(--admin-muted)', marginBottom:8 }}>Loading map…</div>}
      <div ref={divRef} style={{ height:560, borderRadius:12, border:'1px solid var(--admin-border-soft)', background:'var(--appearance-panel-bg, var(--admin-panel-bg))' }}/>
    </div>
  );
}

/* MapPicker — geofence mini map with draggable marker + radius slider (5–500 m) */
function MapPicker({ lat, lng, radius = 25, onChange, center = { lat:44.9778, lng:-93.2650 } }) {
  const divRef = useRef(null);
  const [leafletReady, setLeafletReady] = useState(!!(typeof window !== 'undefined' && window.L));
  const [rad, setRad] = useState(clamp(Number(radius) || 25, 5, 500));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.L) { setLeafletReady(true); return; }
    const linkId='leaflet-css';
    if(!document.getElementById(linkId)){
      const link=document.createElement('link'); link.id=linkId; link.rel='stylesheet'; link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link);
    }
    const s=document.createElement('script'); s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.async=true; s.onload=()=>setLeafletReady(true); document.body.appendChild(s);
  }, []);

  useEffect(() => { setRad(clamp(Number(radius) || 25, 5, 500)); }, [radius]);

  useEffect(() => {
    if (!leafletReady || !divRef.current || typeof window === 'undefined') return;
    const L = window.L; if (!L) return;

    const startLat = isFinite(Number(lat)) ? Number(lat) : Number(center.lat);
    const startLng = isFinite(Number(lng)) ? Number(lng) : Number(center.lng);

    if (!divRef.current._leaflet_map) {
      const map = L.map(divRef.current, { center: [startLat, startLng], zoom: 14 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);
      const marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);
      const circle = L.circle([startLat, startLng], { radius: Number(rad) || 25, color: '#60a5fa', fillOpacity: 0.08 }).addTo(map);

      marker.on('drag', () => circle.setLatLng(marker.getLatLng()));
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        onChange && onChange(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)), Number(clamp(rad,5,500)));
      });

      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        circle.setLatLng(e.latlng);
        onChange && onChange(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)), Number(clamp(rad,5,500)));
      });

      divRef.current._leaflet_map = map;
      divRef.current._marker = marker;
      divRef.current._circle = circle;
    } else {
      const map = divRef.current._leaflet_map;
      const marker = divRef.current._marker;
      const circle = divRef.current._circle;

      const haveLat = isFinite(Number(lat));
      const haveLng = isFinite(Number(lng));
      const pos = haveLat && haveLng ? [Number(lat), Number(lng)] : [Number(center.lat), Number(center.lng)];
      marker.setLatLng(pos);
      circle.setLatLng(pos);
      map.setView(pos, map.getZoom());
      circle.setRadius(Number(clamp(rad,5,500)));
    }
  }, [leafletReady, lat, lng, rad, onChange, center]);

  return (
    <div>
      <div ref={divRef} style={{ height:260, borderRadius:12, border:'1px solid var(--admin-border-soft)', background:'var(--appearance-panel-bg, var(--admin-panel-bg))' }} />
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center', marginTop:8 }}>
        <input
          type="range" min={5} max={500} step={5}
          value={rad}
          onChange={(e)=>{
            const next = clamp(Number(e.target.value)||25, 5, 500);
            setRad(next);
            if (divRef.current?._circle) divRef.current._circle.setRadius(Number(next));
            if (onChange && divRef.current?._marker) {
              const p = divRef.current._marker.getLatLng();
              onChange(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)), Number(next));
            }
          }}
        />
        <code style={{ color:'var(--admin-muted)' }}>{rad} m</code>
      </div>
    </div>
  );
}

/* TEXT TAB */
function TextTab({ config, setConfig }) {
  const [text, setText] = useState((config.textRules || []).join('\n'));
  useEffect(()=>{ setText((config.textRules || []).join('\n')); }, [config.textRules]);

  return (
    <main style={S.wrap}>
      <div style={S.card}>
        <h3 style={{ marginTop:0 }}>Text Rules / Instructions</h3>
        <div style={{ color:'var(--admin-muted)', marginBottom:8, fontSize:12 }}>
          One rule per line. This saves into <code>config.textRules</code>.
        </div>
        <textarea
          style={{ ...S.input, height:220, fontFamily:'ui-monospace, Menlo' }}
          value={text}
          onChange={(e)=>setText(e.target.value)}
        />
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <button
            style={S.button}
            onClick={()=>{
              const lines = text.split('\n').map(s=>s.trim()).filter(Boolean);
              setConfig(c=>({ ...c, textRules: lines }));
            }}
          >
            Save Rules
          </button>
          <button
            style={S.button}
            onClick={()=>setText((config.textRules || []).join('\n'))}
          >
            Reset
          </button>
        </div>
      </div>
    </main>
  );
}

/* ───────────────────────── MEDIA POOL (with sub-tabs & per-file usage) ───────────────────────── */
function MediaPoolTab({
  suite,
  config,
  setConfig,
  uploadStatus,
  setUploadStatus,
  uploadToRepo,
  onInventoryRefresh,
}) {
  const [inv, setInv] = useState([]);
  const [busy, setBusy] = useState(false);
  const [uploadContext, setUploadContext] = useState('media-pool');
  const [addUrl, setAddUrl] = useState('');
  const [dropActive, setDropActive] = useState(false);
  const fileInputRef = useRef(null);


  
  // Sub-tabs inside Media Pool. Default → 'audio' as requested.
  const subTabs = [
    { key:'image', label:'Images' },
    { key:'video', label:'Videos' },
    { key:'audio', label:'Audio' },
    { key:'gif',   label:'GIFs'  },
  ];
  const [subTab, setSubTab] = useState('image');

  const uploadContexts = [
    { value: 'media-pool', label: 'Media Pool' },
    { value: 'missions', label: 'Missions' },
    { value: 'devices', label: 'Devices' },
    { value: 'assigned', label: 'Assigned Media' },
    { value: 'settings', label: 'Settings (Cover Art)' },
    { value: 'uploads', label: 'General Uploads' },
  ];

  useEffect(() => { refreshInventory(); }, []);

  async function refreshInventory() {
    setBusy(true);
    try {
      const items = await listInventory(['uploads','bundles','icons','covers','missions','devices','assigned','mediapool']);
      setInv(items || []);
      if (typeof onInventoryRefresh === 'function') {
        try { await onInventoryRefresh(); } catch {}
      }
    } finally { setBusy(false); }
  }

  const currentTargetPath = resolveMediaSubfolder(subTab, uploadContext);

  // Per-file usage counts retained for backwards compatibility
  function usageCounts() {
    return {
      rewardsPool: 0,
      penaltiesPool: 0,
      iconMission: 0,
      iconDevice: 0,
      iconReward: 0,
      outcomeCorrect: 0,
      outcomeWrong: 0,
      outcomeAudio: 0,
    };
  }

  function addPoolItem(kind, url) {
    const label = baseNameFromUrl(url);
    setConfig(c => {
      if (!c) return c;
      const m = { rewardsPool:[...(c.media?.rewardsPool||[])], penaltiesPool:[...(c.media?.penaltiesPool||[])] };
      if (kind === 'rewards') m.rewardsPool.push({ url, label });
      if (kind === 'penalties') m.penaltiesPool.push({ url, label });
      return { ...c, media: m };
    });
  }
  function addIcon(kind, url) {
    const key = baseNameFromUrl(url).toLowerCase().replace(/\s+/g,'-').slice(0,48) || `icon-${Date.now()}`;
    const name = baseNameFromUrl(url);
    setConfig(c => {
      if (!c) return c;
      const icons = { missions:[...(c.icons?.missions||[])], devices:[...(c.icons?.devices||[])], rewards:[...(c.icons?.rewards||[])] };
      const list = icons[kind] || [];
      // allow duplicates (keys must be unique)
      let finalKey = key;
      let suffix = 1;
      while (list.find(i => i.key === finalKey)) {
        suffix += 1;
        finalKey = `${key}-${suffix}`;
      }
      list.push({ key: finalKey, name, url });
      icons[kind] = list;
      return { ...c, icons };
    });
  }

  async function uploadFiles(fileList) {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;
    let success = 0;
    let lastUrl = '';
    const failures = [];
    for (const file of files) {
      const type = classifyMediaType(file?.name, file?.type);
      if (uploadContext === 'settings' && !(type === 'image' || type === 'gif')) {
        const blockedName = file?.name || 'file';
        failures.push(blockedName);
        setUploadStatus(`❌ ${blockedName} is ${type || 'unsupported'} — Settings uploads accept images or GIFs.`);
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const uploaded = await uploadToRepo(file, { context: uploadContext, type });
      if (uploaded) {
        success += 1;
        lastUrl = uploaded;
      } else {
        failures.push(file?.name || 'file');
      }
    }
    if (lastUrl) setAddUrl(lastUrl);
    if (success) await refreshInventory();
    const contextLabel = uploadContexts.find((ctx) => ctx.value === uploadContext)?.label || uploadContext;
    if (files.length > 1) {
      const prefix = success === files.length ? '✅' : (success > 0 ? '⚠️' : '❌');
      setUploadStatus(`${prefix} Uploaded ${success}/${files.length} files to ${contextLabel}`);
    } else if (!success && failures.length) {
      setUploadStatus(`❌ Upload blocked for ${failures.join(', ')}`);
    }
  }

  async function onUpload(e) {
    await uploadFiles(e.target.files);
    if (e.target) e.target.value = '';
  }

  async function deleteOne(item) {
    const targetUrl = typeof item === 'string' ? item : (item?.url || item?.id || '');
    const repoPath = typeof item === 'string'
      ? pathFromUrl(item)
      : (item?.path || pathFromUrl(item?.url || item?.id || ''));
    if (!repoPath) {
      alert('This file cannot be deleted here (external or unknown path).');
      return false;
    }
    if (!window.confirm(`Delete this media file?\n${targetUrl}`)) return false;
    setUploadStatus('Deleting…');
    const ok = await deleteMediaPath(repoPath);
    setUploadStatus(ok ? '✅ Deleted' : '❌ Delete failed');
    if (ok) await refreshInventory();
    return ok;
  }

  async function deleteAll(list) {
    if (!list?.length) return;
    if (!window.confirm(`Delete ALL ${list.length} files in this group? This cannot be undone.`)) return;
    setUploadStatus('Deleting group…');
    let okCount = 0;
    for (const it of list) {
      const path = it?.path || pathFromUrl(it?.url || it?.id || '');
      if (!path) continue;
      // eslint-disable-next-line no-await-in-loop
      const ok = await deleteMediaPath(path);
      if (ok) okCount++;
    }
    setUploadStatus(`✅ Deleted ${okCount}/${list.length}`);
    await refreshInventory();
  }

  // Group by type
  const itemsByType = (inv || []).reduce((acc, it) => {
    const t = classifyMediaType(it.url, it.type);
    if (!acc[t]) acc[t] = [];
    acc[t].push(it);
    return acc;
  }, {});
  const sections = [
    { key:'image', title:'Images (png/jpg/svg)', items: itemsByType.image || [] },
    { key:'video', title:'Video (mp4/mov)',       items: itemsByType.video || [] },
    { key:'audio', title:'Audio (mp3/wav/aiff)',  items: itemsByType.audio || [] },
    { key:'gif',   title:'GIF',                  items: itemsByType.gif   || [] },
  ];
  const active = sections.find(s => s.key === subTab) || sections[0];

  return (
    <main style={S.wrap}>
      {/* Upload */}
      <div style={S.card}>
        <h3 style={{ marginTop:0 }}>Upload</h3>
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:8, alignItems:'center' }}>
          <input style={S.input} placeholder="(Optional) Paste URL to remember…" value={addUrl} onChange={(e)=>setAddUrl(e.target.value)} />
          <select style={S.input} value={uploadContext} onChange={(e)=>setUploadContext(e.target.value)}>
            {uploadContexts.map((ctx) => (
              <option key={ctx.value} value={ctx.value}>{ctx.label}</option>
            ))}
          </select>
          <button
            type="button"
            style={{ ...S.button, display:'grid', placeItems:'center' }}
            onClick={()=>fileInputRef.current?.click()}
          >
            Upload
          </button>
        </div>
        <div
          onDragOver={(e)=>{ e.preventDefault(); setDropActive(true); }}
          onDragLeave={(e)=>{ e.preventDefault(); setDropActive(false); }}
          onDrop={(e)=>{
            e.preventDefault();
            setDropActive(false);
            uploadFiles(e.dataTransfer?.files);
          }}
          style={{ ...S.mediaDropZone, ...(dropActive ? S.mediaDropZoneActive : {}) }}
        >
          <div>
            <div style={S.mediaDropHeadline}>Drag & drop media</div>
            <div style={S.mediaDropHint}>
              Drop multiple files at once or click Upload to browse. Files save to <code>/media/{currentTargetPath}</code>.
            </div>
          </div>
          <button type="button" style={S.mediaDropBrowse} onClick={()=>fileInputRef.current?.click()}>Browse files</button>
        </div>
        <input ref={fileInputRef} type="file" multiple onChange={onUpload} style={{ display:'none' }} />
        {uploadStatus && <div style={{ marginTop:8, color:'var(--admin-muted)' }}>{uploadStatus}</div>}
        <div style={{ marginTop:4, color:'var(--admin-muted)', fontSize:12 }}>
          Target directory: <code>/media/{currentTargetPath}</code>
        </div>
        <div style={{ color:'var(--admin-muted)', marginTop:8, fontSize:12 }}>
          Inventory {busy ? '(loading…)':''}: {inv.length} files
        </div>
      </div>

      {/* Sub-tabs: Images • Videos • Audio • GIFs (Audio default) */}
      <div style={{ ...S.card, marginTop:16 }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
          {subTabs.map(st => (
            <button
              key={st.key}
              onClick={()=>setSubTab(st.key)}
              style={{ ...S.tab, ...(subTab===st.key?S.tabActive:{}) }}
            >
              {st.label.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Active section */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', margin: '4px 0 12px' }}>
          <h3 style={{ margin:0 }}>{active.title}</h3>
          <button
            style={{ ...S.button, ...S.buttonDanger }}
            onClick={()=>deleteAll(active.items)}
            disabled={!active.items.length}
            title="Delete all files in this type"
          >
            Delete All
          </button>
        </div>

        {active.items.length === 0 ? (
          <div style={{ color:'var(--admin-muted)' }}>No files.</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px,1fr))', gap:12 }}>
            {active.items.map((it, idx)=>{
              const url = toDirectMediaURL(it.url);
              const name = baseNameFromUrl(url);
              const previewCandidate = toDirectMediaURL(it.thumbUrl || it.url || '');
              const previewKind = classifyMediaType(previewCandidate, it.type);
              const looksImage = previewKind === 'image' || previewKind === 'gif';
              return (
                <div key={idx} style={{ border:'1px solid var(--admin-border-soft)', borderRadius:12, padding:12, display:'grid', gap:10 }}>
                  {looksImage ? (
                    <div
                      style={{
                        width: '100%',
                        height: 160,
                        borderRadius: 12,
                        overflow: 'hidden',
                        border: '1px solid var(--admin-border-soft)',
                        background: 'var(--admin-input-bg)',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <img src={previewCandidate} alt={name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    </div>
                  ) : (
                    <MediaPreview url={url} kind={active.key} />
                  )}
                  <div>
                    <div style={{ fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
                    <div style={{ fontSize:12, color:'var(--admin-muted)', wordBreak:'break-word' }}>{url}</div>
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ ...S.button, textDecoration:'none', display:'inline-flex', alignItems:'center', justifyContent:'center' }}
                    >
                      Open
                    </a>
                    <button
                      style={{ ...S.button, ...S.buttonDanger }}
                      onClick={()=>deleteOne(it)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

/* ───────────────────────── ASSIGNED MEDIA (renamed Media tab) ───────────────────────── */
function AssignedMediaPageTab({
  config,
  setConfig,
  onReapplyDefaults,
  inventory = [],
  devices = [],
  missions = [],
  assignedMediaError = null,
  setAssignedMediaError = () => {},
  setStatus = () => {},
}) {
  const [mediaTriggerPicker, setMediaTriggerPicker] = useState('');
  const safeConfig = config || {};
  const safeMedia = safeConfig.media || {};
  const safeIcons = safeConfig.icons || {};
  const rewards = safeMedia.rewardsPool || [];
  const penalties = safeMedia.penaltiesPool || [];
  const iconsM = safeIcons.missions || [];
  const iconsD = safeIcons.devices  || [];
  const iconsR = safeIcons.rewards  || [];
  const missionIconLookup = useMemo(
    () => buildMissionIconLookup(config),
    [config?.icons?.missions, config?.icons?.devices]
  );
  const triggerConfig = mergeTriggerState(safeConfig.mediaTriggers);

  function updateMediaTrigger(partial) {
    setConfig((c) => {
      const base = c || {};
      return {
        ...base,
        mediaTriggers: mergeTriggerState(base.mediaTriggers, partial),
      };
    });
  }

  const iconsDevices = safeIcons.devices || [];
  const mediaOptions = (inventory || []).map((it, idx) => {
    const rawUrl = it?.url || it?.path || it;
    const url = toDirectMediaURL(rawUrl);
    if (!url) return null;
    return { id: url, label: it?.label || baseNameFromUrl(url) || `Media ${idx + 1}`, thumbnail: url };
  }).filter(Boolean);
  const deviceOptions = (devices || []).map((d, idx) => {
    const id = d?.id || d?.key || `device-${idx}`;
    const label = d?.title || d?.name || id;
    const iconKey = d?.iconKey;
    const iconEntry = iconsDevices.find(x => (x.key||'') === iconKey);
    const thumbnail = toDirectMediaURL(d?.iconUrl || iconEntry?.url || '');
    return { id, label, thumbnail, meta: d };
  });
  const missionOptions = (missions || []).map((m, idx) => {
    const id = m?.id || `mission-${idx}`;
    const label = m?.title || id;
    const iconEntry = missionIconLookup.get((m?.iconKey || '').toLowerCase());
    const thumbnail = toDirectMediaURL(iconEntry?.url || '');
    return { id, label, thumbnail, meta: m };
  });
  const responseOptions = [];
  (missions || []).forEach((m) => {
    if (!m) return;
    const baseLabel = m.title || m.id || 'Mission';
    const iconEntry = missionIconLookup.get((m?.iconKey || '').toLowerCase());
    const correctThumb = toDirectMediaURL(m?.correct?.mediaUrl || m?.correct?.audioUrl || iconEntry?.url || '');
    responseOptions.push({ id: `${m.id || baseLabel}::correct`, label: `${baseLabel} — Correct`, thumbnail: correctThumb });
    const wrongThumb = toDirectMediaURL(m?.wrong?.mediaUrl || m?.wrong?.audioUrl || iconEntry?.url || '');
    responseOptions.push({ id: `${m.id || baseLabel}::wrong`, label: `${baseLabel} — Wrong`, thumbnail: wrongThumb });
  });
  const actionOptionsByType = {
    media: mediaOptions,
    devices: deviceOptions,
    missions: missionOptions,
  };
  const selectedActionList = actionOptionsByType[triggerConfig.actionType] || mediaOptions;
  const selectedAction = selectedActionList.find(opt => opt.id === triggerConfig.actionTarget) || null;
  const resolvedActionPreview = triggerConfig.actionThumbnail || selectedAction?.thumbnail || '';
  const selectedDevice = deviceOptions.find(opt => opt.id === triggerConfig.triggerDeviceId) || null;
  const selectedResponse = responseOptions.find(opt => opt.id === triggerConfig.triggeredResponseKey) || null;
  const selectedMission = missionOptions.find(opt => opt.id === triggerConfig.triggeredMissionId) || null;
  const triggeredDeviceSummaries = (devices || []).filter(d => d?.trigger?.enabled).map(d => ({
    id: d?.id || d?.key,
    label: d?.title || d?.name || d?.id || 'Device',
    trigger: sanitizeTriggerConfig(d?.trigger),
  }));

  const assignedMediaFallback = useCallback(({ error, reset }) => (
    <div style={S.errorPanel}>
      <div style={S.errorPanelTitle}>Assigned Media failed to load</div>
      <div style={S.errorPanelMessage}>
        {error?.message || 'An unexpected error occurred while rendering the Assigned Media tab.'}
      </div>
      <div style={S.errorPanelActions}>
        <button
          type="button"
          style={S.button}
          onClick={() => {
            setAssignedMediaError(null);
            reset();
          }}
        >
          Retry
        </button>
      </div>
    </div>
  ), [setAssignedMediaError]);

  const mediaPool = useMemo(() => {
    return (inventory || []).map((item, idx) => {
      const rawUrl = item?.url || item?.path || item;
      const directUrl = toDirectMediaURL(rawUrl);
      if (!directUrl) return null;
      const thumb = toDirectMediaURL(item?.thumbUrl || directUrl);
      return {
        id: directUrl,
        name: item?.label || baseNameFromUrl(directUrl) || `Media ${idx + 1}`,
        type: item?.type || item?.kind || '',
        tags: Array.isArray(item?.tags) ? item.tags : [],
        thumbUrl: thumb,
        url: directUrl,
        openUrl: rawUrl || directUrl,
        path: item?.path || '',
      };
    }).filter(Boolean);
  }, [inventory]);

  const assignedState = useMemo(() => ({
    missionIcons: Array.from(missionIconLookup.values()).map(icon => icon.key),
    deviceIcons: (config?.icons?.devices || []).map(icon => icon.key),
    rewardMedia: (config?.media?.rewardsPool || []).map(item => item.url),
    penaltyMedia: (config?.media?.penaltiesPool || []).map(item => item.url),
    actionMedia: config?.media?.actionMedia || [],
  }), [config, missionIconLookup]);

  const mediaUsageSummary = useMemo(() => {
    try {
    const normalize = (value) => {
      if (!value) return '';
      try {
        const direct = toDirectMediaURL(value) || String(value);
        return String(direct).trim();
      } catch {
        return String(value || '').trim();
      }
    };

    const inventoryIndex = new Map(
      (mediaPool || [])
        .map((item) => {
          const key = normalize(item?.id || item?.url);
          return key ? [key, item] : null;
        })
        .filter(Boolean)
    );

    const addTagValue = (set, value) => {
      if (!set) return;
      const normalizedTag = String(value || '').trim();
      if (!normalizedTag) return;
      set.add(normalizedTag);
    };

    const ensureEntry = (map, rawUrl, defaults = {}) => {
      const key = normalize(rawUrl);
      if (!key) return null;
      const info = inventoryIndex.get(key);
      let entry = map.get(key);
      if (!entry) {
        entry = {
          url: key,
          label: defaults.label || info?.name || baseNameFromUrl(key),
          references: new Set(),
          count: 0,
          kind: defaults.kind || info?.type || classifyByExt(key),
          thumbUrl: defaults.thumbUrl || info?.thumbUrl || '',
          tags: new Set(),
        };
        map.set(key, entry);
      }
      if (!entry.label && (defaults.label || info?.name)) {
        entry.label = defaults.label || info?.name;
      }
      if (!entry.kind && (defaults.kind || info?.type)) {
        entry.kind = defaults.kind || info?.type || entry.kind;
      }
      if (!entry.thumbUrl && (defaults.thumbUrl || info?.thumbUrl)) {
        entry.thumbUrl = defaults.thumbUrl || info?.thumbUrl || entry.thumbUrl;
      }
      (Array.isArray(info?.tags) ? info.tags : []).forEach((tag) => addTagValue(entry.tags, tag));
      (Array.isArray(defaults.tags) ? defaults.tags : []).forEach((tag) => addTagValue(entry.tags, tag));
      return entry;
    };

    const addUsage = (map, rawUrl, referenceLabel, defaults = {}) => {
      const entry = ensureEntry(map, rawUrl, defaults);
      if (!entry) return;
      entry.count += 1;
      if (referenceLabel) entry.references.add(referenceLabel);
    };

    const missionIconMap = new Map();
    const deviceIconMap = new Map();
    const rewardMap = new Map();
    const penaltyMap = new Map();
    const actionMap = new Map();
    const responseCorrectMap = new Map();
    const responseWrongMap = new Map();
    const responseAudioMap = new Map();
    const coverMap = new Map();

    const missionIconLookup = buildMissionIconLookup(safeConfig);

    (missions || []).forEach((mission) => {
      if (!mission) return;
      const title = mission.title || mission.id || 'Mission';
      const iconUrls = new Set();
      if (mission.iconUrl) {
        const direct = normalize(mission.iconUrl);
        if (direct) iconUrls.add(direct);
      }
      if (mission.iconKey) {
        const found = missionIconLookup.get(String(mission.iconKey).toLowerCase());
        if (found?.url) iconUrls.add(found.url);
      }
      iconUrls.forEach((url) => addUsage(missionIconMap, url, title));

      if (mission.onCorrect?.mediaUrl) addUsage(responseCorrectMap, mission.onCorrect.mediaUrl, `${title} — Correct`);
      if (mission.onWrong?.mediaUrl) addUsage(responseWrongMap, mission.onWrong.mediaUrl, `${title} — Wrong`);
      if (mission.onCorrect?.audioUrl) addUsage(responseAudioMap, mission.onCorrect.audioUrl, `${title} — Correct`);
      if (mission.onWrong?.audioUrl) addUsage(responseAudioMap, mission.onWrong.audioUrl, `${title} — Wrong`);
    });

    const deviceIconLookup = new Map();
    (safeIcons.devices || []).forEach((icon) => {
      const url = normalize(icon?.url);
      if (!url) return;
      deviceIconLookup.set(icon.key, { url, name: icon.name || icon.key });
    });

    const hasDevices = Array.isArray(safeConfig.devices) && safeConfig.devices.length;
    const deviceList = (hasDevices ? safeConfig.devices : (safeConfig.powerups || [])) || [];
    deviceList.forEach((device) => {
      if (!device) return;
      const label = device.title || device.name || device.id || 'Device';
      const urls = new Set();
      if (device.iconUrl) {
        const direct = normalize(device.iconUrl);
        if (direct) urls.add(direct);
      }
      if (device.iconKey && deviceIconLookup.has(device.iconKey)) {
        const found = deviceIconLookup.get(device.iconKey);
        if (found?.url) urls.add(found.url);
      }
      urls.forEach((url) => addUsage(deviceIconMap, url, label));
    });

    (safeMedia.rewardsPool || []).forEach((item) => {
      if (!item?.url) return;
      const tags = Array.isArray(item?.tags) ? item.tags : undefined;
      addUsage(rewardMap, item.url, item.label || 'Reward slot', { label: item.label || undefined, tags });
    });

    (safeMedia.penaltiesPool || []).forEach((item) => {
      if (!item?.url) return;
      const tags = Array.isArray(item?.tags) ? item.tags : undefined;
      addUsage(penaltyMap, item.url, item.label || 'Penalty slot', { label: item.label || undefined, tags });
    });

    (safeMedia.actionMedia || []).forEach((url) => {
      addUsage(actionMap, url, 'Trigger assignment');
    });

    const coverUrl = normalize(safeConfig?.game?.coverImage);
    if (coverUrl) {
      const entry = ensureEntry(coverMap, coverUrl, { label: 'Game cover art' });
      if (entry) {
        entry.count = Math.max(1, entry.count);
        entry.references.add('Active cover image');
      }
    }

    const finalize = (map) => Array.from(map.values()).map((entry) => {
      const info = inventoryIndex.get(entry.url);
      const label = entry.label || info?.name || baseNameFromUrl(entry.url);
      const kind = entry.kind || info?.type || classifyByExt(entry.url);
      const openUrl = info?.openUrl || entry.url;
      const thumb = kind === 'audio'
        ? ''
        : (info?.thumbUrl || entry.thumbUrl || openUrl);
      const tagSet = new Set();
      if (entry.tags instanceof Set) {
        entry.tags.forEach((tag) => addTagValue(tagSet, tag));
      }
      (Array.isArray(info?.tags) ? info.tags : []).forEach((tag) => addTagValue(tagSet, tag));
      return {
        url: openUrl,
        label,
        count: entry.count,
        references: Array.from(entry.references || []),
        kind,
        thumbUrl: thumb,
        removeKey: entry.url,
        tags: Array.from(tagSet),
      };
    }).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });

    return {
      missionIcons: finalize(missionIconMap),
      deviceIcons: finalize(deviceIconMap),
      rewardMedia: finalize(rewardMap),
      penaltyMedia: finalize(penaltyMap),
      actionMedia: finalize(actionMap),
      responseCorrect: finalize(responseCorrectMap),
      responseWrong: finalize(responseWrongMap),
      responseAudio: finalize(responseAudioMap),
      coverImages: finalize(coverMap),
    };
    } catch (err) {
      console.error('Failed to compute media usage summary', err);
      return {
        missionIcons: [],
        deviceIcons: [],
        rewardMedia: [],
        penaltyMedia: [],
        actionMedia: [],
        responseCorrect: [],
        responseWrong: [],
        responseAudio: [],
        coverImages: [],
      };
    }
  }, [config, missions, mediaPool]);

  const arraysEqual = useCallback((a = [], b = []) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }, []);

  const handleAssignedStateChange = useCallback((nextAssigned = {}) => {
    const nextAction = Array.isArray(nextAssigned.actionMedia) ? nextAssigned.actionMedia : [];
    setConfig(current => {
      const base = current || {};
      const prevAction = base.media?.actionMedia || [];
      if (arraysEqual(prevAction, nextAction)) return current;
      return {
        ...base,
        media: {
          ...(base.media || {}),
          actionMedia: [...nextAction],
        },
      };
    });
  }, [arraysEqual, setConfig]);

  const triggerEnabled = !!triggerConfig.enabled;

  const handleTriggerToggle = useCallback((enabled) => {
    setMediaTriggerPicker('');
    updateMediaTrigger({ enabled });
  }, [updateMediaTrigger]);

  function removePoolItem(kind, idx) {
    if (!window.confirm('Remove this item from the assigned list?')) return;
    setConfig(c => {
      if (!c) return c;
      const m = { ...(c.media||{ rewardsPool:[], penaltiesPool:[] }) };
      if (kind === 'rewards') m.rewardsPool = m.rewardsPool.filter((_,i)=>i!==idx);
      if (kind === 'penalties') m.penaltiesPool = m.penaltiesPool.filter((_,i)=>i!==idx);
      return { ...c, media: m };
    });
  }
  function removeIcon(kind, key) {
    if (!window.confirm('Remove this icon from the assigned list?')) return;
    setConfig(c => {
      if (!c) return c;
      const icons = { missions:[...(c.icons?.missions||[])], devices:[...(c.icons?.devices||[])], rewards:[...(c.icons?.rewards||[])] };
      icons[kind] = icons[kind].filter(i => i.key !== key);
      return { ...c, icons };
    });
  }

  return (
    <main style={S.wrap}>
      <div style={S.card}>
        <SafeBoundary
          fallback={assignedMediaFallback}
          onError={(error) => {
            console.error('Assigned Media render failure', error);
            setAssignedMediaError(error);
            const message = error?.message || error || 'unknown error';
            setStatus(`❌ Assigned Media failed to load: ${message}`);
          }}
          onReset={() => setAssignedMediaError(null)}
          resetKeys={[assignedMediaError, assignedState, mediaUsageSummary, inventory]}
        >
          <AssignedMediaTab
            mediaPool={mediaPool}
            assigned={assignedState}
            onChange={handleAssignedStateChange}
            triggerEnabled={triggerEnabled}
            setTriggerEnabled={handleTriggerToggle}
            usageSummary={mediaUsageSummary}
          />
        </SafeBoundary>

        {triggerEnabled && (
          <>
            <div style={{ fontWeight:600, margin:'8px 0 12px', fontSize:18 }}>Automation Routing</div>

            <div style={{ marginTop:12, display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
              <div style={{ fontSize:12, color:'var(--admin-muted)' }}>Action type</div>
              <select
                style={S.input}
                value={triggerConfig.actionType}
                onChange={(e)=>{ setMediaTriggerPicker(''); updateMediaTrigger({ actionType:e.target.value, actionTarget:'', actionLabel:'', actionThumbnail:'' }); }}
              >
                <option value="media">Media</option>
                <option value="devices">Devices</option>
                <option value="missions">Missions</option>
              </select>
            </div>

            <TriggerDropdown
              label="Action target"
              openKey={mediaTriggerPicker}
              setOpenKey={setMediaTriggerPicker}
              dropdownKey="media-action"
              options={selectedActionList}
              selected={selectedAction}
              onSelect={(opt)=>{ updateMediaTrigger({ actionTarget: opt?.id || '', actionLabel: opt?.label || '', actionThumbnail: opt?.thumbnail || '' }); }}
            />
            {resolvedActionPreview && (
              <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ fontSize:12, color:'var(--admin-muted)' }}>Action preview</div>
                <div style={{ width:80, height:60, borderRadius:10, overflow:'hidden', border:'1px solid var(--admin-border-soft)', background:'var(--admin-tab-bg)', display:'grid', placeItems:'center' }}>
                  <img src={toDirectMediaURL(resolvedActionPreview)} alt="action preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                </div>
              </div>
            )}

            <TriggerDropdown
              label="Trigger Device"
              openKey={mediaTriggerPicker}
              setOpenKey={setMediaTriggerPicker}
              dropdownKey="media-device"
              options={deviceOptions}
              selected={selectedDevice}
              onSelect={(opt)=>{ updateMediaTrigger({ triggerDeviceId: opt?.id || '', triggerDeviceLabel: opt?.label || '' }); }}
            />

            <TriggerDropdown
              label="Triggered Response"
              openKey={mediaTriggerPicker}
              setOpenKey={setMediaTriggerPicker}
              dropdownKey="media-response"
              options={responseOptions}
              selected={selectedResponse}
              onSelect={(opt)=>{ updateMediaTrigger({ triggeredResponseKey: opt?.id || '' }); }}
            />

            <TriggerDropdown
              label="Triggered Mission"
              openKey={mediaTriggerPicker}
              setOpenKey={setMediaTriggerPicker}
              dropdownKey="media-mission"
              options={missionOptions}
              selected={selectedMission}
              onSelect={(opt)=>{ updateMediaTrigger({ triggeredMissionId: opt?.id || '' }); }}
            />
          </>
        )}

        <div style={{ marginTop:16 }}>
          <div style={{ fontWeight:600, marginBottom:6 }}>Trigger Device Assignments</div>
          {triggeredDeviceSummaries.length === 0 ? (
            <div style={{ color:'var(--admin-muted)', fontSize:12 }}>No trigger-enabled devices yet.</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:10 }}>
              {triggeredDeviceSummaries.map((it)=>{
                const preview = it.trigger.actionThumbnail || '';
                return (
                  <div key={it.id} style={{ border:'1px solid var(--admin-border-soft)', borderRadius:10, padding:10, display:'grid', gap:8 }}>
                    <div style={{ fontWeight:600 }}>{it.label}</div>
                    <div style={{ fontSize:12, color:'var(--admin-muted)' }}>Action: {it.trigger.actionLabel || it.trigger.actionTarget || '(none)'}</div>
                    {preview && (
                      <div style={{ width:'100%', height:64, borderRadius:10, overflow:'hidden', border:'1px solid var(--admin-border-soft)', background:'var(--admin-tab-bg)', display:'grid', placeItems:'center' }}>
                        <img src={toDirectMediaURL(preview)} alt="trigger preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Icons */}
      <div style={S.card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ marginTop:0, marginBottom:8 }}>Assigned Icons</h3>
          <button style={S.button} onClick={onReapplyDefaults}>Re-apply default icon sets</button>
        </div>

        <IconGroup
          title={`Mission Icons (${iconsM.length})`}
          items={iconsM}
          onRemove={(key)=>removeIcon('missions', key)}
        />
        <IconGroup
          title={`Device Icons (${iconsD.length})`}
          items={iconsD}
          onRemove={(key)=>removeIcon('devices', key)}
        />
        <IconGroup
          title={`Reward Icons (${iconsR.length})`}
          items={iconsR}
          onRemove={(key)=>removeIcon('rewards', key)}
        />
      </div>

      {/* Pools */}
      <div style={{ ...S.card, marginTop:16 }}>
        <h3 style={{ marginTop:0, marginBottom:8 }}>Assigned Media Pools</h3>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <Pool
            title={`Rewards Pool (${rewards.length})`}
            items={rewards}
            onRemove={(idx)=>removePoolItem('rewards', idx)}
          />
          <Pool
            title={`Penalties Pool (${penalties.length})`}
            items={penalties}
            onRemove={(idx)=>removePoolItem('penalties', idx)}
          />
        </div>
      </div>
    </main>
  );
}

/* Shared pieces for Assigned Media */
function IconGroup({ title, items, onRemove }) {
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ fontWeight:600, marginBottom:8 }}>{title}</div>
      {items.length === 0 && <div style={{ color:'var(--admin-muted)', marginBottom:8 }}>No icons yet.</div>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:10 }}>
        {items.map((it)=>(
          <div key={it.key} style={{ border:'1px solid var(--admin-border-soft)', borderRadius:10, padding:10, display:'grid', gap:6 }}>
            <div style={{ display:'grid', gridTemplateColumns:'48px 1fr', gap:8, alignItems:'center' }}>
              <img src={toDirectMediaURL(it.url)} alt="" style={{ width:48, height:48, objectFit:'contain', border:'1px solid var(--admin-border-soft)', borderRadius:8 }}/>
              <div>
                <div style={{ fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{it.name||it.key}</div>
                <div style={{ fontSize:12, color:'var(--admin-muted)' }}>{it.key}</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <a href={toDirectMediaURL(it.url)} target="_blank" rel="noreferrer" style={{ ...S.button, textDecoration:'none', display:'grid', placeItems:'center' }}>Open</a>
              <button
                style={{ ...S.button, ...S.buttonDanger }}
                onClick={()=>onRemove(it.key)}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function Pool({ title, items, onRemove }) {
  return (
    <div>
      <div style={{ fontWeight:600, marginBottom:8 }}>{title}</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px,1fr))', gap:10 }}>
        {items.map((it, idx)=>(
          <div key={idx} style={{ border:'1px solid var(--admin-border-soft)', borderRadius:10, padding:10 }}>
            <div style={{ fontWeight:600, marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {it.label || baseNameFromUrl(it.url)}
            </div>
            <MediaPreview url={it.url} kind="pool item" />
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <a href={toDirectMediaURL(it.url)} target="_blank" rel="noreferrer" style={{ ...S.button, textDecoration:'none', display:'grid', placeItems:'center' }}>Open</a>
              <button
                style={{ ...S.button, ...S.buttonDanger }}
                onClick={()=>{ if (window.confirm('Remove this item?')) onRemove(idx); }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        {items.length===0 && <div style={{ color:'var(--admin-muted)' }}>No items.</div>}
      </div>
    </div>
  );
}

function TriggerDropdown({ label, openKey = '', setOpenKey = () => {}, dropdownKey, options = [], selected = null, onSelect = () => {} }) {
  const isOpen = openKey === dropdownKey;
  return (
    <div style={{ marginTop:12 }}>
      <div style={{ fontSize:12, color:'var(--admin-muted)', marginBottom:6 }}>{label}</div>
      <div style={{ position:'relative' }}>
        <button
          type="button"
          style={{ ...S.button, width:'100%', justifyContent:'space-between', display:'flex', alignItems:'center' }}
          onClick={()=>setOpenKey(isOpen ? '' : dropdownKey)}
        >
          <span>{selected ? selected.label : 'Select option'}</span>
          <span style={{ opacity:0.6 }}>▾</span>
        </button>
        {isOpen && (
          <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, zIndex:40, maxHeight:240, overflowY:'auto', border:'1px solid var(--admin-border-soft)', borderRadius:10, background:'var(--appearance-panel-bg, var(--admin-panel-bg))', boxShadow:'0 18px 36px rgba(0,0,0,0.45)' }}>
            {options.length === 0 ? (
              <div style={{ padding:12, color:'var(--admin-muted)' }}>No options available.</div>
            ) : options.map(opt => (
              <div
                key={opt.id}
                onClick={()=>{ onSelect(opt); setOpenKey(''); }}
                style={{ display:'grid', gridTemplateColumns:'56px 1fr', gap:10, alignItems:'center', padding:'8px 12px', cursor:'pointer', borderBottom:'1px solid var(--admin-border-soft)' }}
              >
                <div style={{ width:56, height:42, borderRadius:8, overflow:'hidden', background:'var(--admin-tab-bg)', display:'grid', placeItems:'center' }}>
                  {opt.thumbnail ? (
                    <img src={toDirectMediaURL(opt.thumbnail)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  ) : (
                    <div style={{ fontSize:12, color:'var(--admin-muted)' }}>No preview</div>
                  )}
                </div>
                <div>
                  <div style={{ fontWeight:600 }}>{opt.label}</div>
                  <div style={{ fontSize:12, color:'var(--admin-muted)' }}>{opt.id}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
