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
    const url = new URL(u, typeof window !== 'undefined' ? window.location.origin : 'https://example.invalid');
    const host = url.host.toLowerCase();

    // Serve project-local absolute paths as-is
    if (u.startsWith('/')) return u;

    // Dropbox
    if (host.endsWith('dropbox.com')) {
      url.host = 'dl.dropboxusercontent.com';
      url.searchParams.delete('dl');
      if (!url.searchParams.has('raw')) url.searchParams.set('raw', '1');
      return url.toString();
    }
    // Google Drive
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

/* ───────────────────────── Constants ───────────────────────── */
const TYPE_FIELDS = {
  multiple_choice: [
    { key:'question', label:'Question', type:'text' },
    { key:'mediaUrl',  label:'Image or Video URL (optional)', type:'text' },
  ],
  short_answer: [
    { key:'question',   label:'Question', type:'text' },
    { key:'answer',     label:'Correct Answer', type:'text' },
    { key:'acceptable', label:'Also Accept (comma-separated, optional)', type:'text' }, // optional
    { key:'mediaUrl',   label:'Image or Video URL (optional)', type:'text' },
  ],
  statement: [
    { key:'text',     label:'Statement Text', type:'multiline' },
    { key:'mediaUrl', label:'Image or Video URL (optional)', type:'text' },
  ],
  video: [
    { key:'videoUrl',   label:'Video URL (https)', type:'text' },
    { key:'overlayText',label:'Overlay Text (optional)', type:'text' },
  ],
  geofence_image: [
    { key:'lat', label:'Latitude', type:'number' },
    { key:'lng', label:'Longitude', type:'number' },
    { key:'radiusMeters',    label:'Geofence Radius (m)', type:'number', min:5, max:2000 },
    { key:'cooldownSeconds', label:'Cooldown (sec)', type:'number', min:5, max:240 },
    { key:'imageUrl',  label:'Image URL (https, optional)', type:'text' },
    { key:'overlayText',label:'Caption/Text (optional)', type:'text' },
  ],
  geofence_video: [
    { key:'lat', label:'Latitude', type:'number' },
    { key:'lng', label:'Longitude', type:'number' },
    { key:'radiusMeters',    label:'Geofence Radius (m)', type:'number', min:5, max:2000 },
    { key:'cooldownSeconds', label:'Cooldown (sec)', type:'number', min:5, max:240 },
    { key:'videoUrl',  label:'Video URL (https, optional)', type:'text' },
    { key:'overlayText',label:'Overlay Text (optional)', type:'text' },
  ],
  ar_image: [
    { key:'markerUrl', label:'AR Marker Image URL (png/jpg)', type:'text' },
    { key:'assetUrl',  label:'AR Overlay Image URL (png/jpg)', type:'text' },
    { key:'overlayText',label:'Overlay Text (optional)', type:'text' },
  ],
  ar_video: [
    { key:'markerUrl', label:'AR Marker Image URL (png/jpg)', type:'text' },
    { key:'assetUrl',  label:'AR Video URL (mp4)', type:'text' },
    { key:'overlayText',label:'Overlay Text (optional)', type:'text' },
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

/* ────── Default images: prefer /public/media/bundles; fall back to repo paths ────── */
const BASES = [
  '/media/bundles',                 // <== put defaults here for reliable serving
  '/games/lib/media/bundles',
  '/lib/media/bundles',
  '/media/defaults',
];
const u = (file) => BASES.map(b => `${b}/${encodeURIComponent(file)}`)[0]; // prefer first

const U = {
  robot:   u('ROBOT1small.png'),
  smoke:   u('SMOKE BOMB.png'),
  evid:    u('evidence 2.png'),
  clue:    u('CLUEgreen.png'),
  coin:    u('GOLDEN COIN.png'),
  trivia:  u('trivia icon.png'),
  trivia2: u('trivia yellow.png'),
};

const DEFAULT_DEVICE_ICONS = [
  { key: 'dev-clone', name: 'Roaming Robot', url: U.robot },
  { key: 'dev-smoke', name: 'Smoke Shield',  url: U.smoke },
];
const DEFAULT_MISSION_ICONS = [
  { key: 'trivia',   name: 'Trivia',   url: U.trivia },
  { key: 'trivia-2', name: 'Trivia 2', url: U.trivia2 },
];
const DEFAULT_REWARD_ICONS = [
  { key: 'evidence',  name: 'Evidence',  url: U.evid },
  { key: 'clue',      name: 'Clue',      url: U.clue },
  { key: 'gold-coin', name: 'Gold Coin', url: U.coin },
];
const DEFAULT_REWARDS_SEEDED = [
  { key: 'gold-coin', name: 'Gold Coin', ability: 'Adds a coin to your wallet.', thumbUrl: U.coin },
];

function seedDefaults(cfg) {
  const next = {
    ...cfg,
    icons: { ...(cfg.icons || {}) },
    media: { ...(cfg.media || {}) },
  };
  const ensure = (kind, seeds) => {
    const list = Array.isArray(next.icons[kind]) ? [...next.icons[kind]] : [];
    const have = new Set(list.map((x) => (x.key || '').toLowerCase()));
    seeds.forEach((s) => {
      if (s.url && !have.has((s.key || '').toLowerCase())) list.push(s);
    });
    next.icons[kind] = list;
  };
  ensure('devices',  DEFAULT_DEVICE_ICONS);
  ensure('missions', DEFAULT_MISSION_ICONS);
  ensure('rewards',  DEFAULT_REWARD_ICONS);

  if (!Array.isArray(next.media.rewards) || next.media.rewards.length === 0) {
    next.media.rewards = DEFAULT_REWARDS_SEEDED;
  }

  const pool = Array.isArray(next.media.pool) ? next.media.pool.slice() : [];
  const addPool = (url) => { if (url && !pool.includes(url)) pool.push(url); };
  [U.robot, U.smoke, U.evid, U.clue, U.coin, U.trivia, U.trivia2].forEach(addPool);
  ['devices','missions','rewards'].forEach(k => {
    (next.icons[k] || []).forEach(it => addPool(it.url));
  });
  next.media.pool = pool;
  return next;
}

/* ───────────────────────── Root ───────────────────────── */
export default function Admin() {
  const [tab, setTab] = useState('missions');

  const [games, setGames] = useState([]);
  const [activeSlug, setActiveSlug] = useState('');
  const [showNewGame, setShowNewGame] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('Mystery');
  const [newMode, setNewMode] = useState('single');
  const [newDurationMin, setNewDurationMin] = useState(0);
  const [newAlertMin, setNewAlertMin] = useState(10);

  const [showRings, setShowRings] = useState(true);
  const [testChannel, setTestChannel] = useState('draft');

  const [suite, setSuite]   = useState(null); // missions + version
  const [config, setConfig] = useState(null); // devices + media + icons + appearance
  const [status, setStatus] = useState('');

  const [selected, setSelected] = useState(null);
  const [editing, setEditing]   = useState(null);
  const [dirty, setDirty]       = useState(false);

  // Device manager (right by the map)
  const [devSearchQ, setDevSearchQ] = useState('');
  const [devSearching, setDevSearching] = useState(false);
  const [devResults, setDevResults] = useState([]);
  const [placingDev, setPlacingDev] = useState(false);
  const [selectedDevIdx, setSelectedDevIdx] = useState(null);
  const [devDraft, setDevDraft] = useState({ title:'', type:'smoke', iconKey:'', pickupRadius:100, effectSeconds:120, lat:null, lng:null });

  const [uploadStatus, setUploadStatus] = useState('');

  const gameBase =
    ((typeof window !== 'undefined'
      ? (window.__GAME_ORIGIN__ || process.env.NEXT_PUBLIC_GAME_ORIGIN)
      : process.env.NEXT_PUBLIC_GAME_ORIGIN) || (config?.gameOrigin) || '');

  const getDevices = () => (config?.devices?.length ? config.devices : (config?.powerups || []));
  const setDevices = (list) => setConfig({ ...config, devices: list, powerups: list });

  /* load games */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/games', { credentials:'include' });
        const j = await r.json();
        if (j.ok) setGames(j.games || []);
      } catch {}
    })();
  }, []);

  /* load suite/config */
  useEffect(() => {
    (async () => {
      try {
        setStatus('Loading…');
        const missionUrls = activeSlug ? [`/games/${encodeURIComponent(activeSlug)}/missions.json`, `/missions.json`] : [`/missions.json`];
        const configUrl   = activeSlug ? `/api/config?slug=${encodeURIComponent(activeSlug)}` : `/api/config`;

        const m  = await fetchFirstJson(missionUrls, { version:'0.0.0', missions:[] });
        const c0 = await fetchJsonSafe(configUrl, defaultConfig());

        const dc = defaultConfig();
        const normalized = {
          ...m,
          missions: (m.missions || []).map(x => ({
            ...x,
            appearanceOverrideEnabled: !!x.appearanceOverrideEnabled,
            appearance: { ...defaultAppearance(), ...(x.appearance || {}) },
          })),
        };
        const merged = {
          ...dc, ...c0,
          timer: { ...dc.timer, ...(c0.timer || {}) },
          devices: (c0.devices && Array.isArray(c0.devices)) ? c0.devices
                   : (c0.powerups && Array.isArray(c0.powerups)) ? c0.powerups : [],
          media: { ...(c0.media || {}) },
          icons: { ...(c0.icons || {}), ...DEFAULT_ICONS },
          appearance: { ...dc.appearance, ...(c0.appearance || {}) },
        };

        setSuite(normalized);
        setConfig(seedDefaults(merged)); // ensure defaults & pool exist
        setSelected(null); setEditing(null); setDirty(false);
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
      media: {}, icons: DEFAULT_ICONS,
      appearance: defaultAppearance(),
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

  async function saveAll() {
    if (!suite || !config) return;
    setStatus('Saving… (this may trigger a redeploy)');
    const qs = activeSlug ? `?slug=${encodeURIComponent(activeSlug)}` : '';
    const [a,b] = await Promise.all([
      fetch('/api/save' + qs,        { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ missions: suite }) }),
      fetch('/api/save-config' + qs, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ config }) }),
    ]);
    const ok = a.ok && b.ok;
    if (!ok) setStatus('❌ Save failed:\n' + (await a.text()) + '\n' + (await b.text()));
    else     setStatus('✅ Saved (files committed). Vercel will redeploy the Game project if /game files changed.');
  }
  async function handlePublish() {
    try {
      setStatus('Publishing…');
      const res  = await fetch(`/api/game/${activeSlug || ''}?channel=published`, {
        method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ action:'publish' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Publish failed');
      setStatus(`✅ Published v${data?.version || ''} — Vercel is redeploying the Game`);
    } catch (e) {
      setStatus('❌ Publish failed: ' + (e?.message || e));
    }
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
      onCorrect: defaultResponse('correct'),
      onWrong:   defaultResponse('wrong'),
      content: defaultContentForType('multiple_choice'),
      appearanceOverrideEnabled: false,
      appearance: defaultAppearance(),
    };
    setEditing(draft); setSelected(null); setDirty(true);
  }
  function editExisting(m) {
    const e = JSON.parse(JSON.stringify(m));
    e.appearanceOverrideEnabled = !!e.appearanceOverrideEnabled;
    e.appearance = { ...defaultAppearance(), ...(e.appearance || {}) };
    e.onCorrect = normalizeResponse(e.onCorrect, 'correct');
    e.onWrong   = normalizeResponse(e.onWrong, 'wrong');
    setEditing(e); setSelected(m.id); setDirty(false);
  }
  function cancelEdit() { setEditing(null); setSelected(null); setDirty(false); }
  function bumpVersion(v) {
    const p = String(v || '0.0.0').split('.').map(n=>parseInt(n||'0',10)); while (p.length<3) p.push(0); p[2]+=1; return p.join('.');
  }

  // optional fields set (won’t block saving)
  const OPTIONAL = new Set(['acceptable','mediaUrl','overlayText','imageUrl','videoUrl']);

  function saveToList() {
    if (!editing || !suite) return;
    if (!editing.id || !editing.title || !editing.type) return setStatus('❌ Fill id, title, type');

    // Validate per type
    if (editing.type === 'short_answer') {
      const q = editing.content?.question?.trim();
      const a = editing.content?.answer?.trim();
      if (!q) return setStatus('❌ Missing: Question');
      if (!a) return setStatus('❌ Missing: Correct Answer');
    } else if (editing.type === 'multiple_choice') {
      const q = editing.content?.question?.trim();
      const choices = Array.isArray(editing.content?.choices) ? editing.content.choices.filter(Boolean) : [];
      const ci = editing.content?.correctIndex;
      if (!q) return setStatus('❌ Missing: Question');
      if (choices.length < 2) return setStatus('❌ Multiple Choice requires at least 2 options');
      if (!(Number.isInteger(ci) && ci >= 0 && ci < choices.length)) return setStatus('❌ Pick a correct option (radio)');
    } else {
      // Generic: only block truly required numeric fields (Leaflet picker covers geo)
      // Nothing extra
    }

    // Enforce only non-optional textual fields if given in TYPE_FIELDS
    const fields = TYPE_FIELDS[editing.type] || [];
    for (const f of fields) {
      if (f.type === 'number') continue;
      if (OPTIONAL.has(f.key)) continue;
      const v = editing.content?.[f.key];
      if (v === undefined || v === null || v === '') return setStatus('❌ Missing: ' + f.label);
    }

    const missions = [...(suite.missions || [])];
    const i = missions.findIndex(m => m.id === editing.id);
    const obj = { ...editing };
    if (!obj.appearanceOverrideEnabled) delete obj.appearance;
    // tidy responses
    obj.onCorrect = normalizeResponse(obj.onCorrect, 'correct');
    obj.onWrong   = normalizeResponse(obj.onWrong, 'wrong');

    if (i >= 0) missions[i] = obj; else missions.push(obj);
    setSuite({ ...suite, missions, version: bumpVersion(suite.version || '0.0.0') });
    setSelected(editing.id); setEditing(null); setDirty(false);
    setStatus('✅ Mission saved (remember Save All)');
  }
  function removeMission(id) {
    if (!suite) return;
    setSuite({ ...suite, missions: (suite.missions || []).filter(m => m.id !== id) });
    if (selected === id) { setSelected(null); setEditing(null); }
  }
  function moveMission(idx, dir) {
    if (!suite) return;
    const list = [...(suite.missions || [])];
    const j = idx + dir; if (j < 0 || j >= list.length) return;
    const [row] = list.splice(idx, 1); list.splice(j, 0, row);
    setSuite({ ...suite, missions: list });
  }
  function duplicateMission(idx) {
    const list = [...(suite.missions || [])];
    const src  = list[idx]; if (!src) return;
    const cp   = JSON.parse(JSON.stringify(src));
    cp.id      = suggestId();
    cp.title   = (src.title || 'Copy') + ' (copy)';
    list.splice(idx + 1, 0, cp);
    setSuite({ ...suite, missions: list });
    setStatus('✅ Duplicated (remember Save All)');
  }

  /* Devices (Map-Side Manager) */
  const devices = getDevices();
  function addDevice() {
    setPlacingDev(true);
    setSelectedDevIdx(null);
    setDevDraft({ title:'', type:'smoke', iconKey:'', pickupRadius:100, effectSeconds:120, lat:null, lng:null });
  }
  function saveDraftDevice() {
    if (devDraft.lat == null || devDraft.lng == null) { setStatus('❌ Click the map or search an address to set device location'); return; }
    const item = {
      id: 'd' + String((devices?.length || 0) + 1).padStart(2, '0'),
      title: devDraft.title || (devDraft.type.charAt(0).toUpperCase()+devDraft.type.slice(1)),
      type: devDraft.type,
      iconKey: devDraft.iconKey || '',
      pickupRadius: clamp(Number(devDraft.pickupRadius || 0), 1, 2000),
      effectSeconds: clamp(Number(devDraft.effectSeconds || 0), 5, 3600),
      lat: Number(devDraft.lat.toFixed(6)),
      lng: Number(devDraft.lng.toFixed(6)),
    };
    setDevices([...(devices || []), item]);
    setPlacingDev(false);
    setSelectedDevIdx((devices?.length || 0));
    setStatus('✅ Device added (remember Save All)');
  }
  function deleteSelectedDevice() {
    if (selectedDevIdx == null) return;
    const list = [...devices];
    list.splice(selectedDevIdx, 1);
    setDevices(list);
    setSelectedDevIdx(null);
  }
  function duplicateSelectedDevice() {
    if (selectedDevIdx == null) return;
    const src = devices[selectedDevIdx]; if (!src) return;
    const copy = { ...JSON.parse(JSON.stringify(src)) };
    copy.id = 'd' + String((devices?.length || 0) + 1).padStart(2, '0');
    setDevices([...(devices || []), copy]);
    setSelectedDevIdx((devices?.length || 0));
  }
  function moveSelectedDevice(lat, lng) {
    if (selectedDevIdx == null) return;
    const list = [...devices];
    list[selectedDevIdx] = { ...list[selectedDevIdx], lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
    setDevices(list);
  }
  function setSelectedDeviceRadius(r) {
    if (selectedDevIdx == null) return;
    const list = [...devices];
    list[selectedDevIdx] = { ...list[selectedDevIdx], pickupRadius: clamp(Number(r||0), 1, 2000) };
    setDevices(list);
  }

  // Address search (by the map) — Nominatim
  async function devSearch(e) {
    e?.preventDefault();
    const q = devSearchQ.trim();
    if (!q) return;
    setDevSearching(true); setDevResults([]);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=8&addressdetails=1`;
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const j = await r.json();
      setDevResults(Array.isArray(j) ? j : []);
    } catch { setDevResults([]); }
    setDevSearching(false);
  }
  function applySearchResult(r) {
    const lat = Number(r.lat), lon = Number(r.lon);
    if (placingDev) {
      setDevDraft(d => ({ ...d, lat, lng: lon }));
    } else if (selectedDevIdx != null) {
      moveSelectedDevice(lat, lon);
    } else {
      setPlacingDev(true);
      setDevDraft(d => ({ ...d, lat, lng: lon }));
    }
    setDevResults([]);
  }
  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      applySearchResult({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    });
  }

  // upload helper: add to /public/media/... and add to media pool
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
    const url = `/${path.replace(/^public\//,'')}`;
    if (res.ok) {
      setUploadStatus(`✅ Uploaded ${safeName}`);
      // add to media pool for picker
      setConfig(prev => {
        const pool = Array.isArray(prev?.media?.pool) ? [...prev.media.pool] : [];
        if (!pool.includes(url)) pool.push(url);
        return { ...prev, media: { ...(prev.media||{}), pool } };
      });
      return url;
    } else {
      setUploadStatus(`❌ ${j?.error || 'upload failed'}`);
      return '';
    }
  }

  function getDeviceIconUrl(cfg, key) {
    if (!key) return '';
    const list = cfg?.icons?.devices || [];
    const it = list.find((x) => (x.key || '') === key);
    return it?.url ? toDirectMediaURL(it.url) : '';
  }

  /* Avoid SSR crash if loading */
  if (!suite || !config) {
    return (
      <main style={{ maxWidth: 900, margin: '40px auto', color: '#9fb0bf', padding: 16 }}>
        <div style={{ padding: 16, borderRadius: 12, border: '1px solid #1f262d', background: '#12181d' }}>
          Loading… (pulling config & missions)
        </div>
      </main>
    );
  }

  return (
    <div style={S.body}>
      <header style={S.header}>
        <div style={S.wrap}>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            {['settings','missions','text','devices','map','media','rewards','test'].map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{ ...S.tab, ...(tab===t?S.tabActive:{}) }}>
                {t.toUpperCase()}
              </button>
            ))}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:8 }}>
              <label style={{ color:'#9fb0bf', fontSize:12 }}>Game:</label>
              <select value={activeSlug} onChange={(e)=>setActiveSlug(e.target.value)} style={{ ...S.input, width:280 }}>
                <option value="">(legacy root)</option>
                {games.map(g=>(
                  <option key={g.slug} value={g.slug}>{g.title} — {g.slug} ({g.mode||'single'})</option>
                ))}
              </select>
              <button style={S.button} onClick={()=>setShowNewGame(true)}>+ New Game</button>
            </div>

            <button onClick={startNew} style={S.button}>+ New Mission</button>

            <button onClick={saveAll} style={S.button}>💾 Save All</button>
            <button onClick={handlePublish} style={{ ...S.button, background:'#103217', border:'1px solid #1d5c2a' }}>Publish</button>

            <a href={activeSlug?`/games/${encodeURIComponent(activeSlug)}/missions.json`:'/missions.json'} target="_blank" rel="noreferrer" style={{ ...S.button }}>
              View missions.json
            </a>
            <a href={activeSlug?`/api/config?slug=${encodeURIComponent(activeSlug)}`:'/config.json'} target="_blank" rel="noreferrer" style={{ ...S.button }}>
              View config.json
            </a>
          </div>
          <div style={{ color:'#9fb0bf', marginTop:6, whiteSpace:'pre-wrap' }}>{status}</div>
        </div>
      </header>

      {/* MISSIONS (left list) + MAP (right) with Device Manager */}
      {tab==='missions' && (
        <main style={S.wrapGrid2}>
          {/* Left list */}
          <aside style={S.sidebarTall}>
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

          {/* Right side: Device Manager + Overview Map; mission editor overlays here */}
          <section style={{ position:'relative' }}>
            <div style={S.card}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:12, marginBottom:8 }}>
                <div>
                  <h3 style={{ margin:0 }}>Overview Map</h3>
                  <div style={{ color:'#9fb0bf', fontSize:12 }}>
                    Click to place a device (when “Add Device” is active). If a device is selected, click to move it.
                    If none selected, click moves the nearest pin.
                  </div>
                </div>
                <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <input type="checkbox" checked={showRings} onChange={(e)=>setShowRings(e.target.checked)}/> Show radius rings
                </label>
              </div>

              {/* Device Manager controls row */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:8, marginBottom:8, alignItems:'center' }}>
                {/* Address bar + search */}
                <form onSubmit={devSearch} style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:8 }}>
                  <input
                    placeholder="Search address or place for device…"
                    style={S.input}
                    value={devSearchQ}
                    onChange={(e)=>setDevSearchQ(e.target.value)}
                  />
                  <button type="button" style={S.button} onClick={useMyLocation}>📍 My location</button>
                  <button type="submit" disabled={devSearching} style={S.button}>{devSearching ? 'Searching…' : 'Search'}</button>
                </form>

                {/* Quick actions */}
                <div style={{ display:'flex', gap:8 }}>
                  <button style={S.button} onClick={addDevice}>+ Add Device</button>
                  <button style={S.button} disabled={selectedDevIdx==null} onClick={duplicateSelectedDevice}>⧉ Duplicate</button>
                  <button style={S.button} disabled={selectedDevIdx==null} onClick={deleteSelectedDevice}>🗑 Delete</button>
                </div>

                {/* Radius slider for selected or draft */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center' }}>
                  <input
                    type="range" min={5} max={2000} step={5}
                    value={selectedDevIdx!=null ? (devices[selectedDevIdx]?.pickupRadius || 0) : (devDraft.pickupRadius || 0)}
                    onChange={(e)=>{
                      const r = Number(e.target.value);
                      if (selectedDevIdx!=null) setSelectedDeviceRadius(r);
                      else setDevDraft(d=>({ ...d, pickupRadius: r }));
                    }}
                  />
                  <code style={{ color:'#9fb0bf' }}>
                    {(selectedDevIdx!=null ? (devices[selectedDevIdx]?.pickupRadius||0) : (devDraft.pickupRadius||0))} m
                  </code>
                </div>
              </div>

              {/* Search results */}
              {devResults.length>0 && (
                <div style={{ background:'#0b0c10', border:'1px solid #2a323b', borderRadius:10, padding:8, marginBottom:8, maxHeight:160, overflow:'auto' }}>
                  {devResults.map((r,i)=>(
                    <div key={i} onClick={()=>applySearchResult(r)} style={{ padding:'6px 8px', cursor:'pointer', borderBottom:'1px solid #1f262d' }}>
                      <div style={{ fontWeight:600 }}>{r.display_name}</div>
                      <div style={{ color:'#9fb0bf', fontSize:12 }}>lat {Number(r.lat).toFixed(6)}, lng {Number(r.lon).toFixed(6)}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Compact list of devices to select */}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                {(devices||[]).map((d,i)=>(
                  <button
                    key={d.id||i}
                    style={{
                      ...S.button, padding:'6px 10px',
                      background: selectedDevIdx===i ? '#1a2027' : '#0f1418',
                      borderColor: selectedDevIdx===i ? '#2a5c8a' : '#2a323b'
                    }}
                    onClick={() => { setSelectedDevIdx(i); setPlacingDev(false); }}
                    title={`${d.title||d.type} (#${i+1})`}
                  >
                    D{i+1} {d.title ? `— ${d.title}` : ''}
                  </button>
                ))}
                {placingDev && <span style={{ color:'#9fb0bf' }}>Placing new device: click map to set location, then “Save Device”.</span>}
              </div>

              {/* Selected device quick edit (with thumbnail) */}
              {!placingDev && selectedDevIdx!=null && devices[selectedDevIdx] && (
                <div style={{ border:'1px solid #22303c', borderRadius:10, padding:10, marginBottom:8 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'36px 1fr 1fr 1fr 1fr', gap:8, alignItems:'center' }}>
                    <div style={{ width:36, height:36, borderRadius:6, overflow:'hidden', border:'1px solid #2a323b' }}>
                      {(() => {
                        const d = devices[selectedDevIdx];
                        const u = getDeviceIconUrl(config, d.iconKey) || U.smoke;
                        return <img src={toDirectMediaURL(u)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>;
                      })()}
                    </div>
                    <div>
                      <div style={{ fontSize:12, color:'#9fb0bf', marginBottom:6 }}>Title</div>
                      <input
                        style={S.input}
                        value={devices[selectedDevIdx].title || ''}
                        onChange={(e)=> {
                          const next=[...devices]; next[selectedDevIdx] = { ...next[selectedDevIdx], title:e.target.value };
                          setDevices(next);
                        }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize:12, color:'#9fb0bf', marginBottom:6 }}>Type</div>
                      <select
                        style={S.input}
                        value={devices[selectedDevIdx].type || 'smoke'}
                        onChange={(e)=> {
                          const next=[...devices]; next[selectedDevIdx] = { ...next[selectedDevIdx], type:e.target.value };
                          setDevices(next);
                        }}
                      >
                        {DEVICE_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize:12, color:'#9fb0bf', marginBottom:6 }}>Icon</div>
                      <select
                        style={S.input}
                        value={devices[selectedDevIdx].iconKey || ''}
                        onChange={(e)=> {
                          const next=[...devices]; next[selectedDevIdx] = { ...next[selectedDevIdx], iconKey:e.target.value };
                          setDevices(next);
                        }}
                      >
                        <option value="">(default)</option>
                        {(config.icons?.devices||[]).map(it=><option key={it.key} value={it.key}>{it.name||it.key}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize:12, color:'#9fb0bf', marginBottom:6 }}>Effect (sec)</div>
                      <input
                        type="number" min={5} max={3600}
                        style={S.input}
                        value={devices[selectedDevIdx].effectSeconds || 60}
                        onChange={(e)=> {
                          const next=[...devices];
                          next[selectedDevIdx] = {
                            ...next[selectedDevIdx],
                            effectSeconds: clamp(Number(e.target.value||0),5,3600)
                          };
                          setDevices(next);
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop:8, color:'#9fb0bf' }}>
                    Click the map to move this device; use the slider to change pickup radius.
                  </div>
                </div>
              )}

              {/* New device (placing) panel with thumbnail */}
              {placingDev && (
                <div style={{ border:'1px solid #22303c', borderRadius:10, padding:10, marginBottom:8 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'36px 1fr 1fr 1fr 1fr', gap:8, alignItems:'center' }}>
                    <div style={{ width:36, height:36, borderRadius:6, overflow:'hidden', border:'1px solid #2a323b' }}>
                      {(() => {
                        const u = getDeviceIconUrl(config, devDraft.iconKey) || U.smoke;
                        return <img src={toDirectMediaURL(u)} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>;
                      })()}
                    </div>
                    <Field label="Title">
                      <input style={S.input} value={devDraft.title}
                        onChange={(e)=>setDevDraft(d=>({ ...d, title:e.target.value }))}/>
                    </Field>
                    <Field label="Type">
                      <select style={S.input} value={devDraft.type}
                        onChange={(e)=>setDevDraft(d=>({ ...d, type:e.target.value }))}>
                        {DEVICE_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Icon">
                      <select style={S.input} value={devDraft.iconKey}
                        onChange={(e)=>setDevDraft(d=>({ ...d, iconKey:e.target.value }))}>
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

              {/* Map */}
              <MapOverview
                missions={(suite?.missions)||[]}
                devices={(config?.devices)||[]}
                icons={config.icons || DEFAULT_ICONS}
                showRings={showRings}
                interactive={placingDev}
                draftDevice={placingDev ? { lat:devDraft.lat, lng:devDraft.lng, radius:devDraft.pickupRadius } : null}
                selectedDevIdx={selectedDevIdx}
                onDraftChange={(lat,lng)=>setDevDraft(d=>({ ...d, lat, lng }))}
                onMoveSelected={(lat,lng)=>moveSelectedDevice(lat,lng)}
                onMoveNearest={(kind, idx, lat, lng)=>{
                  if (kind==='mission') {
                    const list=[...(suite?.missions||[])];
                    const m=list[idx]; if (!m) return;
                    const c={ ...(m.content||{}) };
                    c.lat=Number(lat.toFixed(6)); c.lng=Number(lng.toFixed(6));
                    c.geofenceEnabled=true; c.radiusMeters=Number(c.radiusMeters||25);
                    list[idx]={ ...m, content:c };
                    setSuite({ ...suite, missions:list });
                    setStatus(`Moved mission #${idx+1}`);
                  } else {
                    const list=[...(getDevices()||[])];
                    const d=list[idx]; if (!d) return;
                    d.lat=Number(lat.toFixed(6)); d.lng=Number(lng.toFixed(6));
                    setDevices(list);
                    setStatus(`Moved device D${idx+1}`);
                  }
                }}
              />
            </div>

            {/* Overlay mission editor */}
            {editing && (
              <div style={S.overlay}>
                <div style={{ ...S.card, width:'min(820px, 92vw)', maxHeight:'80vh', overflowY:'auto' }}>
                  {/* Sticky top controls */}
                  <div style={{ position:'sticky', top:0, background:'#12181d', zIndex:2, paddingBottom:8, marginBottom:8, borderBottom:'1px solid #1f262d' }}>
                    <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                      <button style={S.button} onClick={saveToList}>Save Mission</button>
                      <button style={S.button} onClick={cancelEdit}>Close</button>
                    </div>
                  </div>

                  <h3 style={{ marginTop:0 }}>Edit Mission</h3>
                  <Field label="ID"><input style={S.input} value={editing.id} onChange={(e)=>{ setEditing({ ...editing, id:e.target.value }); setDirty(true); }}/></Field>
                  <Field label="Title"><input style={S.input} value={editing.title} onChange={(e)=>{ setEditing({ ...editing, title:e.target.value }); setDirty(true); }}/></Field>
                  <Field label="Type">
                    <select style={S.input} value={editing.type}
                      onChange={(e)=>{ const t=e.target.value; setEditing({ ...editing, type:t, content:defaultContentForType(t) }); setDirty(true); }}>
                      {Object.keys(TYPE_FIELDS).map(k=>(
                        <option key={k} value={k}>{TYPE_LABELS[k] || k}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Icon">
                    <select style={S.input} value={editing.iconKey || ''} onChange={(e)=>{ setEditing({ ...editing, iconKey:e.target.value }); setDirty(true); }}>
                      <option value="">(default)</option>
                      {(config.icons?.missions||[]).map(it=><option key={it.key} value={it.key}>{it.name||it.key}</option>)}
                    </select>
                  </Field>

                  <hr style={S.hr}/>

                  {/* MC editor */}
                  {editing.type==='multiple_choice' && (
                    <div style={{ marginBottom:12 }}>
                      <MultipleChoiceEditor
                        value={Array.isArray(editing.content?.choices)?editing.content.choices:[]}
                        correctIndex={editing.content?.correctIndex}
                        onChange={({ choices, correctIndex })=>{
                          setEditing({ ...editing, content:{ ...editing.content, choices, correctIndex } }); setDirty(true);
                        }}
                      />
                    </div>
                  )}

                  {/* Response settings for Q/A missions */}
                  {(editing.type==='multiple_choice' || editing.type==='short_answer') && (
                    <>
                      <ResponseEditor
                        title="Correct Answer response"
                        value={normalizeResponse(editing.onCorrect,'correct')}
                        showClueOption
                        devices={config?.devices || config?.powerups || []}
                        icons={config.icons || DEFAULT_ICONS}
                        onChange={(v)=>{ setEditing({ ...editing, onCorrect: v }); setDirty(true); }}
                      />
                      <ResponseEditor
                        title="Wrong Answer response"
                        value={normalizeResponse(editing.onWrong,'wrong')}
                        devices={config?.devices || config?.powerups || []}
                        icons={config.icons || DEFAULT_ICONS}
                        onChange={(v)=>{ setEditing({ ...editing, onWrong: v }); setDirty(true); }}
                      />
                    </>
                  )}

                  {/* Stored Statement composer */}
                  {editing.type === 'stored_statement' && (
                    <div style={{ marginBottom: 12, border:'1px solid #22303c', borderRadius:10, padding:12 }}>
                      <div style={{ fontWeight:600, marginBottom:8 }}>Compose stored statement</div>

                      <Field label="Template (click IDs below to insert a tag like #m03# where your cursor is)">
                        <textarea
                          style={{ ...S.input, height: 130, fontFamily:'ui-monospace, Menlo' }}
                          value={editing.content?.template || ''}
                          onChange={(e)=>{ setEditing({ ...editing, content:{ ...(editing.content||{}), template:e.target.value } }); setDirty(true); }}
                          ref={(el)=>{ if (el) editing.__tplRef = el; }}
                        />
                      </Field>

                      <div style={{ color:'#9fb0bf', fontSize:12, marginBottom:6 }}>Click an ID to insert:</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                        {(suite.missions || []).map((mm) => (
                          <button
                            key={mm.id}
                            type="button"
                            style={{ ...S.button, padding:'6px 10px' }}
                            onClick={()=>{
                              const tag = `#${String(mm.id).toLowerCase()}#`;
                              const ta = editing.__tplRef;
                              if (ta) {
                                const s = ta.selectionStart || 0, e = ta.selectionEnd || 0;
                                const v = editing.content?.template || '';
                                const next = v.slice(0, s) + tag + v.slice(e);
                                setEditing({ ...editing, content:{ ...(editing.content||{}), template: next } });
                                setDirty(true);
                                requestAnimationFrame(()=>{ ta.focus(); ta.selectionStart = ta.selectionEnd = s + tag.length; });
                              } else {
                                setEditing({ ...editing, content:{ ...(editing.content||{}), template: (editing.content?.template || '') + tag } });
                                setDirty(true);
                              }
                            }}
                          >
                            {`#${mm.id}#`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Geofence types */}
                  {(editing.type==='geofence_image'||editing.type==='geofence_video') && (
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:12, color:'#9fb0bf', marginBottom:6 }}>Pick location & radius</div>
                      <MapPicker
                        lat={editing.content?.lat} lng={editing.content?.lng} radius={editing.content?.radiusMeters ?? 25}
                        onChange={(lat,lng,rad)=>{ setEditing({ ...editing, content:{ ...editing.content, lat, lng, radiusMeters:rad } }); setDirty(true); }}
                      />
                    </div>
                  )}

                  {/* Optional geofence for others */}
                  {(editing.type==='multiple_choice'||editing.type==='short_answer'||editing.type==='statement'||editing.type==='video'||editing.type==='stored_statement') && (
                    <div style={{ marginBottom:12 }}>
                      <label style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
                        <input type="checkbox" checked={!!editing.content?.geofenceEnabled}
                          onChange={(e)=>{ const on=e.target.checked;
                            const next={ ...editing.content, geofenceEnabled:on };
                            if (on && (!next.lat || !next.lng)) { next.lat=44.9778; next.lng=-93.265; }
                            setEditing({ ...editing, content:next }); setDirty(true);
                          }}/> Enable geofence for this mission
                      </label>
                      {editing.content?.geofenceEnabled && (
                        <>
                          <MapPicker
                            lat={editing.content?.lat} lng={editing.content?.lng} radius={editing.content?.radiusMeters ?? 25}
                            onChange={(lat,lng,rad)=>{ setEditing({ ...editing, content:{ ...editing.content, lat, lng, radiusMeters:rad } }); setDirty(true); }}
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

                  {(TYPE_FIELDS[editing.type]||[]).map(f=>(
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
                            setEditing({ ...editing, content:{ ...editing.content, [f.key]:v } }); setDirty(true);
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

                  <hr style={S.hr}/>

                  <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <input type="checkbox" checked={!!editing.appearanceOverrideEnabled}
                      onChange={(e)=>{ setEditing({ ...editing, appearanceOverrideEnabled:e.target.checked }); setDirty(true); }}/>
                    Use custom appearance for this mission
                  </label>
                  {editing.appearanceOverrideEnabled && (
                    <AppearanceEditor value={editing.appearance||defaultAppearance()}
                      onChange={(next)=>{ setEditing({ ...editing, appearance:next }); setDirty(true); }}/>
                  )}

                  {/* Bottom controls mirror (for convenience) */}
                  <div style={{ display:'flex', gap:8, marginTop:12 }}>
                    <button style={S.button} onClick={saveToList}>Save Mission</button>
                    <button style={S.button} onClick={cancelEdit}>Close</button>
                  </div>
                  {dirty && <div style={{ marginTop:6, color:'#ffd166' }}>Unsaved changes…</div>}
                </div>
              </div>
            )}
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
                {GAME_TYPES.map(g=><option key={g} value={g}>{g}</option>)}
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

      {/* DEVICES tab (simple list) */}
      {tab==='devices' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <h3 style={{ marginTop:0 }}>Devices</h3>
            {(devices||[]).length===0 && <div style={{ color:'#9fb0bf' }}>No devices yet. Use “Add Device” on the Missions tab or map-side manager.</div>}
            <ul style={{ paddingLeft:18 }}>
              {(devices||[]).map((x,i)=>(
                <li key={x.id||i} style={{ marginBottom:8 }}>
                  <code>D{i+1}</code> — {x.title||'(untitled)'} • {x.type} • radius {x.pickupRadius}m • effect {x.effectSeconds}s
                  {typeof x.lat==='number' && typeof x.lng==='number' ? <> • lat {x.lat}, lng {x.lng}</> : ' • (not placed)'}
                  {x.iconKey?<> • icon <code>{x.iconKey}</code></>:null}
                  <button style={{ ...S.button, marginLeft:8, padding:'6px 10px' }}
                    onClick={()=>{ const next=[...devices]; next.splice(i,1); setDevices(next); }}>Remove</button>
                </li>
              ))}
            </ul>
          </div>
        </main>
      )}

      {/* MAP (read-only large) */}
      {tab==='map' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:8 }}>
              <h3 style={{ margin:0 }}>Game Map</h3>
              <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                <input type="checkbox" checked={showRings} onChange={(e)=>setShowRings(e.target.checked)}/> Show radius rings
              </label>
            </div>
            <MapOverview missions={(suite?.missions)||[]} devices={devices} icons={config.icons||DEFAULT_ICONS} showRings={showRings}/>
          </div>
        </main>
      )}

      {/* MEDIA (uploads + icons + re-seed + picker) */}
      {tab==='media' && (
        <MediaTab
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

      {/* REWARDS */}
      {tab==='rewards' && <RewardsTab config={config} setConfig={setConfig}/>}

      {/* TEST */}
      {tab==='test' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <h3 style={{ margin:0 }}>Play Test</h3>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <label>Channel:&nbsp;
                  <select value={testChannel} onChange={(e)=>setTestChannel(e.target.value)} style={S.input}>
                    <option value="draft">draft</option>
                    <option value="published">published</option>
                  </select>
                </label>
                <TestLauncher slug={activeSlug||''} channel={testChannel} preferPretty={true} popup={false}/>
              </div>
            </div>
            {!gameBase && <div style={{ color:'#9fb0bf', marginBottom:8 }}>Set NEXT_PUBLIC_GAME_ORIGIN to enable preview.</div>}
            {gameBase && (
              <iframe src={`${gameBase}/?slug=${activeSlug||''}&channel=${testChannel}&preview=1`}
                style={{ width:'100%', height:'70vh', border:'1px solid #22303c', borderRadius:12 }}/>
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
                {GAME_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
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
                const j = await r.json();
                if (!j.ok) { setStatus('❌ ' + (j.error||'create failed')); return; }
                const rr = await fetch('/api/games', { credentials:'include' }); const jj = await rr.json();
                if (jj.ok) setGames(jj.games || []);
                setActiveSlug(j.slug); setNewTitle(''); setShowNewGame(false);
              }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Response editor (Correct/Wrong) ───────────────────────── */
function defaultResponse(kind='correct') {
  return {
    show: { kind:'none', mediaUrl:'', audioUrl:'', text:'' },
    action: { kind:'none', deviceKey:'', seconds:0, clueText:'' },
  };
}
function normalizeResponse(r, kind='correct') {
  const d = defaultResponse(kind);
  const x = { ...(r||{}) };
  x.show   = { ...d.show, ...(x.show||{}) };
  x.action = { ...d.action, ...(x.action||{}) };
  return x;
}
function ResponseEditor({ title, value, onChange, showClueOption=false, devices=[], icons={} }) {
  const v = normalizeResponse(value);

  return (
    <div style={{ marginBottom:12, border:'1px solid #22303c', borderRadius:10, padding:12 }}>
      <div style={{ fontWeight:600, marginBottom:8 }}>{title}</div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
        <Field label="Show">
          <select
            style={S.input}
            value={v.show.kind}
            onChange={(e)=>onChange({ ...v, show:{ ...v.show, kind:e.target.value } })}
          >
            <option value="none">None</option>
            <option value="image">Image</option>
            <option value="video">Video</option>
            <option value="gif">GIF</option>
            <option value="audio">Audio (+image optional)</option>
            <option value="statement">Statement</option>
          </select>
        </Field>

        {(v.show.kind==='image' || v.show.kind==='video' || v.show.kind==='gif' || v.show.kind==='audio') && (
          <Field label={v.show.kind==='audio' ? 'Image/GIF URL (optional)' : 'Media URL'}>
            <input
              style={S.input}
              value={v.show.mediaUrl}
              onChange={(e)=>onChange({ ...v, show:{ ...v.show, mediaUrl:e.target.value } })}
            />
            <MediaPreview url={v.show.mediaUrl} kind="response"/>
          </Field>
        )}

        {v.show.kind==='audio' && (
          <Field label="Audio URL (mp3)">
            <input
              style={S.input}
              value={v.show.audioUrl}
              onChange={(e)=>onChange({ ...v, show:{ ...v.show, audioUrl:e.target.value } })}
            />
          </Field>
        )}

        {v.show.kind==='statement' && (
          <Field label="Text to display">
            <textarea
              style={{ ...S.input, height:90 }}
              value={v.show.text}
              onChange={(e)=>onChange({ ...v, show:{ ...v.show, text:e.target.value } })}
            />
          </Field>
        )}
      </div>

      <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
        <Field label="Action">
          <select
            style={S.input}
            value={v.action.kind}
            onChange={(e)=>onChange({ ...v, action:{ ...v.action, kind:e.target.value } })}
          >
            <option value="none">None</option>
            <option value="deploy_device">Deploy Device</option>
            {showClueOption && <option value="clue">Give Clue</option>}
            <option value="delay">Delay</option>
          </select>
        </Field>

        {v.action.kind==='deploy_device' && (
          <Field label="Device">
            <select
              style={S.input}
              value={v.action.deviceKey || ''}
              onChange={(e)=>onChange({ ...v, action:{ ...v.action, deviceKey:e.target.value } })}
            >
              <option value="">— pick device —</option>
              {(devices||[]).map((d,i)=><option key={d.id||i} value={d.id||d.key||`d${i+1}`}>{d.title||d.type||(`Device ${i+1}`)}</option>)}
            </select>
          </Field>
        )}

        {v.action.kind==='delay' && (
          <Field label="Delay (seconds)">
            <input
              type="number"
              min={1}
              max={3600}
              style={S.input}
              value={v.action.seconds || 0}
              onChange={(e)=>onChange({ ...v, action:{ ...v.action, seconds: Math.max(1, Number(e.target.value||0)) } })}
            />
          </Field>
        )}

        {showClueOption && v.action.kind==='clue' && (
          <Field label="Clue text">
            <input
              style={S.input}
              value={v.action.clueText || ''}
              onChange={(e)=>onChange({ ...v, action:{ ...v.action, clueText:e.target.value } })}
            />
          </Field>
        )}
      </div>
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
            {FONT_FAMILIES.map(f=><option key={f.v} value={f.v}>{f.label}</option>)}
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
      {[0,1,2,3,4].map(i=>(
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
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ color:'#9fb0bf', fontSize:12, marginBottom:6 }}>Preview ({kind})</div>
      {isVideo ? (
        <video src={u} controls style={{ width:'100%', maxHeight:260, borderRadius:10, border:'1px solid #2a323b' }}/>
      ) : isImage ? (
        <img src={u} alt="preview" style={{ width:'100%', maxHeight:260, objectFit:'contain', borderRadius:10, border:'1px solid #2a323b' }}/>
      ) : (
        <a href={u} target="_blank" rel="noreferrer" style={{ color:'#9fb0bf', textDecoration:'underline' }}>Open media</a>
      )}
    </div>
  );
}

/* Styles */
const S = {
  body: { background:'#0b0c10', color:'#e9eef2', minHeight:'100vh', fontFamily:'system-ui, Arial, sans-serif' },
  header: { padding:16, background:'#11161a', borderBottom:'1px solid #1f2329' },
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

/* MapOverview — same as before (placement/move/nearest) */
function MapOverview({
  missions = [], devices = [], icons = DEFAULT_ICONS, showRings = true,
  interactive = false, draftDevice = null, selectedDevIdx = null,
  onDraftChange = null, onMoveSelected = null, onMoveNearest = null,
}) {
  const divRef = React.useRef(null);
  const [leafletReady, setLeafletReady] = React.useState(!!(typeof window !== 'undefined' && window.L));

  function getMissionPos(m){ const c=m?.content||{}; const lat=Number(c.lat), lng=Number(c.lng);
    if(!isFinite(lat)||!isFinite(lng))return null; if(!(c.geofenceEnabled||Number(c.radiusMeters)>0))return null; return [lat,lng]; }
  function getDevicePos(d){ const lat=Number(d?.lat),lng=Number(d?.lng); if(!isFinite(lat)||!isFinite(lng))return null; return [lat,lng]; }
  function iconUrl(kind,key){ if(!key)return''; const list=icons?.[kind]||[]; const it=list.find(x=>x.key===key); return it?toDirectMediaURL(it.url||''):''; }
  function numberedIcon(number, imgUrl, color='#60a5fa', highlight=false){
    const img = imgUrl
      ? `<img src="${imgUrl}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;border:2px solid ${highlight?'#22c55e':'white'};box-shadow:0 0 0 2px #1f2937"/>`
      : `<div style="width:20px;height:20px;border-radius:50%;background:${color};border:2px solid ${highlight?'#22c55e':'white'};box-shadow:0 0 0 2px #1f2937"></div>`;
    return window.L.divIcon({
      className:'num-pin',
      html:`<div style="position:relative;display:grid;place-items:center">${img}<div style="position:absolute;bottom:-12px;left:50%;transform:translateX(-50%);font-weight:700;font-size:12px;color:#fff;text-shadow:0 1px 2px #000">${number}</div></div>`,
      iconSize:[24,28], iconAnchor:[12,12]
    });
  }

  useEffect(()=>{ if(typeof window==='undefined')return;
    if(window.L){ setLeafletReady(true); return; }
    const link=document.createElement('link'); link.rel='stylesheet'; link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link);
    const s=document.createElement('script'); s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.async=true; s.onload=()=>setLeafletReady(true); document.body.appendChild(s);
  },[]);

  useEffect(()=>{
    if(!leafletReady || !divRef.current || typeof window==='undefined') return;
    const L = window.L; if (!L) return;

    if(!divRef.current._leaflet_map){
      const map=L.map(divRef.current,{ center:[44.9778,-93.2650], zoom:13 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{ maxZoom:19, attribution:'© OpenStreetMap contributors' }).addTo(map);
      divRef.current._leaflet_map=map;
    }
    const map=divRef.current._leaflet_map;

    if(!map._layerGroup) map._layerGroup=L.layerGroup().addTo(map);
    map._layerGroup.clearLayers();
    const layer=map._layerGroup;
    const bounds=L.latLngBounds([]);

    (missions||[]).forEach((m,idx)=>{
      const pos=getMissionPos(m); if(!pos) return;
      const url=iconUrl('missions', m.iconKey);
      L.marker(pos,{icon:numberedIcon(idx+1,url,'#60a5fa',false)}).addTo(layer);
      const rad=Number(m.content?.radiusMeters||0);
      if(showRings && rad>0) L.circle(pos,{ radius:rad, color:'#60a5fa', fillOpacity:0.08 }).addTo(layer);
      bounds.extend(pos);
    });

    (devices||[]).forEach((d,idx)=>{
      const pos=getDevicePos(d); if(!pos) return;
      const url=iconUrl('devices', d.iconKey);
      const hl = (selectedDevIdx===idx);
      L.marker(pos,{icon:numberedIcon(`D${idx+1}`,url,'#f59e0b',hl)}).addTo(layer);
      const rad=Number(d.pickupRadius||0);
      if(showRings && rad>0) L.circle(pos,{ radius:rad, color:'#f59e0b', fillOpacity:0.08 }).addTo(layer);
      bounds.extend(pos);
    });

    if(draftDevice && typeof draftDevice.lat==='number' && typeof draftDevice.lng==='number'){
      const pos=[draftDevice.lat, draftDevice.lng];
      const mk=L.marker(pos,{ icon:numberedIcon('D+','', '#34d399',true), draggable:true }).addTo(layer);
      if(showRings && Number(draftDevice.radius)>0){
        const c=L.circle(pos,{ radius:Number(draftDevice.radius), color:'#34d399', fillOpacity:0.08 }).addTo(layer);
        mk.on('drag',()=>c.setLatLng(mk.getLatLng()));
      }
      mk.on('dragend',()=>{ const p=mk.getLatLng(); onDraftChange && onDraftChange(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))); });
      bounds.extend(pos);
    }

    if (map._clickHandler) map.off('click', map._clickHandler);
    map._clickHandler = (e) => {
      const lat=e.latlng.lat, lng=e.latlng.lng;
      if (interactive && onDraftChange) { onDraftChange(Number(lat.toFixed(6)), Number(lng.toFixed(6))); return; }
      if (selectedDevIdx!=null && onMoveSelected) { onMoveSelected(Number(lat.toFixed(6)), Number(lng.toFixed(6))); return; }

      if (!onMoveNearest) return;
      const candidates=[];
      (missions||[]).forEach((m,idx)=>{ const p=getMissionPos(m); if(p) candidates.push({ kind:'mission', idx, lat:p[0], lng:p[1] }); });
      (devices||[]).forEach((d,idx)=>{ const p=getDevicePos(d); if(p) candidates.push({ kind:'device', idx, lat:p[0], lng:p[1] }); });
      if(candidates.length===0) return;

      let best=null, bestDist=Infinity;
      candidates.forEach(c=>{ const d=map.distance([c.lat,c.lng], e.latlng); if(d<bestDist){bestDist=d; best=c;} });
      if(best) onMoveNearest(best.kind, best.idx, lat, lng);
    };
    map.on('click', map._clickHandler);

    if(bounds.isValid()) map.fitBounds(bounds.pad(0.2));
  },[leafletReady, missions, devices, icons, showRings, interactive, draftDevice, selectedDevIdx, onDraftChange, onMoveSelected, onMoveNearest]);

  return (
    <div>
      {!leafletReady && <div style={{ color:'#9fb0bf', marginBottom:8 }}>Loading map…</div>}
      <div ref={divRef} style={{ height:560, borderRadius:12, border:'1px solid #22303c', background:'#0b1116' }}/>
    </div>
  );
}

/* MEDIA tab with DnD + file chooser + Icons editors + picker + re‑apply defaults + Add URL */
function MediaTab({ config, setConfig, uploadStatus, setUploadStatus, uploadToRepo }) {
  const [hover, setHover] = useState(false);

  // picker state (global pool)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSetter, setPickerSetter] = useState(null); // function(url) -> void
  const openPicker = (setter) => { setPickerSetter(()=>setter); setPickerOpen(true); };
  const closePicker = () => { setPickerOpen(false); setPickerSetter(null); };

  const [addUrl, setAddUrl] = useState('');

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
              if (url && typeof onUploaded==='function') onUploaded(url);
            }
            e.target.value = '';
          }}/>
      </label>
    );
  }

  const pool = Array.isArray(config?.media?.pool) ? config.media.pool : [];

  return (
    <main style={S.wrap}>
      <div
        style={S.card}
        onDragEnter={(e)=>{ e.preventDefault(); e.stopPropagation(); setHover(true); }}
        onDragOver={(e)=>{ e.preventDefault(); e.stopPropagation(); }}
        onDragLeave={(e)=>{ e.preventDefault(); e.stopPropagation(); setHover(false); }}
        onDrop={handleDrop}
      >
        <h3 style={{ marginTop:0, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span>Media</span>
          <span style={{ display:'flex', gap:8 }}>
            <button
              style={S.button}
              title="Re-seed example icons, rewards and global media pool (non-destructive)"
              onClick={() => setConfig(seedDefaults(config))}
            >
              Re‑apply defaults
            </button>
          </span>
        </h3>

        <div style={{ border:'2px dashed #2a323b', borderRadius:12, padding:16, background:hover?'#0e1116':'transparent', marginBottom:12, color:'#9fb0bf' }}>
          Drag & drop files here or click <em>Choose File</em>. Files are committed to <code>public/media/…</code> and served from <code>/media/…</code>.
          <span style={{ float:'right' }}><FileChooser/><span style={{ marginLeft:8 }}>{uploadStatus}</span></span>
        </div>

        <div style={{ marginBottom:12, display:'grid', gridTemplateColumns:'1fr auto', gap:8 }}>
          <input
            style={S.input}
            placeholder="Add URL to Media Pool (https…)"
            value={addUrl}
            onChange={(e)=>setAddUrl(e.target.value)}
          />
          <button
            style={S.button}
            onClick={()=>{
              const u = addUrl.trim();
              if (!u) return;
              const p = Array.isArray(config?.media?.pool) ? [...config.media.pool] : [];
              if (!p.includes(u)) p.push(u);
              setConfig({ ...config, media:{ ...(config.media||{}), pool:p } });
              setAddUrl('');
            }}
          >Add to Pool</button>
        </div>

        <IconsEditor config={config} setConfig={setConfig} label="Mission Icons" kind="missions" uploadToRepo={uploadToRepo} openPicker={openPicker}/>
        <IconsEditor config={config} setConfig={setConfig} label="Device Icons"  kind="devices"  uploadToRepo={uploadToRepo} openPicker={openPicker}/>
        <IconsEditor config={config} setConfig={setConfig} label="Reward Icons"  kind="rewards"  uploadToRepo={uploadToRepo} openPicker={openPicker}/>
      </div>

      <PickFromMediaModal
        open={pickerOpen}
        pool={pool}
        onPick={(url)=>{ if (typeof pickerSetter === 'function') pickerSetter(url); closePicker(); }}
        onClose={closePicker}
      />
    </main>
  );
}
function IconsEditor({ config, setConfig, label, kind, uploadToRepo, openPicker }) {
  const list = config.icons?.[kind] || [];
  const setList = (next) => setConfig({ ...config, icons:{ ...(config.icons||{}), [kind]: next } });

  return (
    <div style={{ marginTop:16 }}>
      <h4 style={{ marginTop:0 }}>{label}</h4>
      <div style={{ display:'grid', gridTemplateColumns:'160px 1fr 1fr 200px', gap:8, alignItems:'center', fontSize:13, color:'#9fb0bf', marginBottom:6 }}>
        <div>Icon</div><div>Name</div><div>Key</div><div>Actions</div>
      </div>
      {list.map((row, idx)=>(
        <div key={row.key||idx} style={{ display:'grid', gridTemplateColumns:'160px 1fr 1fr 200px', gap:8, alignItems:'center', marginBottom:8 }}>
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:8 }}>
              <input style={S.input} value={row.url||''}
                onChange={(e)=>{ const n=[...list]; n[idx]={ ...(n[idx]||{}), url:e.target.value }; setList(n); }}
                placeholder="Image URL"/>
              <label style={{ ...S.button, textAlign:'center' }}>
                Choose File
                <input type="file" style={{ display:'none' }}
                  onChange={async (e)=>{ const f=e.target.files?.[0]; if (!f) return; const url=await uploadToRepo(f,'icons'); if (url) { const n=[...list]; n[idx]={ ...(n[idx]||{}), url }; setList(n); } }}/>
              </label>
              <button
                style={S.button}
                type="button"
                onClick={()=> openPicker && openPicker((url)=>{ const n=[...list]; n[idx]={ ...(n[idx]||{}), url }; setList(n); })}
              >
                Pick from Media
              </button>
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
function PickFromMediaModal({ open, pool = [], onPick, onClose }) {
  if (!open) return null;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'grid', placeItems:'center', zIndex:3000 }}>
      <div style={{ ...S.card, width:'min(900px, 92vw)' }}>
        <h4 style={{ marginTop:0 }}>Pick from Media Pool</h4>
        {(!pool || pool.length===0) ? (
          <div style={{ color:'#9fb0bf' }}>No media in the pool yet.</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:12 }}>
            {pool.map((u, i) => (
              <div key={i} style={{ border:'1px solid #2a323b', borderRadius:10, overflow:'hidden', background:'#0b0c10' }}>
                <div style={{ width:'100%', aspectRatio:'1/1', overflow:'hidden' }}>
                  <img alt="" src={toDirectMediaURL(u)} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                </div>
                <div style={{ padding:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <code style={{ color:'#9fb0bf', fontSize:11, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:140 }}>
                    {u.replace(/^https?:\/\/[^/]+/,'')}
                  </code>
                  <button style={{ ...S.button, padding:'6px 10px' }} onClick={()=>onPick(u)}>Use</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop:12, textAlign:'right' }}>
          <button style={S.button} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function RewardsTab({ config, setConfig }) {
  const list = Array.isArray(config.media?.rewards) ? config.media.rewards : DEFAULT_REWARDS_SEEDED;
  const setList = (next) => setConfig({ ...config, media:{ ...(config.media||{}), rewards: next } });
  return (
    <main style={S.wrap}>
      <div style={S.card}>
        <h3 style={{ marginTop:0 }}>Rewards</h3>
        <div style={{ display:'grid', gridTemplateColumns:'160px 1fr 1fr 1fr 200px', gap:8, alignItems:'center', fontSize:13, color:'#9fb0bf', marginBottom:6 }}>
          <div>Thumbnail</div><div>Name</div><div>Special ability</div><div>Media URL (optional)</div><div>Actions</div>
        </div>
        {list.map((row, idx)=>(
          <div key={row.key||idx} style={{ display:'grid', gridTemplateColumns:'160px 1fr 1fr 1fr 200px', gap:8, alignItems:'center', marginBottom:8 }}>
            <div>
              <input style={S.input} value={row.thumbUrl||''} onChange={(e)=>{ const n=[...list]; n[idx]={ ...(n[idx]||{}), thumbUrl:e.target.value }; setList(n); }} placeholder="Thumbnail URL"/>
              {row.thumbUrl && <img alt="thumb" src={toDirectMediaURL(row.thumbUrl)} style={{ marginTop:6, width:'100%', maxHeight:80, objectFit:'contain', border:'1px solid #2a323b', borderRadius:8 }}/>}
            </div>
            <input style={S.input} value={row.name||''} onChange={(e)=>{ const n=[...list]; n[idx]={ ...(n[idx]||{}), name:e.target.value }; setList(n); }}/>
            <input style={S.input} value={row.ability||''} onChange={(e)=>{ const n=[...list]; n[idx]={ ...(n[idx]||{}), ability:e.target.value }; setList(n); }}/>
            <input style={S.input} value={row.mediaUrl||''} onChange={(e)=>{ const n=[...list]; n[idx]={ ...(n[idx]||{}), mediaUrl:e.target.value }; setList(n); }}/>
            <div style={{ display:'flex', gap:6 }}>
              <button style={S.button} onClick={()=>{ const n=[...list]; n.splice(idx,1); setList(n); }}>Delete</button>
              <button style={S.button} onClick={()=>{ const n=[...list]; const copy={ ...(n[idx]||{}), key:(row.key||`rw${idx}`)+'-copy' }; n.splice(idx+1,0,copy); setList(n); }}>Duplicate</button>
            </div>
          </div>
        ))}
        <button style={S.button} onClick={()=>{ setList([...(list||[]), { key:`rw${list.length+1}`, name:'', ability:'', thumbUrl:'', mediaUrl:'' }]); }}>+ Add Reward</button>
      </div>
    </main>
  );
}

/* Text tab left as before (includes inline SMS test) */
function TextTab({ suite, config, setConfig, setStatus }) {
  const [smsRule, setSmsRule] = useState({ missionId: '', phoneSlot: 1, message: '', delaySec: 30 });

  function addSmsRule() {
    if (!smsRule.missionId || !smsRule.message) return setStatus('❌ Pick mission and message');
    const maxPlayers = config?.forms?.players || 1;
    if (smsRule.phoneSlot < 1 || smsRule.phoneSlot > Math.max(1, maxPlayers)) return setStatus('❌ Phone slot out of range');
    const rules = [...(config?.textRules || []), { ...smsRule, delaySec: Number(smsRule.delaySec || 0) }];
    setConfig({ ...config, textRules: rules });
    setSmsRule({ missionId: '', phoneSlot: 1, message: '', delaySec: 30 });
    setStatus('✅ SMS rule added (remember Save All)');
  }
  function removeSmsRule(idx) {
    const rules = [...(config?.textRules || [])];
    rules.splice(idx, 1);
    setConfig({ ...config, textRules: rules });
  }

  function TestSMSInline() {
    const [to, setTo] = useState('');
    const [msg, setMsg] = useState('Test message from admin');
    const [st, setSt] = useState('');
    async function send() {
      setSt('Sending…');
      const res = await fetch('/api/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, body: msg }) });
      const text = await res.text();
      setSt(res.ok ? '✅ Sent' : '❌ ' + text);
    }
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 2fr auto', alignItems: 'center' }}>
          <input placeholder="+1..." style={S.input} value={to} onChange={(e) => setTo(e.target.value)} />
          <input placeholder="Message" style={S.input} value={msg} onChange={(e) => setMsg(e.target.value)} />
          <button style={S.button} onClick={send}>Send Test</button>
        </div>
        <div style={{ marginTop: 6, color: '#9fb0bf' }}>{st}</div>
      </div>
    );
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
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{'Player ' + n}</option>)}
            </select>
          </Field>
          <Field label="Delay (sec)">
            <input type="number" min={0} max={3600} style={S.input} value={smsRule.delaySec} onChange={(e) => setSmsRule({ ...smsRule, delaySec: e.target.value })} />
          </Field>
          <Field label="Message">
            <input style={S.input} value={smsRule.message} onChange={(e) => setSmsRule({ ...smsRule, message: e.target.value })} />
          </Field>
        </div>
        <div style={{ marginTop: 12 }}><button style={S.button} onClick={addSmsRule}>+ Add Rule</button></div>
        <hr style={S.hr} />
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
          <TestSMSInline />
        </details>
      </div>
    </main>
  );
}

/* Map picker for mission editor only */
function MapPicker({ lat, lng, radius, onChange }) {
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const circleRef = useRef(null);
  const markerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [r, setR] = useState(radius || 25);
  const defaultPos = [typeof lat === 'number' ? lat : 44.9778, typeof lng === 'number' ? lng : -93.265];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.L) { setReady(true); return; }
    const link = document.createElement('link'); link.rel='stylesheet';
    link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link);
    const s = document.createElement('script'); s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.async=true; s.onload=()=>setReady(true); document.body.appendChild(s);
  }, []);
  useEffect(() => {
    if (!ready || !divRef.current || typeof window === 'undefined') return;
    const L = window.L; if (!L) return;
    if (!mapRef.current) {
      mapRef.current = L.map(divRef.current).setView(defaultPos, (typeof lat === 'number' && typeof lng === 'number') ? 16 : 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap' }).addTo(mapRef.current);
      markerRef.current = L.marker(defaultPos, { draggable:true }).addTo(mapRef.current);
      circleRef.current = L.circle(markerRef.current.getLatLng(), { radius: r || 25, color:'#33a8ff' }).addTo(mapRef.current);
      const sync = () => { const p=markerRef.current.getLatLng(); circleRef.current.setLatLng(p); circleRef.current.setRadius(Number(r||25)); onChange(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)), Number(r||25)); };
      markerRef.current.on('dragend', sync);
      mapRef.current.on('click', (e)=>{ markerRef.current.setLatLng(e.latlng); sync(); });
      sync();
    } else {
      const p=defaultPos; markerRef.current.setLatLng(p); circleRef.current.setLatLng(p); circleRef.current.setRadius(Number(r||25));
    }
  }, [ready]); // eslint-disable-line
  useEffect(()=>{ setR(radius || 25); },[radius]);
  useEffect(() => {
    if (circleRef.current && markerRef.current) {
      circleRef.current.setRadius(Number(r || 25));
      const p = markerRef.current.getLatLng();
      onChange(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)), Number(r || 25));
    }
  }, [r]); // eslint-disable-line

  return (
    <div>
      <div ref={divRef} style={{ width:'100%', height:320, borderRadius:12, overflow:'hidden', border:'1px solid #2a323b', marginBottom:8 }} />
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center' }}>
        <input type="range" min={5} max={2000} step={5} value={r} onChange={(e)=>setR(Number(e.target.value))}/>
        <code style={{ color:'#9fb0bf' }}>{r} m</code>
      </div>
    </div>
  );
}
