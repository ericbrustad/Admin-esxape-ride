import React, { useEffect, useRef, useState } from 'react';  
import TestLauncher from '../components/TestLauncher';

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
  audio: /\.(mp3|wav|ogg|m4a)$/i,
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
  const [dirty, setDirty]       = useState(false);

  // selections
  const [selectedDevIdx, setSelectedDevIdx] = useState(null);
  const [selectedMissionIdx, setSelectedMissionIdx] = useState(null);

  // Devices tab
  const [devSearchQ, setDevSearchQ] = useState('');
  const [devSearching, setDevSearching] = useState(false);
  const [devResults, setDevResults] = useState([]);
  const [placingDev, setPlacingDev] = useState(false);
  const [devDraft, setDevDraft] = useState({ title:'', type:'smoke', iconKey:'', pickupRadius:100, effectSeconds:120, lat:null, lng:null });

  const [uploadStatus, setUploadStatus] = useState('');

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

/* CHANGED NAME HERE: vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv */
        const missionsDoc  = await fetchFirstJson(missionUrls, { version:'0.0.0', missions:[] });
/* ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ */

        const c0 = await fetchFirstJson(configUrls, defaultConfig());

        const dc = defaultConfig();
        const normalized = {
/* CHANGED NAME HERE: use missionsDoc instead of m */
          ...missionsDoc,
          missions: (missionsDoc.missions || []).map(x => ({
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
          icons: { ...(c0.icons || {}), ...DEFAULT_ICONS },
          appearance: { ...dc.appearance, ...(c0.appearance || {}) },
          map: { ...dc.map, ...(c0.map || {}) },
          geofence: { ...dc.geofence, ...(c0.geofence || {}) },
        };

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
    // Try query form first (/api/game?slug=x&channel=...), fall back to path (/api/game/x?channel=...)
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

    // optional deploy delay
    if (deployDelaySec > 0) await new Promise(r => setTimeout(r, deployDelaySec * 1000));

    await publishWithSlug(slug, 'published');

    // Refresh state, list & preview
    await reloadGamesList();
    setPreviewNonce(n => n + 1);
    setSavePubBusy(false);
  }

  /* Delete game (with modal confirm) */
  async function reallyDeleteGame() {
    const slug = activeSlug || 'default';
    const urlTry = [
      `/api/games${qs({ slug: isDefaultSlug(slug) ? '' : slug })}`,                 // DELETE /api/games?slug=x
      !isDefaultSlug(slug) ? `/api/game${qs({ slug })}` : null,                      // DELETE /api/game?slug=x
      !isDefaultSlug(slug) ? `/api/games/${encodeURIComponent(slug)}` : null,        // DELETE /api/games/x
      !isDefaultSlug(slug) ? `/api/game/${encodeURIComponent(slug)}` : null,         // DELETE /api/game/x
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
      // Fall back: clear locally & save (root or slug)
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
  function addDevice() {
    setPlacingDev(true);
    setSelectedDevIdx(null);
    setSelectedMissionIdx(null);
    setDevDraft({
      title:'', type:'smoke', iconKey:'', pickupRadius:100, effectSeconds:120,
      lat:Number((config.map?.centerLat ?? 44.9778)),
      lng:Number((config.map?.centerLng ?? -93.2650))
    });
  }
  function saveDraftDevice() {
    if (devDraft.lat == null || devDraft.lng == null) { setStatus('❌ Click the map or search an address to set device location'); return; }
    pushHistory();
    const item = {
      id: 'd' + String((devices?.length || 0) + 1).padStart(2, '0'),
      title: devDraft.title || (devDraft.type.charAt(0).toUpperCase()+devDraft.type.slice(1)),
      type: devDraft.type,
      iconKey: devDraft.iconKey || '',
      pickupRadius: clamp(Number(devDraft.pickupRadius || 0), 1, 2000),
      effectSeconds: clamp(Number(devDraft.effectSeconds || 0), 5, 3600),
      lat: Number(Number(devDraft.lat).toFixed(6)),
      lng: Number(Number(devDraft.lng).toFixed(6)),
    };
    setDevices([...(devices || []), item]);
    setPlacingDev(false);
    setSelectedDevIdx((devices?.length || 0));
    setSelectedMissionIdx(null);
    setStatus('✅ Device added');
  }
  function deleteSelectedDevice() {
    if (selectedDevIdx == null) return;
    pushHistory();
    const list = [...devices];
    list.splice(selectedDevIdx, 1);
    setDevices(list);
    setSelectedDevIdx(null);
  }
  function duplicateSelectedDevice() {
    if (selectedDevIdx == null) return;
    pushHistory();
    const src = devices[selectedDevIdx]; if (!src) return;
    const copy = { ...JSON.parse(JSON.stringify(src)) };
    copy.id = 'd' + String((devices?.length || 0) + 1).padStart(2, '0');
    setDevices([...(devices || []), copy]);
    setSelectedDevIdx((devices?.length || 0));
  }
  function moveSelectedDevice(lat, lng) {
    if (selectedDevIdx == null) return;
    pushHistory();
    const list = [...devices];
    list[selectedDevIdx] = { ...list[selectedDevIdx], lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
    setDevices(list);
  }
  function setSelectedDeviceRadius(r) {
    if (selectedDevIdx == null) return;
    pushHistory();
    const list = [...devices];
    list[selectedDevIdx] = { ...list[selectedDevIdx], pickupRadius: clamp(Number(r||0), 1, 2000) };
    setDevices(list);
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
    if (placingDev) {
      setDevDraft(d => ({ ...d, lat, lng: lon }));
    } else if (selectedDevIdx != null) {
      pushHistory();
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
    const allUrls = new Set(inv.map(i => i.url));
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

    const unused = inv.filter(i => !used.has(i.url));
    const usedCount = used.size;
    const total = inv.length;

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
      <main style={{ maxWidth: 900, margin: '40px auto', color: '#9fb0bf', padding: 16 }}>
        <div style={{ padding: 16, borderRadius: 12, border: '1px solid #1f262d', background: '#12181d' }}>
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

  const deviceRadiusDisabled = (selectedDevIdx==null && !placingDev);
  const deviceRadiusValue = selectedDevIdx!=null
    ? Number(devices?.[selectedDevIdx]?.pickupRadius ?? 0)
    : Number(devDraft.pickupRadius ?? 100);

  const selectedPinSizeDisabled = (selectedMissionIdx==null && selectedDevIdx==null);

  const tabsOrder = ['missions','devices','settings','text','media','test'];

  const isDefault = !activeSlug || activeSlug === 'default';
  const activeSlugForClient = isDefault ? '' : activeSlug; // omit for Default Game

  return (
    <div style={S.body}>
      <header style={S.header}>
        <div style={S.wrap}>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            {tabsOrder.map((t)=>(
              <button key={t} onClick={()=>setTab(t)} style={{ ...S.tab, ...(tab===t?S.tabActive:{}) }}>
                {t.toUpperCase()}
              </button>
            ))}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:8, flexWrap:'wrap' }}>
              <label style={{ color:'#9fb0bf', fontSize:12 }}>Game:</label>
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
              <label style={{ color:'#9fb0bf', fontSize:12, display:'flex', alignItems:'center', gap:6 }}>
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
                  // hard reload data after
                  const isDefaultNow = !activeSlug || activeSlug === 'default';
                  // re-pull suite/config for confidence
                  setActiveSlug(isDefaultNow ? 'default' : activeSlug);
                }}
                disabled={savePubBusy}
                style={{ ...S.button, background:'#103217', border:'1px solid #1d5c2a', opacity: savePubBusy ? 0.7 : 1 }}
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
          <div style={{ color:'#9fb0bf', marginTop:6, whiteSpace:'pre-wrap' }}>{status}</div>
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
                      <div style={{ color:'#9fb0bf', fontSize:12 }}>{TYPE_LABELS[m.type] || m.type} — id: {m.id}</div>
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
                  <div style={{ color:'#9fb0bf', fontSize:12 }}>
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
                    <code style={{ color:'#9fb0bf' }}>{selectedMissionIdx==null ? '—' : `${selectedPinSize}px`}</code>
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
                <code style={{ color:'#9fb0bf' }}>
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
                  <div style={{ position:'sticky', top:0, zIndex:5, background:'#12181d', paddingBottom:8, marginBottom:8, borderBottom:'1px solid #1f262d' }}>
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
                            ? <img alt="icon" src={toDirectMediaURL(sel.url)} style={{ width:48, height:48, objectFit:'contain', border:'1px solid #2a323b', borderRadius:8 }}/>
                            : <div style={{ width:48, height:48, border:'1px dashed #2a323b', borderRadius:8, display:'grid', placeItems:'center', color:'#9fb0bf' }}>icon</div>;
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
                      <div style={{ fontSize:12, color:'#9fb0bf', marginBottom:6 }}>Pick location & radius</div>
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

              <div style={{ background:'#0b0c10', border:'1px solid #2a323b', borderRadius:10, padding:8, maxHeight:180, overflow:'auto', display: devResults.length>0 ? 'block' : 'none' }}>
                {devResults.map((r,i)=>(
                  <div key={i} onClick={()=>applySearchResult(r)} style={{ padding:'6px 8px', cursor:'pointer', borderBottom:'1px solid #1f262d' }}>
                    <div style={{ fontWeight:600 }}>{r.display_name}</div>
                    <div style={{ color:'#9fb0bf', fontSize:12 }}>lat {Number(r.lat).toFixed(6)}, lng {Number(r.lon).toFixed(6)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
              <button style={S.button} onClick={addDevice}>+ Add Device</button>
              <button style={S.button} disabled={selectedDevIdx==null} onClick={duplicateSelectedDevice}>⧉ Duplicate</button>
              <button style={S.button} disabled={selectedDevIdx==null} onClick={deleteSelectedDevice}>🗑 Delete</button>
              {(selectedDevIdx!=null) && (
                <button style={S.button} onClick={()=>{ setSelectedDevIdx(null); }}>Clear selection</button>
              )}
            </div>

            <ul style={{ paddingLeft: 18 }}>
              {(devices||[]).map((x,i)=>(
                <li key={x.id||i} style={{ marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
                  <code>D{i+1}</code> — {x.title||'(untitled)'} • {x.type} • r {x.pickupRadius}m
                  {typeof x.lat==='number' && typeof x.lng==='number' ? <> • {x.lat},{x.lng}</> : ' • (not placed)'}
                  <button
                    style={{ ...S.button, padding:'6px 10px', marginLeft:'auto', background: selectedDevIdx===i ? '#1a2027' : '#0f1418' }}
                    onClick={()=>{ setSelectedDevIdx(i); setSelectedMissionIdx(null); }}
                  >
                    Select
                  </button>
                </li>
              ))}
            </ul>
            {(devices||[]).length===0 && <div style={{ color:'#9fb0bf' }}>No devices yet. Use “Add Device” to place devices.</div>}
          </aside>

          <section style={{ position:'relative' }}>
            <div style={S.card}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:12, marginBottom:8, flexWrap:'wrap' }}>
                <div>
                  <h3 style={{ margin:0 }}>Devices Map</h3>
                  <div style={{ color:'#9fb0bf', fontSize:12 }}>
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
                    <code style={{ color:'#9fb0bf' }}>{selectedDevIdx==null ? '—' : `${selectedPinSize}px`}</code>
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
                <code style={{ color:'#9fb0bf' }}>
                  {selectedDevIdx!=null ? `D${selectedDevIdx+1} radius: ${deviceRadiusValue} m`
                   : placingDev ? `New device radius: ${deviceRadiusValue} m`
                   : 'Select a device to adjust radius'}
                </code>
              </div>

              {placingDev && (
                <div style={{ border:'1px solid #22303c', borderRadius:10, padding:10, marginBottom:8 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'64px 1fr 1fr 1fr 1fr', gap:8, alignItems:'center' }}>
                    <div>
                      {devDraft.iconKey
                        ? <img alt="icon" src={toDirectMediaURL(deviceIconUrlFromKey(devDraft.iconKey))} style={{ width:48, height:48, objectFit:'contain', border:'1px solid #2a323b', borderRadius:8 }}/>
                        : <div style={{ width:48, height:48, border:'1px dashed #2a323b', borderRadius:8, display:'grid', placeItems:'center', color:'#9fb0bf' }}>icon</div>}
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
                  <div style={{ marginTop:8, display:'flex', gap:8, alignItems:'center' }}>
                    <button style={S.button} onClick={()=>setPlacingDev(false)}>Cancel</button>
                    <button style={S.button} onClick={saveDraftDevice}>Save Device</button>
                    <div style={{ color:'#9fb0bf' }}>
                      {devDraft.lat==null ? 'Click the map or search an address to set location' :
                        <>lat {Number(devDraft.lat).toFixed(6)}, lng {Number(devDraft.lng).toFixed(6)}</>}
                    </div>
                  </div>
                </div>
              )}

              <MapOverview
                missions={(suite?.missions)||[]}
                devices={devices}
                icons={config.icons||DEFAULT_ICONS}
                showRings={showRings}
                mapCenter={mapCenter}
                mapZoom={mapZoom}
                defaultIconSizePx={defaultPinSize}
                selectedIconSizePx={selectedPinSize}
                interactive={placingDev}
                draftDevice={placingDev ? { lat:devDraft.lat, lng:devDraft.lng, radius:devDraft.pickupRadius } : null}
                selectedDevIdx={selectedDevIdx}
                selectedMissionIdx={null}
                onDraftChange={(lat,lng)=>setDevDraft(d=>({ ...d, lat, lng }))}
                onMoveSelected={(lat,lng)=>moveSelectedDevice(lat,lng)}
                onMoveSelectedMission={null}
                onSelectDevice={(i)=>{ setSelectedDevIdx(i); setSelectedMissionIdx(null); setPlacingDev(false); }}
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
                <div style={{ background:'#0b0c10', border:'1px solid #2a323b', borderRadius:10, padding:8, marginTop:8, maxHeight:160, overflow:'auto', display: mapResults.length>0 ? 'block' : 'none' }}>
                  {mapResults.map((r,i)=>(
                    <div key={i} onClick={()=>useCenterResult(r)} style={{ padding:'6px 8px', cursor:'pointer', borderBottom:'1px solid #1f262d' }}>
                      <div style={{ fontWeight:600 }}>{r.display_name}</div>
                      <div style={{ color:'#9fb0bf', fontSize:12 }}>lat {Number(r.lat).toFixed(6)}, lng {Number(r.lon).toFixed(6)}</div>
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
            <div style={{ color:'#9fb0bf', marginTop:8, fontSize:12 }}>
              These defaults keep pins in the same region. “Geofence Mode” can be used by the Game client to allow click‑to‑enter in test vs GPS in live.
            </div>
          </div>

          <div style={{ ...S.card, marginTop:16 }}>
            <h3 style={{ marginTop:0 }}>Maintenance</h3>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <button
                style={{ ...S.button, borderColor:'#7a1f1f', background:'#2a1313' }}
                onClick={()=> setConfirmDeleteOpen(true)}
              >
                🗑 Delete Game
              </button>
              <button style={S.button} onClick={scanProject}>🔎 Scan media usage (find unused)</button>
            </div>
          </div>

          <div style={{ ...S.card, marginTop:16 }}>
            <h3 style={{ marginTop:0 }}>Appearance (Global)</h3>
            <AppearanceEditor value={config.appearance||defaultAppearance()}
              onChange={(next)=>setConfig({ ...config, appearance:next })}/>
            <div style={{ color:'#9fb0bf', marginTop:8, fontSize:12 }}>
              Tip: keep vertical alignment on <b>Top</b> so text doesn’t cover the backpack.
            </div>
          </div>
        </main>
      )}

      {/* TEXT rules */}
      {tab==='text' && <TextTab suite={suite} config={config} setConfig={setConfig} setStatus={setStatus}/>}

      {/* MEDIA */}
      {tab==='media' && ( in final
        <MediaTab
          config={config}
          setConfig={setConfig}
          uploadStatus={uploadStatus}
          setUploadStatus={setUploadStatus}
          onReapplyDefaults={()=>setConfig(c=>applyDefaultIcons(c))}
          uploadToRepo={async (file, folder)=> {
            const url = await (async ()=>{ try { return await uploadToRepo(file, folder); } catch { return ''; }})();
            return url;
          }}
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
            {!gameBase && <div style={{ color:'#9fb0bf', marginBottom:8 }}>Set NEXT_PUBLIC_GAME_ORIGIN to enable preview.</div>}
            {gameBase && (
              <iframe
                key={previewNonce} // hard refresh on nonce change
                src={`${gameBase}/?${new URLSearchParams({
                  ...(activeSlugForClient ? { slug: activeSlugForClient } : {}),
                  channel: testChannel,
                  preview: '1',
                  cb: String(Date.now())
                }).toString()}`}
                style={{ width:'100%', height:'70vh', border:'1px solid #22303c', borderRadius:12 }}
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
            <div style={{ color:'#e9eef2', marginBottom:12 }}>
              Are you sure you want to delete <b>{config?.game?.title || (activeSlug || 'this game')}</b>?
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button style={S.button} onClick={()=>setConfirmDeleteOpen(false)}>Cancel</button>
              <button
                style={{ ...S.button, borderColor:'#7a1f1f', background:'#2a1313' }}
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
      <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>{label}</div>
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
    <div style={{ border:'1px solid #22303c', borderRadius:10, padding:12 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
        <Field label="Font family">
          <select style={S.input} value={a.fontFamily} onChange={(e)=>onChange({ ...a, fontFamily:e.target.value })}>
            {FONT_FAMILIES.map((f)=><option key={f.v} value={f.v}>{f.label}</option>)}
          </select>
          <div style={{ marginTop:6, padding:'6px 10px', border:'1px dashed #2a323b', borderRadius:8, fontFamily:a.fontFamily }}>
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
          <div style={{ color:'#9fb0bf', fontSize:12, marginTop:4 }}>{(a.textBgOpacity*100).toFixed(0)}%</div>
        </Field>
        <ColorField label="Screen background color" value={a.screenBgColor} onChange={(v)=>onChange({ ...a, screenBgColor:v })}/>
        <Field label="Screen background opacity">
          <input type="range" min={0} max={1} step={0.05} value={a.screenBgOpacity}
            onChange={(e)=>onChange({ ...a, screenBgOpacity:Number(e.target.value) })}/>
          <div style={{ color:'#9fb0bf', fontSize:12, marginTop:4 }}>{(a.screenBgOpacity*100).toFixed(0)}%</div>
        </Field>
        <Field label="Screen background image (URL)">
          <input style={S.input} value={a.screenBgImage || ''} onChange={(e)=>onChange({ ...a, screenBgImage:e.target.value })}/>
          {a.screenBgImage && (
            <img src={toDirectMediaURL(a.screenBgImage)} alt="bg"
              style={{ marginTop:6, width:'100%', maxHeight:120, objectFit:'cover', border:'1px solid #2a323b', borderRadius:8 }}/>
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
        marginTop:12, border:'1px dashed #2a323b', borderRadius:10, overflow:'hidden',
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
    <div style={{ border:'1px solid #2a323b', borderRadius:10, padding:12 }}>
      <div style={{ fontWeight:600, marginBottom:8 }}>Choices (A–E)</div>
      {[0,1,2,3,4].map((i)=>(
        <div key={i} style={{ display:'grid', gridTemplateColumns:'24px 1fr', alignItems:'center', gap:8, marginBottom:8 }}>
          <input type="radio" name="mcq-correct" checked={correct===i} onChange={()=>{ setCorrect(i); sync(local,i); }} title="Mark as correct"/>
          <input placeholder={`Choice ${String.fromCharCode(65+i)}`} style={S.input} value={local[i]||''}
            onChange={(e)=>{ const next=[...local]; next[i]=e.target.value; setLocal(next); sync(next, correct); }}/>
        </div>
      ))}
      <div style={{ color:'#9fb0bf', fontSize:12 }}>Leave blanks for unused options. Exactly one radio can be marked correct.</div>
    </div>
  );
}
function MediaPreview({ url, kind }) {
  if (!url) return null;
  const u = toDirectMediaURL(String(url).trim());
  const lower = u.toLowerCase();
  const isVideo = /\.(mp4|webm|mov)(\?|#|$)/.test(lower);
  const isImage = /\.(png|jpg|jpeg|gif|webp)(\?|#|$)/.test(lower) || u.includes('drive.google.com/uc?export=view');
  const isAudio = /\.(mp3|wav|ogg|m4a)(\?|#|$)/.test(lower);
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ color:'#9fb0bf', fontSize:12, marginBottom:6 }}>Preview ({kind})</div>
      {isVideo ? (
        <video src={u} controls style={{ width:'100%', maxHeight:260, borderRadius:10, border:'1px solid #2a323b' }}/>
      ) : isImage ? (
        <img src={u} alt="preview" style={{ width:'100%', maxHeight:260, objectFit:'contain', borderRadius:10, border:'1px solid #2a323b' }}/>
      ) : isAudio ? (
        <audio src={u} controls style={{ width:'100%' }} />
      ) : (
        <a href={u} target="_blank" rel="noreferrer" style={{ color:'#9fb0bf', textDecoration:'underline' }}>Open media</a>
      )}
    </div>
  );
}

/* Styles */
const S = {
  body: { background:'#0b0c10', color:'#e9eef2', minHeight:'100vh', fontFamily:'system-ui, Arial, sans-serif' },
  header: { padding:16, background:'#11161a', borderBottom:'1px solid #1f2329' }, // CORRECTED LINE
  wrap: { maxWidth:1200, margin:'0 auto', padding:16 },
  wrapGrid2: { display:'grid', gridTemplateColumns:'360px 1fr', gap:16, alignItems:'start', maxWidth:1400, margin:'0 auto', padding:16 },
  sidebarTall: { background:'#12181d', border:'1px solid #1f262d', borderRadius:14, padding:12, position:'sticky', top:12, height:'calc(100vh - 120px)', overflow:'auto' },
  card: { background:'#12181d', border:'1px solid #1f262d', borderRadius:14, padding:16 },
  missionItem: { borderBottom:'1px solid #1f262d', padding:'10px 4px' },
  input:{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid #2a323b', background:'#0b0c10', color:'#e9eef2' },
  button:{ padding:'10px 14px', borderRadius:10, border:'1px solid #2a323b', background:'#1a2027', color:'#e9eef2', cursor:'pointer' },
  tab:{ padding:'8px 12px', borderRadius:10, border:'1px solid #2a323b', background:'#0f1418', color:'#e9eef2', cursor:'pointer' },
  tabActive:{ background:'#1a2027' },
  search:{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid #2a323b', background:'#0b0c10', color:'#e9eef2', marginBottom:10 },
  hr:{ border:'1px solid #1f262d', borderBottom:'none' },
  overlay:{ position:'fixed', inset:0, display:'grid', placeItems:'center', background:'rgba(0,0,0,0.55)', zIndex:2000, padding:16 },
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
      {!leafletReady && <div style={{ color:'#9fb0bf', marginBottom:8 }}>Loading map…</div>}
      <div ref={divRef} style={{ height:560, borderRadius:12, border:'1px solid #22303c', background:'#0b1116' }}/>
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
      {!leafletReady && <div style={{ color:'#9fb0bf', marginBottom:8 }}>Loading map…</div>}
      <div ref={divRef} style={{ height:260, borderRadius:10, border:'1px solid #22303c', background:'#0b1116' }} />
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center', marginTop:8 }}>
        <input
          type="range" min={5} max={500} step={5} value={rad}
          onChange={(e) => {
            const next = clamp(Number(e.target.value),5,500);
            setRad(next);
            if (divRef.current?._circle) divRef.current._circle.setRadius(next);
            if (divRef.current?._marker) {
              const p = divRef.current._marker.getLatLng();
              onChange && onChange(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)), next);
            }
          }}
        />
        <code style={{ color:'#9fb0bf' }}>{rad} m</code>
      </div>
      <div style={{ color:'#9fb0bf', fontSize:12, marginTop:4 }}>Click map to set location. Drag marker to fine‑tune.</div>
    </div>
  );
}

/* MEDIA tab (Icons + Reward/Penalty pools) */
function MediaTab({ config, setConfig, uploadStatus, setUploadStatus, onReapplyDefaults, uploadToRepo }) {
  const [hover, setHover] = useState(false);

  async function handleDrop(e) {
    e.preventDefault(); e.stopPropagation(); setHover(false);
    let files = [];
    if (e.dataTransfer?.items && e.dataTransfer.items.length) {
      for (let i=0;i<e.dataTransfer.items.length;i++) {
        const it = e.dataTransfer.items[i];
        if (it.kind==='file') {
          const f = it.getAsFile(); if (f) files.push(f);
        }
      }
    } else if (e.dataTransfer?.files && e.dataTransfer.files.length) {
      files = Array.from(e.dataTransfer.files);
    }
    for (const f of files) { await uploadToRepo(f, 'uploads'); }
  }

  function FileChooser({ label='Choose File', folder='uploads', onUploaded }) {
    return (
      <label style={{ ...S.button, textAlign:'center' }}>
        {label}
        <input type="file" multiple style={{ display:'none' }}
          onChange={async (e)=>{
            const files = Array.from(e.target.files || []);
            for (const f of files) {
              const url = await uploadToRepo(f, folder);
              if (url and typeof onUploaded==='function') onUploaded(url);
            }
            e.target.value = '';
          }}/>
      </label>
    );
  }

  const rewardsPool = Array.isArray(config.media?.rewardsPool) ? config.media.rewardsPool : [];
  const penaltiesPool = Array.isArray(config.media?.penaltiesPool) ? config.media.penaltiesPool : [];
  const setRewardsPool = (next) => setConfig({ ...config, media: { ...(config.media||{}), rewardsPool: next } });
  const setPenaltiesPool = (next) => setConfig({ ...config, media: { ...(config.media||{}), penaltiesPool: next } });

  return (
    <main style={S.wrap}>
      <div style={S.card}
           onDragEnter={(e)=>{ e.preventDefault(); e.stopPropagation(); setHover(true); }}
           onDragOver={(e)=>{ e.preventDefault(); e.stopPropagation(); }}
           onDragLeave={(e)=>{ e.preventDefault(); e.stopPropagation(); setHover(false); }}
           onDrop={handleDrop}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ marginTop:0, fontSize:24 }}>Media</h3>
          <button style={S.button} onClick={onReapplyDefaults}>Re‑apply default assets</button>
        </div>

        <div style={{ border:'2px dashed #2a323b', borderRadius:12, padding:16, background:hover?'#0e1116':'transparent', marginBottom:12, color:'#9fb0bf' }}>
          Drag & drop files anywhere on this page or click <em>Choose File</em>. Files are committed to <code>public/media/…</code> and served from <code>/media/…</code>.
          <span style={{ float:'right' }}><FileChooser/><span style={{ marginLeft:8 }}>{uploadStatus}</span></span>
        </div>

        <IconsEditor config={config} setConfig={setConfig} label="Mission Icons" kind="missions" uploadToRepo={uploadToRepo}/>
        <IconsEditor config={config} setConfig={setConfig} label="Device Icons"  kind="devices"  uploadToRepo={uploadToRepo}/>

        <MediaPoolEditor
          title="Reward Media"
          items={rewardsPool}
          onChange={setRewardsPool}
          uploadToRepo={uploadToRepo}
        />
        <MediaPoolEditor
          title="Penalty Media"
          items={penaltiesPool}
          onChange={setPenaltiesPool}
          uploadToRepo={uploadToRepo}
        />
      </div>
    </main>
  );
}
function IconsEditor({ config, setConfig, label, kind, uploadToRepo }) {
  const list = config.icons?.[kind] || [];
  const setList = (next) => setConfig({ ...config, icons:{ ...(config.icons||{}), [kind]: next } });

  const [pool, setPool] = useState([]);
  useEffect(()=>{ (async()=>{
    try { setPool(await listInventory(['icons','bundles','uploads'])); } catch {}
  })(); }, []);

  function setUrlAndMaybeName(idx, url) {
    const n=[...list];
    const before = n[idx] || {};
    const nameEmpty = !before.name || String(before.name).trim()==='';
    n[idx] = { ...before, url };
    if (nameEmpty) n[idx].name = baseNameFromUrl(url);
    setList(n);
  }

  return (
    <div style={{ marginTop:16 }}>
      <h4 style={{ marginTop:0, fontSize:20 }}>{label}</h4>
      <div style={{ display:'grid', gridTemplateColumns:'160px 1fr 1fr 140px', gap:8, alignItems:'center', fontSize:13, color:'#9fb0bf', marginBottom:6 }}>
        <div>Icon</div><div>Name</div><div>Key</div><div>Actions</div>
      </div>
      {list.map((row, idx)=>(
        <div key={row.key||idx} style={{ display:'grid', gridTemplateColumns:'160px 1fr 1fr 140px', gap:8, alignItems:'center', marginBottom:8 }}>
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8 }}>
              <input style={S.input} value={row.url||''} onChange={(e)=>setUrlAndMaybeName(idx, e.target.value)} placeholder="Image URL"/>
              <label style={{ ...S.button, textAlign:'center' }}>
                Choose File
                <input
                  type="file" style={{ display:'none' }}
                  onChange={async (e)=>{
                    const f=e.target.files?.[0]; if (!f) return;
                    const url=await uploadToRepo(f,'icons');
                    if (url) setUrlAndMaybeName(idx, url);
                  }}
                />
              </label>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:6, marginTop:6 }}>
              <select
                style={S.input}
                onChange={(e)=> setUrlAndMaybeName(idx, e.target.value) }
                value=""
              >
                <option value="">Pick from media pool…</option>
                {pool.filter(it=>it.type==='image' || it.type==='gif').map((it) => (
                  <option key={it.url} value={it.url}>{it.name}</option>
                ))}
              </select>
            </div>
            {row.url
              ? <img alt="icon" src={toDirectMediaURL(row.url)} style={{ marginTop:6, width:'100%', maxHeight:72, objectFit:'contain', border:'1px solid #2a323b', borderRadius:8 }}/>
              : <div style={{ color:'#9fb0bf' }}>No image</div>}
          </div>
          <input style={S.input} value={row.name||''} onChange={(e)=>{ const n=[...list]; n[idx]={ ...(n[idx]||{}), name:e.target.value }; setList(n); }}/>
          <input style={S.input} value={row.key||''} onChange={(e)=>{ const n=[...list]; n[idx]={ ...(n[idx]||{}), key:e.target.value }; setList(n); }}/>
          <div style={{ display:'flex', gap:6 }}>
            <button style={S.button} onClick={()=>{ const n=[...list]; n.splice(idx,1); setList(n); }}>Delete</button>
            <button style={S.button} onClick={()=>{ const n=[...list]; const copy={ ...(n[idx]||{}) }; n.splice(idx+1,0,copy); setList(n); }}>Duplicate</button>
          </div>
        </div>
      ))}
      <button style={S.button} onClick={()=>{ setList([...(list||[]), { key:`${kind}-${list.length+1}`, name:'', url:'' }]); }}>+ Add Icon</button>
    </div>
  );
}
function MediaPoolEditor({ title, items, onChange, uploadToRepo }) {
  const [pool, setPool] = useState([]);
  useEffect(()=>{ (async()=>{
    try { setPool(await listInventory(['uploads','bundles'])); } catch {}
  })(); }, []);

  return (
    <div style={{ marginTop:20 }}>
      <h4 style={{ margin:'0 0 8px 0', fontSize:20 }}>{title}</h4>
      <div style={{ display:'grid', gridTemplateColumns:'160px 2fr 1fr 140px', gap:8, alignItems:'center', fontSize:13, color:'#9fb0bf', marginBottom:6 }}>
        <div>Thumbnail</div><div>URL</div><div>Format</div><div>Actions</div>
      </div>
      {(items||[]).map((row, idx)=>{
        const type = classifyByExt(row.url||'');
        return (
          <div key={idx} style={{ display:'grid', gridTemplateColumns:'160px 2fr 1fr 140px', gap:8, alignItems:'center', marginBottom:8 }}>
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8 }}>
                <input style={S.input} value={row.url||''}
                  onChange={(e)=>{ const n=[...items]; n[idx]={ ...(n[idx]||{}), url:e.target.value }; onChange(n); }}
                  placeholder="Image/Video/GIF/Audio URL" />
                <label style={{ ...S.button, textAlign:'center' }}>
                  Choose File
                  <input type="file" style={{ display:'none' }}
                    onChange={async (e)=>{ const f=e.target.files?.[0]; if (!f) return; const url=await uploadToRepo(f,'uploads'); if (url) { const n=[...items]; n[idx]={ ...(n[idx]||{}), url }; onChange(n); } }}/>
                </label>
              </div>
              <select style={{ ...S.input, marginTop:6 }}
                onChange={(e)=>{ const n=[...items]; n[idx]={ ...(n[idx]||{}), url:e.target.value }; onChange(n); }} value="">
                <option value="">Pick from media inventory…</option>
                {pool.map((it) => <option key={it.url} value={it.url}>{it.name}</option>)}
              </select>
              {row.url ? <MediaPreview url={row.url} kind="preview"/> : null}
            </div>
            <div><code>{row.url ? (row.url.split('.').pop().split('?')[0] || '').toLowerCase() : ''}</code></div>
            <div style={{ textTransform:'capitalize' }}>{type}</div>
            <div style={{ display:'flex', gap:6 }}>
              <button style={S.button} onClick={()=>{ const n=[...items]; n.splice(idx,1); onChange(n); }}>Delete</button>
              <button style={S.button} onClick={()=>{ const n=[...items]; const copy={ ...(n[idx]||{}) }; n.splice(idx+1,0,copy); onChange(n); }}>Duplicate</button>
            </div>
          </div>
        );
      })}
      <button style={S.button} onClick={()=>{ onChange([...(items||[]), { url:'' }]); }}>+ Add Media</button>
    </div>
  );
}

/* Inventory modal (for pools & editors that allow picking) */
function MediaInventoryModal({ acceptKinds=['image','gif','video','audio'], onClose, onPick }) {
  const [pool, setPool] = useState([]);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState(acceptKinds[0] || 'image');

  useEffect(()=>{ (async()=>{
    try { setPool(await listInventory(['uploads','bundles','icons'])); } catch {}
  })(); }, []);

  const groups = {
    image: pool.filter(x=>x.type==='image'),
    gif:   pool.filter(x=>x.type==='gif'),
    video: pool.filter(x=>x.type==='video'),
    audio: pool.filter(x=>x.type==='audio'),
  };
  const tabs = ['image','gif','video','audio'].filter(t=>acceptKinds.includes(t));
  const shown = (groups[tab]||[]).filter(x=>x.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:3000, display:'grid', placeItems:'center', padding:16 }}>
      <div style={{ ...S.card, width:'min(900px, 95vw)', maxHeight:'85vh', overflow:'auto' }}>
        <div style={{ display:'flex', gap:6, marginBottom:10 }}>
          {tabs.map((t) => (
            <button
              key={t}
              style={{ ...S.button, padding:'6px 10px', ...(tab===t ? { background:'#1a2027' } : {}) }}
              onClick={()=>setTab(t)}
            >
              {t.toUpperCase()}
            </button>
          ))}
          <input placeholder="Search…" value={q} onChange={(e)=>setQ(e.target.value)} style={{ ...S.input, maxWidth:240, marginLeft:'auto' }}/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10 }}>
          {shown.map((it)=>(
            <div key={it.url} style={{ border:'1px solid #22303c', borderRadius:10, padding:8 }}>
              <div style={{ fontSize:12, color:'#9fb0bf', marginBottom:6 }}>{it.name} <span style={{ opacity:.7 }}>({it.type})</span></div>
              {it.type==='video' ? (
                <video src={toDirectMediaURL(it.url)} style={{ width:'100%', height:120, objectFit:'cover', borderRadius:8 }} />
              ) : it.type==='audio' ? (
                <div style={{ height:120, display:'grid', placeItems:'center', border:'1px dashed #2a323b', borderRadius:8, color:'#9fb0bf' }}>
                  .{it.url.split('.').pop().split('?')[0]}
                </div>
              ) : (
                <img alt="" src={toDirectMediaURL(it.url)} style={{ width:'100%', height:120, objectFit:'cover', borderRadius:8 }}/>
              )}
              <button style={{ ...S.button, marginTop:8, width:'100%' }} onClick={()=>onPick(it.url)}>Use</button>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:10 }}>
          <button style={S.button} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* TEXT tab */
function TextTab({ suite, config, setConfig, setStatus }) {
  const [smsRule, setSmsRule] = useState({ missionId: '', phoneSlot: 1, message: '', delaySec: 30 });
  function addSmsRule() {
    if (!smsRule.missionId || !smsRule.message) return setStatus('❌ Pick mission and message');
    const maxPlayers = config?.forms?.players || 1;
    if (smsRule.phoneSlot < 1 || smsRule.phoneSlot > Math.max(1, maxPlayers)) return setStatus('❌ Phone slot out of range');
    const rules = [...(config?.textRules || []), { ...smsRule, delaySec: Number(smsRule.delaySec || 0) } ];
    setConfig({ ...config, textRules: rules });
    setSmsRule({ missionId: '', phoneSlot: 1, message: '', delaySec: 30 });
    setStatus('✅ SMS rule added');
  }
  function removeSmsRule(idx) {
    const rules = [...(config?.textRules || [])];
    rules.splice(idx, 1);
    setConfig({ ...config, textRules: rules });
  }
  return (
    <main style={S.wrap}>
      <div style={S.card}>
        <h3 style={{ marginTop: 0 }}>Text Message Rules</h3>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
          <Field label="Mission (geofence)">
            <select style={S.input} value={smsRule.missionId} onChange={(e) => setSmsRule({ ...smsRule, missionId: e.target.value })}>
              <option value="">— choose —</option>
              {(suite.missions || []).map((m) => (
                <option key={m.id} value={m.id}>{m.id} — {m.title}</option>
              ))}
            </select>
          </Field>
          <Field label="Phone slot">
            <select style={S.input} value={smsRule.phoneSlot} onChange={(e) => setSmsRule({ ...smsRule, phoneSlot: Number(e.target.value) })}>
              {[1,2,3,4].map((n) => <option key={n} value={n}>{'Player '+n}</option>)}
            </select>
          </Field>
          <Field label="Delay (sec)">
            <input type="number" min={0} max={3600} style={S.input} value={smsRule.delaySec} onChange={(e) => setSmsRule({ ...smsRule, delaySec: e.target.value })}/>
          </Field>
          <Field label="Message">
            <input style={S.input} value={smsRule.message} onChange={(e) => setSmsRule({ ...smsRule, message: e.target.value })}/>
          </Field>
        </div>
        <div style={{ marginTop: 12 }}><button style={S.button} onClick={addSmsRule}>+ Add Rule</button></div>
        <hr style={S.hr}/>
        <ul style={{ paddingLeft: 18 }}>
          {(config.textRules || []).map((r, i) => (
            <li key={i} style={{ marginBottom: 8 }}>
              <code>{r.missionId}</code> → Player {r.phoneSlot} • delay {r.delaySec}s • “{r.message}”
              <button style={{ ...S.button, marginLeft: 8, padding: '6px 10px' }} onClick={() => removeSmsRule(i)}>Remove</button>
            </li>
          ))}
        </ul>
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: 'pointer' }}>Send a quick test SMS now</summary>
          <TestSMS />
        </details>
      </div>
    </main>
  );
}
function TestSMS() {
  const [to, setTo] = useState('');
  const [msg, setMsg] = useState('Test message from admin');
  const [status, setStatus] = useState('');
  async function send() {
    setStatus('Sending…');
    const res = await fetch('/api/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, body: msg }) });
    const text = await res.text();
    setStatus(res.ok ? '✅ Sent' : '❌ ' + text);
  }
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 2fr auto', alignItems: 'center' }}>
        <input placeholder="+1..." style={S.input} value={to} onChange={(e) => setTo(e.target.value)} />
        <input placeholder="Message" style={S.input} value={msg} onChange={(e) => setMsg(e.target.value)} />
        <button style={S.button} onClick={send}>Send Test</button>
      </div>
      <div style={{ marginTop: 6, color: '#9fb0bf' }}>{status}</div>
    </div>
  );
}
