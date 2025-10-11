import React, { useEffect, useMemo, useRef, useState } from 'react';
import TestLauncher from '../components/TestLauncher';
import AnswerResponseEditor from '../components/AnswerResponseEditor';
import InlineMissionResponses from '../components/InlineMissionResponses';

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
async function listInventory(dirs = ['uploads', 'bundles', 'icons']) {
  const seen = new Set();
  const out = [];
  await Promise.all(dirs.map(async (dir) => {
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

/* ───────────────────────── Defaults ───────────────────────── */
const DEFAULT_BUNDLES = {
  devices: [
    { key:'smoke-shield', name:'Smoke Shield', url:'/media/bundles/SMOKE%20BOMB.png' },
    { key:'roaming-robot', name:'Roaming Robot', url:'/media/bundles/ROBOT1small.png' },
  ],
  missions: [
    { key:'trivia',   name:'Trivia',   url:'/media/bundles/trivia%20icon.png' },
    { key:'trivia-2', name:'Trivia 2', url:'/media/bundles/trivia%20yellow.png' },
  ],
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
const FONT_FAMILIES = [
  { v:'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif', label:'System' },
  { v:'Georgia, serif',                      label:'Georgia' },
  { v:'Times New Roman, Times, serif',      label:'Times New Roman' },
  { v:'Arial, Helvetica, sans-serif',       label:'Arial' },
  { v:'Courier New, Courier, monospace',    label:'Courier New' },
];
function defaultAppearance() {
  return {
    fontFamily: FONT_FAMILIES[0].v,
    fontSizePx: 22,
    fontColor: '#ffffff',
    textBgColor: '#000000',
    textBgOpacity: 0.0,
    screenBgColor: '#000000',
    screenBgOpacity: 0.0,
    screenBgImage: '',
    textAlign: 'center',
    textVertical: 'top',
  };
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
const APPEARANCE_SKINS = [
  {
    key: 'default',
    label: 'Default Control',
    description: 'Neutral chrome-lite mission console with woven fabric texture.',
    uiKey: 'default',
    appearance: {
      ...defaultAppearance(),
      fontColor: '#1f2a35',
      textBgColor: '#f4f8fb',
      textBgOpacity: 0.76,
      screenBgColor: '#dbe4f1',
      screenBgOpacity: 0.45,
      screenBgImage: '/media/skins/control-fabric.svg',
      textAlign: 'left',
    },
  },
  {
    key: 'space-military',
    label: 'Space Military Command',
    description: 'Jet cockpit chrome and brushed metal HUD piping.',
    uiKey: 'space-military',
    appearance: {
      fontFamily: '"Orbitron", "Rajdhani", "Segoe UI", sans-serif',
      fontSizePx: 26,
      fontColor: '#14253a',
      textBgColor: '#f3f8ff',
      textBgOpacity: 0.7,
      screenBgColor: '#d6e2f2',
      screenBgOpacity: 0.5,
      screenBgImage: '/media/skins/space-metal.svg',
      textAlign: 'center',
      textVertical: 'top',
    },
  },
  {
    key: 'military-desert',
    label: 'Desert Ops',
    description: 'Sun-baked armor plating with sandy cactus silhouettes.',
    uiKey: 'military-desert',
    appearance: {
      fontFamily: '"Copperplate", "Trebuchet MS", "Segoe UI", sans-serif',
      fontSizePx: 24,
      fontColor: '#3b2a16',
      textBgColor: '#fff4de',
      textBgOpacity: 0.76,
      screenBgColor: '#f1ddbc',
      screenBgOpacity: 0.55,
      screenBgImage: '/media/skins/desert-canvas.svg',
      textAlign: 'center',
      textVertical: 'top',
    },
  },
  {
    key: 'forest-outpost',
    label: 'Forest Outpost',
    description: 'Leaf canopy, wood grain, and moss-lit control glass.',
    uiKey: 'forest-outpost',
    appearance: {
      fontFamily: '"Merriweather Sans", "Gill Sans", "Segoe UI", sans-serif',
      fontSizePx: 24,
      fontColor: '#1f2d1f',
      textBgColor: '#edf8e6',
      textBgOpacity: 0.74,
      screenBgColor: '#d4ebcc',
      screenBgOpacity: 0.54,
      screenBgImage: '/media/skins/forest-foliage.svg',
      textAlign: 'left',
      textVertical: 'top',
    },
  },
  {
    key: 'starfield',
    label: 'Starfield Observatory',
    description: 'Soft starfield glass with nebula shimmer and chrome trim.',
    uiKey: 'starfield',
    appearance: {
      fontFamily: '"Exo 2", "Segoe UI", sans-serif',
      fontSizePx: 22,
      fontColor: '#1f2648',
      textBgColor: '#eef1ff',
      textBgOpacity: 0.7,
      screenBgColor: '#d7def6',
      screenBgOpacity: 0.5,
      screenBgImage: '/media/skins/starfield-soft.svg',
      textAlign: 'center',
      textVertical: 'top',
    },
  },
  {
    key: 'cartoon-bubbles',
    label: 'Cartoon Bubbles',
    description: 'High-def balloons, candy gloss, and playful fonts.',
    uiKey: 'cartoon-bubbles',
    appearance: {
      fontFamily: '"Baloo 2", "Comic Sans MS", "Segoe UI", sans-serif',
      fontSizePx: 28,
      fontColor: '#4b2c6c',
      textBgColor: '#fff1ff',
      textBgOpacity: 0.68,
      screenBgColor: '#f2dfff',
      screenBgOpacity: 0.55,
      screenBgImage: '/media/skins/cartoon-balloons.svg',
      textAlign: 'center',
      textVertical: 'top',
    },
  },
];
const APPEARANCE_SKIN_MAP = new Map(APPEARANCE_SKINS.map((skin) => [skin.key, skin]));
const ADMIN_SKIN_TO_UI = new Map(APPEARANCE_SKINS.map((skin) => [skin.key, skin.uiKey || skin.key]));
const DEFAULT_UI_SKIN = ADMIN_SKIN_TO_UI.get('default') || 'default';

function applyAdminUiThemeForDocument(skinKey) {
  if (typeof document === 'undefined') return;
  const body = document.body;
  if (!body) return;
  const uiKey = ADMIN_SKIN_TO_UI.get(skinKey) || DEFAULT_UI_SKIN;
  body.dataset.skin = uiKey;
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
    'textAlign',
    'textVertical',
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

/* ───────────────────────── Root ───────────────────────── */
export default function Admin() {
  const [tab, setTab] = useState('missions');

  const [games, setGames] = useState([]);
  const [activeSlug, setActiveSlug] = useState('default'); // Default Game → legacy root
  const [showNewGame, setShowNewGame] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('Mystery');
  const [newMode, setNewMode] = useState('single');
  const [newDurationMin, setNewDurationMin] = useState(0);
  const [newAlertMin, setNewAlertMin] = useState(10);

  const [showRings, setShowRings] = useState(true);
  const [testChannel, setTestChannel] = useState('draft');

  const [suite, setSuite]   = useState(null);
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState('');

  const [selected, setSelected] = useState(null);
  const [editing, setEditing]   = useState(null);
  // media inventory for editors
  const [inventory, setInventory] = useState([]);
useEffect(()=>{
  let mounted = true;
  (async ()=>{
    try {
      const items = await listInventory(['uploads','bundles','icons','mediapool']);
      if (mounted) setInventory(Array.isArray(items) ? items : []);
    } catch {
      if (mounted) setInventory([]);
    }
  })();
  return ()=> { mounted = false; };
},[]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin-protection?mode=ui', { cache: 'no-store', credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          setProtectionState({ enabled: !!data.protected, loading: false, saving: false, updatedAt: data.updatedAt || null });
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
      applyAdminUiThemeForDocument('default');
      return;
    }
    const stored = config.appearanceSkin && ADMIN_SKIN_TO_UI.has(config.appearanceSkin)
      ? config.appearanceSkin
      : null;
    const detected = detectAppearanceSkin(config.appearance, config.appearanceSkin);
    applyAdminUiThemeForDocument(stored || detected);
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
    config?.appearance?.textAlign,
    config?.appearance?.textVertical,
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
  const [deviceTriggerPicker, setDeviceTriggerPicker] = useState('');

  const [uploadStatus, setUploadStatus] = useState('');
  const [protectionState, setProtectionState] = useState({ enabled: false, loading: true, saving: false, updatedAt: null });
  const [protectionError, setProtectionError] = useState('');

  // Combined Save & Publish
  const [deployDelaySec, setDeployDelaySec] = useState(5);
  const [savePubBusy, setSavePubBusy] = useState(false);

  // Pin size (selected)
  const [selectedPinSize, setSelectedPinSize] = useState(28);
  const defaultPinSize = 24;

  // Undo/Redo
  const historyRef = useRef({ past: [], future: [] });

  // Settings → Region search
  const [mapSearchQ, setMapSearchQ] = useState('');
  const [mapSearching, setMapSearching] = useState(false);
  const [mapResults, setMapResults] = useState([]);

  // Test preview nonce (force iframe reload)
  const [previewNonce, setPreviewNonce] = useState(0);

  // Delete confirm modal
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    try {
      const savedDelay = localStorage.getItem('deployDelaySec');
      if (savedDelay != null) setDeployDelaySec(Math.max(0, Math.min(120, Number(savedDelay) || 0)));
      const savedSel = localStorage.getItem('selectedPinSize');
      if (savedSel != null) setSelectedPinSize(clamp(Number(savedSel) || 28, 12, 64));
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem('deployDelaySec', String(deployDelaySec)); } catch {} }, [deployDelaySec]);
  useEffect(() => { try { localStorage.setItem('selectedPinSize', String(selectedPinSize)); } catch {} }, [selectedPinSize]);

  const gameBase =
    ((typeof window !== 'undefined'
      ? (window.__GAME_ORIGIN__ || process.env.NEXT_PUBLIC_GAME_ORIGIN)
      : process.env.NEXT_PUBLIC_GAME_ORIGIN) || (config?.gameOrigin) || '');

  const getDevices = () => (config?.devices?.length ? config.devices : (config?.powerups || []));
  const setDevices = (list) => setConfig({ ...config, devices: list, powerups: list });

  function snapshotState() {
    return {
      missions: JSON.parse(JSON.stringify(suite?.missions || [])),
      devices: JSON.parse(JSON.stringify(getDevices() || [])),
    };
  }
  function pushHistory() {
    if (!suite || !config) return;
    historyRef.current.past.push(snapshotState());
    historyRef.current.future = [];
  }
  function canUndo() { return historyRef.current.past.length > 0; }
  function canRedo() { return historyRef.current.future.length > 0; }
  function undo() {
    if (!canUndo()) return;
    const current = snapshotState();
    const prev = historyRef.current.past.pop();
    historyRef.current.future.push(current);
    setSuite((s) => ({ ...s, missions: prev.missions }));
    setDevices(prev.devices);
    setStatus('↶ Undid last change');
  }
  function redo() {
    if (!canRedo()) return;
    const current = snapshotState();
    const next = historyRef.current.future.pop();
    historyRef.current.past.push(current);
    setSuite((s) => ({ ...s, missions: next.missions }));
    setDevices(next.devices);
    setStatus('↷ Redid last change');
  }
  useEffect(() => {
    function onKey(e) {
      const z = e.key === 'z' || e.key === 'Z';
      const y = e.key === 'y' || e.key === 'Y';
      if ((e.ctrlKey || e.metaKey) && z) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if ((e.ctrlKey || e.metaKey) && y) { e.preventDefault(); redo(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* load games */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/games', { credentials:'include', cache:'no-store' });
        const j = await r.json();
        if (j.ok) setGames(j.games || []);
      } catch {}
    })();
  }, []);

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
          timer: { ...dc.timer, ...(c0.timer || {}) },
          devices: (c0.devices && Array.isArray(c0.devices)) ? c0.devices
                   : (c0.powerups && Array.isArray(c0.powerups)) ? c0.powerups : [],
          media: { rewardsPool:[], penaltiesPool:[], ...(c0.media || {}) },
          icons: { ...DEFAULT_ICONS, ...(c0.icons || {}) },
          appearance: { ...dc.appearance, ...(c0.appearance || {}) },
          map: { ...dc.map, ...(c0.map || {}) },
          geofence: { ...dc.geofence, ...(c0.geofence || {}) },
          mediaTriggers: { ...DEFAULT_TRIGGER_CONFIG, ...(c0.mediaTriggers || {}) },
        };

        const storedSkin = c0.appearanceSkin && ADMIN_SKIN_TO_UI.has(c0.appearanceSkin)
          ? c0.appearanceSkin
          : null;
        merged.appearanceSkin = storedSkin || detectAppearanceSkin(merged.appearance, c0.appearanceSkin);

        merged = applyDefaultIcons(merged);

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
      splash: { enabled:true, mode:'single' },
      game:   { title:'Untitled Game', type:'Mystery' },
      forms:  { players:1 },
      timer:  { durationMinutes:0, alertMinutes:10 },
      textRules: [],
      devices: [], powerups: [],
      media: { rewardsPool:[], penaltiesPool:[] },
      icons: DEFAULT_ICONS,
      appearance: defaultAppearance(),
      appearanceSkin: 'default',
      mediaTriggers: { ...DEFAULT_TRIGGER_CONFIG },
      map: { centerLat: 44.9778, centerLng: -93.2650, defaultZoom: 13 },
      geofence: { mode: 'test' },
    };
  }
  function defaultContentForType(t) {
    const base = { geofenceEnabled:false, lat:'', lng:'', radiusMeters:25, cooldownSeconds:30 };
    switch (t) {
      case 'multiple_choice': return { question:'', choices:[], correctIndex:undefined, mediaUrl:'', ...base };
      case 'short_answer':    return { question:'', answer:'', acceptable:'', mediaUrl:'', ...base };
      case 'statement':       return { text:'', mediaUrl:'', ...base };
      case 'video':           return { videoUrl:'', overlayText:'', ...base };
      case 'geofence_image':  return { lat:'', lng:'', radiusMeters:25, cooldownSeconds:30, imageUrl:'', overlayText:'' };
      case 'geofence_video':  return { lat:'', lng:'', radiusMeters:25, cooldownSeconds:30, videoUrl:'', overlayText:'' };
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
    setStatus('Saving…');
    const url = isDefaultSlug(slug)
      ? `/api/save-bundle`
      : `/api/save-bundle${qs({ slug })}`;
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ missions: suite, config })
      });
      const text = await r.text();
      if (!r.ok) throw new Error(text || 'save failed');
      setStatus('✅ Saved');
      return true;
    } catch (e) {
      setStatus('❌ Save failed: ' + (e?.message || e));
      return false;
    }
  }

  async function publishWithSlug(slug, channel='published') {
    const first = isDefaultSlug(slug)
      ? `/api/game${qs({ channel })}`
      : `/api/game${qs({ slug, channel })}`;
    const fallback = isDefaultSlug(slug)
      ? null
      : `/api/game/${encodeURIComponent(slug)}${qs({ channel })}`;

    try {
      const res = await fetch(first, {
        method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
        body: JSON.stringify({ action:'publish' })
      });
      const txt = await res.text();
      let data = {};
      try { data = JSON.parse(txt); } catch {}
      if (!res.ok) { if (fallback) throw new Error('try fallback'); else throw new Error(txt||'publish failed'); }
      setStatus(`✅ Published${data?.version ? ` v${data.version}` : ''}`);
      return true;
    } catch (e) {
      if (!fallback) { setStatus('❌ Publish failed: ' + (e?.message||e)); return false; }
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
    try {
      const r = await fetch('/api/games', { credentials:'include', cache:'no-store' });
      const j = await r.json();
      if (j.ok) setGames(j.games || []);
    } catch {}
  }

  async function saveAndPublish() {
    if (!suite || !config) return;
    const slug = activeSlug || 'default';
    setSavePubBusy(true);

    const saved = await saveAllWithSlug(slug);
    if (!saved) { setSavePubBusy(false); return; }

    if (deployDelaySec > 0) await new Promise(r => setTimeout(r, deployDelaySec * 1000));

    await publishWithSlug(slug, 'published');

    await reloadGamesList();
    setPreviewNonce(n => n + 1);
    setSavePubBusy(false);
  }

  /* Delete game (with modal confirm) */
  async function reallyDeleteGame() {
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
      pushHistory();
      setSuite({ version:'0.0.0', missions:[] });
      setConfig(c => ({
        ...c, devices: [], powerups: [], media: { rewardsPool:[], penaltiesPool:[] }, textRules: [],
      }));
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
    const draft = {
      id: suggestId(),
      title: 'New Mission',
      type: 'multiple_choice',
      iconKey: '',
      rewards: { points: 25 },
      correct: { mode: 'none' },
      wrong:   { mode: 'none' },
      content: defaultContentForType('multiple_choice'),
      appearanceOverrideEnabled: false,
      appearance: defaultAppearance(),
      showContinue: true,
      trigger: { ...DEFAULT_TRIGGER_CONFIG },
    };
    setEditing(draft); setSelected(null); setDirty(true);
  }
  function editExisting(m) {
    const e = JSON.parse(JSON.stringify(m));
    e.appearanceOverrideEnabled = !!e.appearanceOverrideEnabled;
    e.appearance = { ...defaultAppearance(), ...(e.appearance || {}) };
    if (!e.correct) e.correct = { mode: 'none' };
    if (!e.wrong)   e.wrong   = { mode: 'none' };
    if (e.showContinue === undefined) e.showContinue = true;
    e.trigger = { ...DEFAULT_TRIGGER_CONFIG, ...(e.trigger || {}) };
    setEditing(e); setSelected(m.id); setDirty(false);
  }
  function cancelEdit() { setEditing(null); setSelected(null); setDirty(false); }
  function bumpVersion(v) {
    const p = String(v || '0.0.0').split('.').map(n=>parseInt(n||'0',10)); while (p.length<3) p.push(0); p[2]+=1; return p.join('.');
  }
  function saveToList() {
    if (!editing || !suite) return;
    if (!editing.id || !editing.title || !editing.type) return setStatus('❌ Fill id, title, type');

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

    const list = (i >= 0 ? (missions[i]=obj, missions) : [...missions, obj]);
    setSuite({ ...suite, missions: list, version: bumpVersion(suite.version || '0.0.0') });
    setSelected(editing.id); setEditing(null); setDirty(false);
    setStatus('✅ Mission saved');
  }
  function removeMission(id) {
    if (!suite) return;
    pushHistory();
    setSuite({ ...suite, missions: (suite.missions || []).filter(m => m.id !== id) });
    if (selected === id) { setSelected(null); setEditing(null); }
  }
  function moveMission(idx, dir) {
    if (!suite) return;
    pushHistory();
    const list = [...(suite.missions || [])];
    const j = idx + dir; if (j < 0 || j >= list.length) return;
    const [row] = list.splice(idx, 1); list.splice(j, 0, row);
    setSuite({ ...suite, missions: list });
  }
  function duplicateMission(idx) {
    pushHistory();
    const list = [...(suite.missions || [])];
    const src  = list[idx]; if (!src) return;
    const cp   = JSON.parse(JSON.stringify(src));
    cp.id      = suggestId();
    cp.title   = (src.title || 'Copy') + ' (copy)';
    list.splice(idx + 1, 0, cp);
    setSuite({ ...suite, missions: list });
    setStatus('✅ Duplicated');
  }

  /* Devices (Devices tab only) */
  const devices = getDevices();
  function deviceIconUrlFromKey(key) {
    if (!key) return '';
    const it = (config?.icons?.devices || []).find(x => (x.key||'') === key);
    return it?.url || '';
  }
  function missionIconUrlFromKey(key) {
    if (!key) return '';
    const it = (config?.icons?.missions || []).find(x => (x.key||'') === key);
    return it?.url || '';
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
      const thumbnail = toDirectMediaURL(missionIconUrlFromKey(m?.iconKey) || '');
      return { id, label, thumbnail, meta: m };
    });
    const responseOptions = [];
    ((suite?.missions) || []).forEach((m) => {
      if (!m) return;
      const baseLabel = m.title || m.id || 'Mission';
      const correctUrl = toDirectMediaURL(m?.correct?.mediaUrl || m?.correct?.audioUrl || missionIconUrlFromKey(m?.iconKey) || '');
      responseOptions.push({
        id: `${m.id || baseLabel}::correct`,
        label: `${baseLabel} — Correct`,
        thumbnail: correctUrl,
        meta: { mission: m, side: 'correct', url: correctUrl },
      });
      const wrongUrl = toDirectMediaURL(m?.wrong?.mediaUrl || m?.wrong?.audioUrl || missionIconUrlFromKey(m?.iconKey) || '');
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
    setDeviceEditorMode('new');
    setIsDeviceEditorOpen(true);
    setSelectedDevIdx(null);
    setSelectedMissionIdx(null);
    const baseLat = Number(config.map?.centerLat ?? 44.9778);
    const baseLng = Number(config.map?.centerLng ?? -93.2650);
    setDevDraft(createDeviceDraft({
      lat: Number((isFinite(baseLat) ? baseLat : 44.9778).toFixed(6)),
      lng: Number((isFinite(baseLng) ? baseLng : -93.2650).toFixed(6)),
    }));
  }
  function openDeviceEditor(idx) {
    if (idx == null) return;
    const item = devices?.[idx];
    if (!item) return;
    setDeviceEditorMode('edit');
    setIsDeviceEditorOpen(true);
    setSelectedDevIdx(idx);
    setSelectedMissionIdx(null);
    setDevDraft(createDeviceDraft({ ...item }));
  }
  function closeDeviceEditor() {
    setIsDeviceEditorOpen(false);
    setDeviceEditorMode('new');
    setDevDraft(createDeviceDraft());
  }
  function saveDraftDevice() {
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
        return;
      }
      const lat = Number(Number(devDraft.lat).toFixed(6));
      const lng = Number(Number(devDraft.lng).toFixed(6));
      const list = [...(devices || [])];
      const item = { id: suggestDeviceId(list), ...normalized, lat, lng };
      pushHistory();
      const next = [...list, item];
      setDevices(next);
      setSelectedDevIdx(next.length - 1);
      setSelectedMissionIdx(null);
      setStatus('✅ Device added');
      closeDeviceEditor();
      return;
    }
    if (deviceEditorMode === 'edit' && selectedDevIdx != null) {
      const index = selectedDevIdx;
      const list = [...(devices || [])];
      const existing = list[index];
      if (!existing) return;
      const lat = devDraft.lat == null ? existing.lat : Number(Number(devDraft.lat).toFixed(6));
      const lng = devDraft.lng == null ? existing.lng : Number(Number(devDraft.lng).toFixed(6));
      pushHistory();
      list[index] = { ...existing, ...normalized, lat, lng };
      setDevices(list);
      setStatus('✅ Device updated');
      closeDeviceEditor();
    }
  }
  function duplicateDevice(idx) {
    const list = [...(devices || [])];
    const src = list[idx];
    if (!src) return;
    const copy = JSON.parse(JSON.stringify(src));
    copy.id = suggestDeviceId(list);
    copy.title = (src.title || src.id || 'Device') + ' (copy)';
    pushHistory();
    list.splice(idx + 1, 0, copy);
    setDevices(list);
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
    pushHistory();
    list.splice(idx, 1);
    setDevices(list);
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
    pushHistory();
    setDevices(list);
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
    pushHistory();
    list[selectedDevIdx] = { ...existing, lat: latFixed, lng: lngFixed };
    setDevices(list);
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
    pushHistory();
    list[selectedDevIdx] = { ...existing, pickupRadius: nextRadius };
    setDevices(list);
    if (isDeviceEditorOpen && deviceEditorMode === 'edit') {
      setDevDraft(d => ({ ...d, pickupRadius: nextRadius }));
    }
  }

  function applyAppearanceSkin(key) {
    const preset = APPEARANCE_SKIN_MAP.get(key);
    if (!preset) return;
    applyAdminUiThemeForDocument(key);
    setConfig(prev => ({ ...prev, appearance: { ...preset.appearance }, appearanceSkin: key }));
    setStatus(`✅ Applied theme: ${preset.label}`);
  }

  async function toggleProtection() {
    const target = !protectionState.enabled;
    setProtectionError('');
    setProtectionState(prev => ({ ...prev, saving: true }));
    try {
      const res = await fetch('/api/admin-protection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ protected: target }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || res.statusText || 'Toggle failed');
      }
      setProtectionState({ enabled: !!data.protected, loading: false, saving: false, updatedAt: data.updatedAt || null });
      setStatus(`✅ Admin password protection ${data.protected ? 'enabled' : 'disabled'}`);
    } catch (err) {
      setProtectionState(prev => ({ ...prev, saving: false }));
      const msg = err?.message || 'Toggle failed';
      setProtectionError(msg);
      setStatus('❌ Failed to toggle admin protection');
    }
  }

  // Missions selection operations (Missions tab only)
  function moveSelectedMission(lat, lng) {
    if (selectedMissionIdx == null) return;
    pushHistory();
    const list = [...(suite?.missions || [])];
    const m = list[selectedMissionIdx]; if (!m) return;
    const c = { ...(m.content || {}) };
    c.lat = Number(lat.toFixed(6));
    c.lng = Number(lng.toFixed(6));
    c.geofenceEnabled = true;
    c.radiusMeters = clamp(Number(c.radiusMeters || 25), 5, 500);
    list[selectedMissionIdx] = { ...m, content: c };
    setSuite({ ...suite, missions: list });
    setStatus(`Moved mission #${selectedMissionIdx+1}`);
  }
  function setSelectedMissionRadius(r) {
    if (selectedMissionIdx == null) return;
    pushHistory();
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
    setConfig(c => ({ ...c, map: { ...(c.map||{}), centerLat: Number(lat.toFixed(6)), centerLng: Number(lng.toFixed(6)) } }));
    setMapResults([]);
  }

  // Project Health scan
  async function scanProject() {
    const inv = await listInventory(['uploads','bundles','icons']);
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

  async function uploadToRepo(file, subfolder='uploads') {
    const array  = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(array)));
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const path   = `public/media/${subfolder}/${Date.now()}-${safeName}`;
    setUploadStatus(`Uploading ${safeName}…`);
    const res = await fetch('/api/upload', {
      method:'POST', headers:{ 'Content-Type':'application/json' }, credentials:'include',
      body: JSON.stringify({ path, contentBase64: base64, message:`upload ${safeName}` }),
    });
    const j = await res.json().catch(()=>({}));
    setUploadStatus(res.ok ? `✅ Uploaded ${safeName}` : `❌ ${j?.error || 'upload failed'}`);
    return res.ok ? `/${path.replace(/^public\//,'')}` : '';
  }

  if (!suite || !config) {
    return (
      <main style={{ maxWidth: 900, margin: '40px auto', color: 'var(--admin-muted)', padding: 16 }}>
        <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--admin-border-soft)', background: 'var(--admin-panel-bg)', boxShadow: 'var(--admin-panel-shadow)' }}>
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
  const protectionIndicatorColor = protectionState.enabled ? 'var(--admin-success-color)' : 'var(--admin-danger-color)';
  const protectionToggleLabel = protectionState.enabled ? 'Disable Protection' : 'Enable Protection';

  const selectedPinSizeDisabled = (selectedMissionIdx==null && selectedDevIdx==null);

  // Tabs: missions / devices / settings / text / media-pool / assigned
  const tabsOrder = ['settings','missions','devices','text','assigned','media-pool'];

  const isDefault = !activeSlug || activeSlug === 'default';
  const activeSlugForClient = isDefault ? '' : activeSlug; // omit for Default Game

  return (
    <div style={S.body}>
      <header style={S.header}>
        <div style={S.wrap}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:16 }}>
            <div style={{ fontSize:14, letterSpacing:2, textTransform:'uppercase', color:'var(--admin-muted)', fontWeight:700 }}>
              Admin Control Deck
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              <div
                style={{
                  display:'flex',
                  alignItems:'center',
                  gap:8,
                  padding:'6px 14px',
                  borderRadius:999,
                  border:`1px solid ${protectionIndicatorColor}`,
                  background:'var(--admin-panel-bg)',
                  color: protectionIndicatorColor,
                  fontWeight:700,
                  letterSpacing:1,
                  textTransform:'uppercase',
                  boxShadow:'0 0 12px currentColor',
                }}
              >
                <span style={{ display:'inline-block', width:14, height:14, borderRadius:'50%', background:'currentColor', boxShadow:'0 0 12px currentColor' }} />
                {protectionState.loading ? 'Checking…' : protectionState.enabled ? 'Protected' : 'Not Protected'}
              </div>
              <button
                onClick={toggleProtection}
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
          </div>
          {protectionError && (
            <div style={{ color: 'var(--admin-danger-color)', fontSize: 12, marginBottom: 12 }}>
              {protectionError}
            </div>
          )}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
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
            <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:8, flexWrap:'wrap' }}>
              <label style={{ color:'var(--admin-muted)', fontSize:12 }}>Game:</label>
              <select value={activeSlug} onChange={(e)=>setActiveSlug(e.target.value)} style={{ ...S.input, width:280 }}>
                <option value="default">(Default Game)</option>
                {games.map(g=>(
                  <option key={g.slug} value={g.slug}>{g.title} — {g.slug} ({g.mode||'single'})</option>
                ))}
              </select>
              <button style={S.button} onClick={()=>setShowNewGame(true)}>+ New Game</button>
            </div>

            {/* Save & Publish with optional delay */}
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <label style={{ color:'var(--admin-muted)', fontSize:12, display:'flex', alignItems:'center', gap:6 }}>
                Deploy delay (sec):
                <input
                  type="number" min={0} max={120}
                  value={deployDelaySec}
                  onChange={(e)=> setDeployDelaySec(Math.max(0, Math.min(120, Number(e.target.value || 0))))}
                  style={{ ...S.input, width:90 }}
                />
              </label>
              <button
                onClick={async ()=>{
                  await saveAndPublish();
                  const isDefaultNow = !activeSlug || activeSlug === 'default';
                  setActiveSlug(isDefaultNow ? 'default' : activeSlug);
                }}
                disabled={savePubBusy}
                style={{ ...S.button, ...S.buttonSuccess, opacity: savePubBusy ? 0.7 : 1 }}
              >
                {savePubBusy ? 'Saving & Publishing…' : '💾 Save & Publish'}
              </button>
            </div>

            <a
              href={isDefault ? '/missions.json' : `/games/${encodeURIComponent(activeSlug)}/missions.json`}
              target="_blank" rel="noreferrer" style={{ ...S.button }}>
              View missions.json
            </a>
            <a
              href={isDefault ? '/api/config' : `/api/config${qs({ slug: activeSlug })}`}
              target="_blank" rel="noreferrer" style={{ ...S.button }}>
              View config.json
            </a>
          </div>
          <div style={{ color:'var(--admin-muted)', marginTop:6, whiteSpace:'pre-wrap' }}>{status}</div>
        </div>
      </header>

      {/* MISSIONS */}
      {tab==='missions' && (
        <main style={S.wrapGrid2}>
          {/* Left list */}
          <aside style={S.sidebarTall}>
            <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
              <button onClick={startNew} style={S.button}>+ New Mission</button>
              <button style={{ ...S.button }} onClick={undo} disabled={!canUndo()}>↶ Undo</button>
              <button style={{ ...S.button }} onClick={redo} disabled={!canRedo()}>↷ Redo</button>
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
                    <input type="range" min={16} max={48} step={2} value={selectedPinSize}
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
                icons={config.icons || DEFAULT_ICONS}
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
                  <div style={{ position:'sticky', top:0, zIndex:5, background:'var(--admin-panel-bg)', paddingBottom:8, marginBottom:8, borderBottom:'1px solid var(--admin-border-soft)' }}>
                    <h3 style={{ margin:'8px 0' }}>Edit Mission</h3>
                    <div style={{ display:'flex', gap:8 }}>
                      <button style={S.button} onClick={saveToList}>💾 Save Mission</button>
                      <button style={S.button} onClick={cancelEdit}>Close</button>
                    </div>
                  </div>

                  <Field label="ID"><input style={S.input} value={editing.id} onChange={(e)=>{ setEditing({ ...editing, id:e.target.value }); setDirty(true); }}/></Field>
                  <Field label="Title"><input style={S.input} value={editing.title} onChange={(e)=>{ setEditing({ ...editing, title:e.target.value }); setDirty(true); }}/></Field>
                  <Field label="Type">
                    <select style={S.input} value={editing.type}
                      onChange={(e)=>{ const t=e.target.value; setEditing({ ...editing, type:t, content:defaultContentForType(t) }); setDirty(true); }}>
                      {Object.keys(TYPE_FIELDS).map((k)=>(
                        <option key={k} value={k}>{TYPE_LABELS[k] || k}</option>
                      ))}
                    </select>
                  </Field>

                  {/* Icon select with thumbnail (inventory-only) */}
                  <Field label="Icon">
                    <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center' }}>
                      <select
                        style={S.input}
                        value={editing.iconKey || ''}
                        onChange={(e)=>{ setEditing({ ...editing, iconKey:e.target.value }); setDirty(true); }}
                      >
                        <option value="">(default)</option>
                        {(config.icons?.missions||[]).map((it)=>(
                          <option key={it.key} value={it.key}>{it.name||it.key}</option>
                        ))}
                      </select>
                      <div>
                        {(() => {
                          const sel = (config.icons?.missions||[]).find(it => it.key === editing.iconKey);
                          return sel?.url
                            ? <img alt="icon" src={toDirectMediaURL(sel.url)} style={{ width:48, height:48, objectFit:'contain', border:'1px solid var(--admin-border-soft)', borderRadius:8 }}/>
                            : <div style={{ width:48, height:48, border:'1px dashed var(--admin-border-soft)', borderRadius:8, display:'grid', placeItems:'center', color:'var(--admin-muted)' }}>icon</div>;
                        })()}
                      </div>
                    </div>
                  </Field>

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
                  <InlineMissionResponses editing={editing} setEditing={setEditing} inventory={inventory} />

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
                      onChange={(next)=>{ setEditing({ ...editing, appearance:next }); setDirty(true); }}/>
                  )}

                  <div style={{ display:'flex', gap:8, marginTop:12 }}>
                    <button style={S.button} onClick={saveToList}>💾 Save Mission</button>
                    <button style={S.button} onClick={cancelEdit}>Close</button>
                  </div>
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
            <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
              <button style={{ ...S.button }} onClick={undo} disabled={!canUndo()}>↶ Undo</button>
              <button style={{ ...S.button }} onClick={redo} disabled={!canRedo()}>↷ Redo</button>
            </div>

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

            <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
              <button style={S.button} onClick={addDevice}>+ Add Device</button>
              {selectedDevIdx!=null && (
                <button style={S.button} onClick={()=>{ setSelectedDevIdx(null); closeDeviceEditor(); }}>Clear selection</button>
              )}
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
                      background:selected ? 'var(--admin-tab-active-bg)' : 'var(--admin-panel-bg)',
                      cursor:'pointer',
                    }}
                  >
                    <div style={{ width:52, height:52, borderRadius:10, background:'var(--admin-panel-bg)', border:'1px solid var(--admin-border-soft)', display:'grid', placeItems:'center', overflow:'hidden' }}>
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
                <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                  <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <input type="checkbox" checked={showRings} onChange={(e)=>setShowRings(e.target.checked)}/> Show radius rings
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                    Selected pin size:
                    <input type="range" min={16} max={48} step={2} value={selectedPinSize}
                      disabled={selectedDevIdx==null}
                      onChange={(e)=>setSelectedPinSize(Number(e.target.value))}
                    />
                    <code style={{ color:'var(--admin-muted)' }}>{selectedDevIdx==null ? '—' : `${selectedPinSize}px`}</code>
                  </label>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center', marginBottom:8 }}>
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

              {isDeviceEditorOpen && (() => {
                const trigger = mergeTriggerState(devDraft.trigger);
                const actionOptions = triggerOptionSets[trigger.actionType] || [];
                const selectedAction = actionOptions.find(opt => opt.id === trigger.actionTarget) || null;
                const previewThumb = trigger.actionThumbnail || selectedAction?.thumbnail || '';
                const resolvedPreview = previewThumb ? toDirectMediaURL(previewThumb) : '';
                return (
                  <div style={{ border:'1px solid var(--admin-border-soft)', borderRadius:10, padding:12, marginBottom:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:12 }}>
                      <div>
                        <h4 style={{ margin:'0 0 4px 0' }}>{deviceEditorMode === 'new' ? 'New Device' : `Edit Device ${devDraft.id ? `(${devDraft.id})` : ''}`}</h4>
                        {deviceEditorMode === 'edit' && devDraft.id && (
                          <div style={{ fontSize:12, color:'var(--admin-muted)' }}>ID: {devDraft.id}</div>
                        )}
                      </div>
                      <button style={{ ...S.button, padding:'6px 12px' }} onClick={closeDeviceEditor}>Close</button>
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
                          {(config.icons?.devices||[]).map(it=><option key={it.key} value={it.key}>{it.name||it.key}</option>)}
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
                                <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, zIndex:30, maxHeight:240, overflowY:'auto', border:'1px solid var(--admin-border-soft)', borderRadius:10, background:'var(--admin-panel-bg)', boxShadow:'0 16px 32px rgba(0,0,0,0.4)' }}>
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

                    <div style={{ marginTop:8, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                      <button style={S.button} onClick={saveDraftDevice}>💾 Save Device</button>
                      <div style={{ color:'var(--admin-muted)', fontSize:12 }}>
                        {devDraft.lat==null ? 'Click the map or search an address to set location'
                          : <>lat {Number(devDraft.lat).toFixed(6)}, lng {Number(devDraft.lng).toFixed(6)}</>}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <MapOverview
                missions={(suite?.missions)||[]}
                devices={devices}
                icons={config.icons||DEFAULT_ICONS}
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
            <Field label="Game Title"><input style={S.input} value={config.game.title}
              onChange={(e)=>setConfig({ ...config, game:{ ...config.game, title:e.target.value } })}/></Field>
            <Field label="Game Type">
              <select style={S.input} value={config.game.type}
                onChange={(e)=>setConfig({ ...config, game:{ ...config.game, type:e.target.value } })}>
                {GAME_TYPES.map((g)=><option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Stripe Splash Page">
              <label style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input type="checkbox" checked={config.splash.enabled}
                  onChange={(e)=>setConfig({ ...config, splash:{ ...config.splash, enabled:e.target.checked } })}/>
                Enable Splash (game code & Stripe)
              </label>
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
              <button
                style={{ ...S.button, ...S.buttonDanger }}
                onClick={()=> setConfirmDeleteOpen(true)}
              >
                🗑 Delete Game
              </button>
              <button style={S.button} onClick={scanProject}>🔎 Scan media usage (find unused)</button>
            </div>
          </div>

          <div style={{ ...S.card, marginTop:16 }}>
            <h3 style={{ marginTop:0 }}>Appearance (Global)</h3>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, color:'var(--admin-muted)', marginBottom:8 }}>Theme skins</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:8 }}>
                {APPEARANCE_SKINS.map((skin)=>{
                  const active = selectedAppearanceSkin === skin.key;
                  const previewBg = skin.appearance.screenBgImage
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
              onChange={(next)=>setConfig(prev => ({
                ...prev,
                appearance: next,
                appearanceSkin: prev.appearanceSkin && ADMIN_SKIN_TO_UI.has(prev.appearanceSkin)
                  ? prev.appearanceSkin
                  : detectAppearanceSkin(next, prev.appearanceSkin),
              }))}
            />
            <div style={{ color:'var(--admin-muted)', marginTop:8, fontSize:12 }}>
              Tip: keep vertical alignment on <b>Top</b> so text doesn’t cover the backpack.
            </div>
          </div>
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
          uploadToRepo={async (file, folder)=> {
            const url = await (async ()=>{ try { return await uploadToRepo(file, folder); } catch { return ''; }})();
            return url;
          }}
        />
      )}

      {/* ASSIGNED MEDIA — renamed Media tab */}
      {tab==='assigned' && (
        <AssignedMediaTab
          config={config}
          setConfig={setConfig}
          onReapplyDefaults={()=>setConfig(c=>applyDefaultIcons(c))}
          inventory={inventory}
          devices={devices}
          missions={suite?.missions || []}
        />
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

      {/* New Game modal */}
      {showNewGame && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'grid', placeItems:'center', zIndex:1000 }}>
          <div style={{ ...S.card, width:420 }}>
            <h3 style={{ marginTop:0 }}>Create New Game</h3>
            <Field label="Game Title"><input style={S.input} value={newTitle} onChange={(e)=>setNewTitle(e.target.value)}/></Field>
            <Field label="Game Type">
              <select style={S.input} value={newType} onChange={(e)=>setNewType(e.target.value)}>
                {GAME_TYPES.map((t)=><option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Mode">
              <select style={S.input} value={newMode} onChange={(e)=>setNewMode(e.target.value)}>
                <option value="single">Single Player</option>
                <option value="head2head">Head to Head (2)</option>
                <option value="multi">Multiple (4)</option>
              </select>
            </Field>
            <Field label="Duration (minutes — 0 = infinite; count UP)">
              <input type="number" min={0} max={24*60} style={S.input} value={newDurationMin}
                onChange={(e)=>setNewDurationMin(Math.max(0, Number(e.target.value||0)))}/>
            </Field>
            <Field label="Alert before end (minutes)">
              <input type="number" min={1} max={120} style={S.input} value={newAlertMin}
                onChange={(e)=>setNewAlertMin(Math.max(1, Number(e.target.value||1)))}/>
            </Field>
            <div style={{ display:'flex', gap:8, marginTop:12 }}>
              <button style={S.button} onClick={()=>setShowNewGame(false)}>Cancel</button>
              <button style={S.button} onClick={async ()=>{
                if (!newTitle.trim()) return;
                const r = await fetch('/api/games', {
                  method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
                  body: JSON.stringify({ title:newTitle.trim(), type:newType, mode:newMode, timer:{ durationMinutes:newDurationMin, alertMinutes:newAlertMin } }),
                });
                const j = await r.json().catch(()=>({ ok:false }));
                if (!j.ok) { setStatus('❌ ' + (j.error||'create failed')); return; }
                await reloadGamesList();
                setActiveSlug(j.slug || 'default'); setNewTitle(''); setShowNewGame(false);
              }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDeleteOpen && (
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
function ColorField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <div style={{ display:'grid', gridTemplateColumns:'100px 1fr', gap:8, alignItems:'center' }}>
        <input type="color" value={value} onChange={(e)=>onChange(e.target.value)} />
        <input style={S.input} value={value} onChange={(e)=>onChange(e.target.value)} />
      </div>
    </Field>
  );
}
function AppearanceEditor({ value, onChange }) {
  const a = value || defaultAppearance();
  return (
    <div style={{ border:'1px solid var(--admin-border-soft)', borderRadius:10, padding:12 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
        <Field label="Font family">
          <select style={S.input} value={a.fontFamily} onChange={(e)=>onChange({ ...a, fontFamily:e.target.value })}>
            {FONT_FAMILIES.map((f)=><option key={f.v} value={f.v}>{f.label}</option>)}
          </select>
          <div style={{ marginTop:6, padding:'6px 10px', border:'1px dashed var(--admin-border-soft)', borderRadius:8, fontFamily:a.fontFamily }}>
            Aa — preview text with this font
          </div>
        </Field>
        <Field label="Font size (px)">
          <input type="number" min={10} max={72} style={S.input}
            value={a.fontSizePx} onChange={(e)=>onChange({ ...a, fontSizePx:clamp(Number(e.target.value||0),10,72) })}/>
        </Field>
        <ColorField label="Text color" value={a.fontColor} onChange={(v)=>onChange({ ...a, fontColor:v })}/>
        <ColorField label="Text background color" value={a.textBgColor} onChange={(v)=>onChange({ ...a, textBgColor:v })}/>
        <Field label="Text background opacity">
          <input type="range" min={0} max={1} step={0.05} value={a.textBgOpacity}
            onChange={(e)=>onChange({ ...a, textBgOpacity:Number(e.target.value) })}/>
          <div style={{ color:'var(--admin-muted)', fontSize:12, marginTop:4 }}>{(a.textBgOpacity*100).toFixed(0)}%</div>
        </Field>
        <ColorField label="Screen background color" value={a.screenBgColor} onChange={(v)=>onChange({ ...a, screenBgColor:v })}/>
        <Field label="Screen background opacity">
          <input type="range" min={0} max={1} step={0.05} value={a.screenBgOpacity}
            onChange={(e)=>onChange({ ...a, screenBgOpacity:Number(e.target.value) })}/>
          <div style={{ color:'var(--admin-muted)', fontSize:12, marginTop:4 }}>{(a.screenBgOpacity*100).toFixed(0)}%</div>
        </Field>
        <Field label="Screen background image (URL)">
          <input style={S.input} value={a.screenBgImage || ''} onChange={(e)=>onChange({ ...a, screenBgImage:e.target.value })}/>
          {a.screenBgImage && (
            <img src={toDirectMediaURL(a.screenBgImage)} alt="bg"
              style={{ marginTop:6, width:'100%', maxHeight:120, objectFit:'cover', border:'1px solid var(--admin-border-soft)', borderRadius:8 }}/>
          )}
        </Field>
        <Field label="Text alignment (horizontal)">
          <select style={S.input} value={a.textAlign} onChange={(e)=>onChange({ ...a, textAlign:e.target.value })}>
            <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
          </select>
        </Field>
        <Field label="Text position (vertical)">
          <select style={S.input} value={a.textVertical} onChange={(e)=>onChange({ ...a, textVertical:e.target.value })}>
            <option value="top">Top</option><option value="center">Center</option>
          </select>
        </Field>
      </div>

      <div style={{
        marginTop:12, border:'1px dashed var(--admin-border-soft)', borderRadius:10, overflow:'hidden',
        background:a.screenBgImage
          ? `linear-gradient(rgba(0,0,0,${a.screenBgOpacity}), rgba(0,0,0,${a.screenBgOpacity})), url(${toDirectMediaURL(a.screenBgImage)}) center/cover no-repeat`
          : `linear-gradient(rgba(0,0,0,${a.screenBgOpacity}), rgba(0,0,0,${a.screenBgOpacity})), ${a.screenBgColor}`,
        padding:12, height:120, display:'grid', placeItems: a.textVertical==='center' ? 'center' : 'start',
      }}>
        <div style={{
          maxWidth:'100%',
          background:`rgba(${hexToRgb(a.textBgColor)}, ${a.textBgOpacity})`,
          padding:'6px 10px', borderRadius:8, color:a.fontColor, fontFamily:a.fontFamily, fontSize:a.fontSizePx,
          textAlign:a.textAlign, width:'fit-content',
          justifySelf: a.textAlign==='left' ? 'start' : a.textAlign==='right' ? 'end' : 'center',
        }}>
          Preview text
        </div>
      </div>
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
    background: 'var(--admin-body-bg)',
    color: 'var(--admin-body-color)',
    minHeight: '100vh',
    fontFamily: 'var(--admin-font-family)',
  },
  header: {
    padding: 16,
    background: 'var(--admin-header-bg)',
    borderBottom: 'var(--admin-header-border)',
    position: 'sticky',
    top: 0,
    zIndex: 40,
  },
  wrap: { maxWidth: 1400, margin: '0 auto', padding: 16 },
  wrapGrid2: { display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, alignItems: 'start', maxWidth: 1400, margin: '0 auto', padding: 16 },
  sidebarTall: {
    background: 'var(--admin-panel-bg)',
    border: 'var(--admin-panel-border)',
    borderRadius: 18,
    padding: 14,
    position: 'sticky',
    top: 20,
    height: 'calc(100vh - 140px)',
    overflow: 'auto',
    boxShadow: 'var(--admin-panel-shadow)',
  },
  card: {
    position: 'relative',
    background: 'var(--admin-panel-bg)',
    border: 'var(--admin-panel-border)',
    borderRadius: 18,
    padding: 18,
    boxShadow: 'var(--admin-panel-shadow)',
  },
  missionItem: { borderBottom: '1px solid var(--admin-border-soft)', padding: '10px 4px' },
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
  chip: { fontSize: 11, color: 'var(--admin-muted)', border: 'var(--admin-chip-border)', padding: '2px 6px', borderRadius: 999, background: 'var(--admin-chip-bg)' },
  chipRow: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' },
  muted: { color: 'var(--admin-muted)' },
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
      <div ref={divRef} style={{ height:560, borderRadius:12, border:'1px solid var(--admin-border-soft)', background:'var(--admin-panel-bg)' }}/>
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
      <div ref={divRef} style={{ height:260, borderRadius:12, border:'1px solid var(--admin-border-soft)', background:'var(--admin-panel-bg)' }} />
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
}) {
  const [inv, setInv] = useState([]);
  const [busy, setBusy] = useState(false);
  const [folder, setFolder] = useState('uploads');
  const [addUrl, setAddUrl] = useState('');


  
  // Sub-tabs inside Media Pool. Default → 'audio' as requested.
  const subTabs = [
    { key:'image', label:'Images' },
    { key:'video', label:'Videos' },
    { key:'audio', label:'Audio' },
    { key:'gif',   label:'GIFs'  },
  ];
  const [subTab, setSubTab] = useState('image');

  useEffect(() => { refreshInventory(); }, []);

  async function refreshInventory() {
    setBusy(true);
    try {
      const items = await listInventory(['uploads','bundles','icons']);
      setInv(items || []);
    } finally { setBusy(false); }
  }

  function norm(u){ return toDirectMediaURL(String(u||'')).trim(); }
  function same(a,b){ return norm(a) === norm(b); }

  // Per-file usage counts
  function usageCounts(url) {
    const nurl = norm(url);
    const rewardsPool = (config.media?.rewardsPool || []).reduce((acc, it) => acc + (same(it.url, nurl) ? 1 : 0), 0);
    const penaltiesPool = (config.media?.penaltiesPool || []).reduce((acc, it) => acc + (same(it.url, nurl) ? 1 : 0), 0);

    // Missions using this URL as ICON (via iconUrl or iconKey→icons.missions[].url)
    const iconMission = (suite?.missions || []).reduce((acc, m) => {
      const direct = m?.iconUrl;
      if (direct && same(direct, nurl)) return acc + 1;
      const key = m?.iconKey;
      if (!key) return acc;
      const found = (config?.icons?.missions || []).find(i => i.key === key);
      return acc + (found && same(found.url, nurl) ? 1 : 0);
    }, 0);

    // Devices using this URL as ICON (via iconKey→icons.devices[].url)
    const iconDevice = (config?.devices || []).reduce((acc, d) => {
      const key = d?.iconKey;
      if (!key) return acc;
      const found = (config?.icons?.devices || []).find(i => i.key === key);
      return acc + (found && same(found.url, nurl) ? 1 : 0);
    }, 0);

    // Reward Icons entries that point to this URL
    const iconReward = (config?.icons?.rewards || []).reduce((acc, i) => acc + (same(i.url, nurl) ? 1 : 0), 0);

    // Mission Response media & audio usage
    const outcomeCorrect = (suite?.missions || []).reduce((acc, m) => acc + (m?.onCorrect?.mediaUrl && same(m.onCorrect.mediaUrl, nurl) ? 1 : 0), 0);
    const outcomeWrong   = (suite?.missions || []).reduce((acc, m) => acc + (m?.onWrong?.mediaUrl   && same(m.onWrong.mediaUrl,   nurl) ? 1 : 0), 0);
    const outcomeAudio   = (suite?.missions || []).reduce((acc, m) => acc + ((m?.onCorrect?.audioUrl && same(m.onCorrect.audioUrl, nurl)) || (m?.onWrong?.audioUrl && same(m.onWrong.audioUrl, nurl)) ? 1 : 0), 0);

    return { rewardsPool, penaltiesPool, iconMission, iconDevice, iconReward, outcomeCorrect, outcomeWrong, outcomeAudio };
  }

  function addPoolItem(kind, url) {
    const label = baseNameFromUrl(url);
    setConfig(c => {
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

  async function onUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadToRepo(file, folder);
    if (url) {
      refreshInventory();
      setAddUrl(url);
    }
  }

  async function deleteOne(url) {
    const path = pathFromUrl(url);
    if (!path) {
      alert('This file cannot be deleted here (external or unknown path).');
      return false;
    }
    if (!window.confirm(`Delete this media file?\n${url}`)) return false;
    setUploadStatus('Deleting…');
    const ok = await deleteMediaPath(path);
    setUploadStatus(ok ? '✅ Deleted' : '❌ Delete failed');
    if (ok) refreshInventory();
    return ok;
  }

  async function deleteAll(list) {
    if (!list?.length) return;
    if (!window.confirm(`Delete ALL ${list.length} files in this group? This cannot be undone.`)) return;
    setUploadStatus('Deleting group…');
    let okCount = 0;
    for (const it of list) {
      const path = pathFromUrl(it.url);
      if (!path) continue;
      // eslint-disable-next-line no-await-in-loop
      const ok = await deleteMediaPath(path);
      if (ok) okCount++;
    }
    setUploadStatus(`✅ Deleted ${okCount}/${list.length}`);
    refreshInventory();
  }

  // Group by type
  const itemsByType = (inv || []).reduce((acc, it) => {
    const t = classifyByExt(it.url);
    if (!acc[t]) acc[t] = [];
    acc[t].push(it);
    return acc;
  }, {});
  const sections = [
    { key:'image', title:'Images (jpg/png)', items: itemsByType.image || [] },
    { key:'video', title:'Video (mp4/mov)',  items: itemsByType.video || [] },
    { key:'audio', title:'Audio (mp3/wav/aiff)', items: itemsByType.audio || [] },
    { key:'gif',   title:'GIF',              items: itemsByType.gif   || [] },
  ];
  const active = sections.find(s => s.key === subTab) || sections[2]; // default to 'audio'

  return (
    <main style={S.wrap}>
      {/* Upload */}
      <div style={S.card}>
        <h3 style={{ marginTop:0 }}>Upload</h3>
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:8, alignItems:'center' }}>
          <input style={S.input} placeholder="(Optional) Paste URL to remember…" value={addUrl} onChange={(e)=>setAddUrl(e.target.value)} />
          <select style={S.input} value={folder} onChange={(e)=>setFolder(e.target.value)}>
            <option value="uploads">uploads</option>
            <option value="bundles">bundles</option>
            <option value="icons">icons</option>
          </select>
          <label style={{ ...S.button, display:'grid', placeItems:'center' }}>
            Upload
            <input type="file" onChange={onUpload} style={{ display:'none' }} />
          </label>
        </div>
        {uploadStatus && <div style={{ marginTop:8, color:'var(--admin-muted)' }}>{uploadStatus}</div>}
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
              const use = usageCounts(url);
              return (
                <div key={idx} style={{ border:'1px solid var(--admin-border-soft)', borderRadius:10, padding:10 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:6 }}>
                    <div style={{ fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {baseNameFromUrl(url)}
                    </div>
                    {/* Usage chips next to title (per-file, per service) */}
                    <div style={S.chipRow}>
                      <span style={S.chip} title="Rewards Pool uses">R {use.rewardsPool}</span>
                      <span style={S.chip} title="Penalties Pool uses">P {use.penaltiesPool}</span>
                      <span style={S.chip} title="Missions using as Icon">IM {use.iconMission}</span>
                      <span style={S.chip} title="Devices using as Icon">ID {use.iconDevice}</span>
                      <span style={S.chip} title="Reward Icons entries">IR {use.iconReward}</span>
                      <span style={S.chip} title="On-Correct media uses">OC {use.outcomeCorrect}</span>
                      <span style={S.chip} title="On-Wrong media uses">OW {use.outcomeWrong}</span>
                      <span style={S.chip} title="Outcome audio uses (either)">OA {use.outcomeAudio}</span>
                    </div>
                  </div>

                  <MediaPreview url={url} kind={active.key} />

                  
                  {/* Assign actions removed — Media Pool is upload-only */}

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
function AssignedMediaTab({ config, setConfig, onReapplyDefaults, inventory = [], devices = [], missions = [] }) {
  const [mediaTriggerPicker, setMediaTriggerPicker] = useState('');
  const rewards = config.media?.rewardsPool || [];
  const penalties = config.media?.penaltiesPool || [];
  const iconsM = config.icons?.missions || [];
  const iconsD = config.icons?.devices  || [];
  const iconsR = config.icons?.rewards  || [];
  const triggerConfig = mergeTriggerState(config.mediaTriggers);

  function updateMediaTrigger(partial) {
    setConfig(c => ({
      ...c,
      mediaTriggers: mergeTriggerState(c.mediaTriggers, partial),
    }));
  }

  const iconsDevices = config.icons?.devices || [];
  const iconsMissions = config.icons?.missions || [];
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
    const iconEntry = iconsMissions.find(x => (x.key||'') === m?.iconKey);
    const thumbnail = toDirectMediaURL(iconEntry?.url || '');
    return { id, label, thumbnail, meta: m };
  });
  const responseOptions = [];
  (missions || []).forEach((m) => {
    if (!m) return;
    const baseLabel = m.title || m.id || 'Mission';
    const iconEntry = iconsMissions.find(x => (x.key||'') === m?.iconKey);
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

  function removePoolItem(kind, idx) {
    if (!window.confirm('Remove this item from the assigned list?')) return;
    setConfig(c => {
      const m = { ...(c.media||{ rewardsPool:[], penaltiesPool:[] }) };
      if (kind === 'rewards') m.rewardsPool = m.rewardsPool.filter((_,i)=>i!==idx);
      if (kind === 'penalties') m.penaltiesPool = m.penaltiesPool.filter((_,i)=>i!==idx);
      return { ...c, media: m };
    });
  }
  function removeIcon(kind, key) {
    if (!window.confirm('Remove this icon from the assigned list?')) return;
    setConfig(c => {
      const icons = { missions:[...(c.icons?.missions||[])], devices:[...(c.icons?.devices||[])], rewards:[...(c.icons?.rewards||[])] };
      icons[kind] = icons[kind].filter(i => i.key !== key);
      return { ...c, icons };
    });
  }

  return (
    <main style={S.wrap}>
      <div style={S.card}>
        <h3 style={{ marginTop:0 }}>Trigger Automation</h3>
        <label style={{ display:'flex', alignItems:'center', gap:8 }}>
          <input
            type="checkbox"
            checked={triggerConfig.enabled}
            onChange={(e)=>{ setMediaTriggerPicker(''); updateMediaTrigger({ enabled: e.target.checked }); }}
          />
          <span>Enable Assigned Media Trigger — instantly link media, devices, and missions.</span>
        </label>

        {triggerConfig.enabled ? (
          <>
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
        ) : (
          <div style={{ marginTop:8, color:'var(--admin-muted)', fontSize:12 }}>Toggle on to coordinate triggers across media, devices, and missions.</div>
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
          <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, zIndex:40, maxHeight:240, overflowY:'auto', border:'1px solid var(--admin-border-soft)', borderRadius:10, background:'var(--admin-panel-bg)', boxShadow:'0 18px 36px rgba(0,0,0,0.45)' }}>
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
