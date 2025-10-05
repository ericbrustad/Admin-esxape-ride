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
    const url = new URL(u);
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

/* ───────────────────────── Constants ───────────────────────── */
const TYPE_FIELDS = {
  multiple_choice: [
    { key:'question', label:'Question', type:'text' },
    { key:'mediaUrl',  label:'Image or Video URL (optional)', type:'text' },
  ],
  short_answer: [
    { key:'question',   label:'Question', type:'text' },
    { key:'answer',     label:'Correct Answer', type:'text' },
    { key:'acceptable', label:'Also Accept (comma-separated)', type:'text' },
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
    { key:'imageUrl',  label:'Image URL (https)', type:'text' },
    { key:'overlayText',label:'Caption/Text', type:'text' },
  ],
  geofence_video: [
    { key:'lat', label:'Latitude', type:'number' },
    { key:'lng', label:'Longitude', type:'number' },
    { key:'radiusMeters',    label:'Geofence Radius (m)', type:'number', min:5, max:2000 },
    { key:'cooldownSeconds', label:'Cooldown (sec)', type:'number', min:5, max:240 },
    { key:'videoUrl',  label:'Video URL (https)', type:'text' },
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
const DEFAULT_REWARDS = [
  { key:'gold-coin', name:'Gold Coin', ability:'Adds a coin to your wallet.', thumbUrl:'https://drive.google.com/open?id=1TicLeS2LLwY8nVk-7Oc6ESxk_SyvxZGw&usp=drive_fs' },
];

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

  const [suite, setSuite]   = useState(null);
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState('');

  const [selected, setSelected] = useState(null);
  const [editing, setEditing]   = useState(null);
  const [dirty, setDirty]       = useState(false);

  // Devices (map-side)
  const [devSearchQ, setDevSearchQ] = useState('');
  const [devSearching, setDevSearching] = useState(false);
  const [devResults, setDevResults] = useState([]);
  const [placingDev, setPlacingDev] = useState(false);
  const [selectedDevIdx, setSelectedDevIdx] = useState(null);
  const [devDraft, setDevDraft] = useState({ title:'', type:'smoke', iconKey:'', pickupRadius:100, effectSeconds:120, lat:null, lng:null });

  // Media pool modal
  const [poolOpen, setPoolOpen] = useState(false);
  const [pool, setPool] = useState([]); // [{name,url,thumb}]
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
          media: { ...(c0.media || {}), pool: Array.isArray(c0.media?.pool) ? c0.media.pool : [] },
          icons: { ...(c0.icons || {}), ...DEFAULT_ICONS },
          appearance: { ...dc.appearance, ...(c0.appearance || {}) },
        };

        setSuite(normalized);
        setConfig(merged);
        setSelected(null); setEditing(null); setDirty(false);
        setStatus('');

        // Load global media pool index (if exists), assign globally (default game)
        const pi = await fetchJsonSafe('/media/mediapool/index.json', { items: [] });
        setPool(Array.isArray(pi.items) ? pi.items : []);
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
      media: { pool: [] }, // ← per-game referenced pool
      icons: DEFAULT_ICONS,
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

  /* ── Missions CRUD (unchanged core) ── */
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
      if (f.type === 'number') continue;
      const v = editing.content?.[f.key];
      if (f.key !== 'mediaUrl' && (v === undefined || v === null || v === '')) return setStatus('❌ Missing: ' + f.label);
    }
    const missions = [...(suite.missions || [])];
    const i = missions.findIndex(m => m.id === editing.id);
    const obj = { ...editing };
    if (!obj.appearanceOverrideEnabled) delete obj.appearance;
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

  /* ── Devices (map-side manager) ── */
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

  // Address search (Nominatim)
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

  /* ── Media Pool helpers ── */
  const POOL_INDEX_PATH = 'public/media/mediapool/index.json';
  async function readPoolIndex() {
    const j = await fetchJsonSafe('/media/mediapool/index.json', { items: [] });
    return Array.isArray(j.items) ? j.items : [];
  }
  async function writePoolIndex(items) {
    const text = JSON.stringify({ items }, null, 2);
    const b64 = btoa(unescape(encodeURIComponent(text)));
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      credentials: 'include',
      body: JSON.stringify({ path: POOL_INDEX_PATH, contentBase64: b64, message: 'update mediapool index' }),
    });
    if (!res.ok) throw new Error('Failed to write media pool index');
  }
  function addPoolRefToGame(item) {
    const list = Array.isArray(config.media?.pool) ? [...config.media.pool] : [];
    if (!list.find(x => x.url === item.url)) list.push({ name: item.name, url: item.url, thumb: item.thumb || item.url });
    setConfig({ ...config, media: { ...(config.media||{}), pool: list } });
  }
  function removePoolRefFromGame(item) {
    const list = Array.isArray(config.media?.pool) ? [...config.media.pool] : [];
    const idx = list.findIndex(x => x.url === item.url);
    if (idx >= 0) { list.splice(idx,1); setConfig({ ...config, media: { ...(config.media||{}), pool: list } }); }
  }
  async function deleteFromLibrary(item) {
    try {
      // 1) Remove from index
      const cur = await readPoolIndex();
      const next = cur.filter(x => x.url !== item.url);
      await writePoolIndex(next);
      setPool(next);
      // 2) Try to delete the file (if you add /pages/api/delete.js later)
      const filePath = 'public' + (item.url.startsWith('/') ? item.url : '/' + item.url); // /media/mediapool/...
      const delRes = await fetch('/api/delete?path=' + encodeURIComponent(filePath), { method: 'POST', credentials:'include' });
      if (!delRes.ok) {
        setStatus('Removed from pool. To physically delete the file, add /pages/api/delete.js (GitHub delete).');
      } else {
        setStatus('Deleted from library.');
      }
    } catch (e) {
      setStatus('❌ ' + (e?.message || e));
    }
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
    if (!res.ok) { setUploadStatus(`❌ ${j?.error || 'upload failed'}`); return ''; }
    setUploadStatus(`✅ Uploaded ${safeName}`);
    return `/${path.replace(/^public\//,'')}`;
  }

  async function uploadToPool(file) {
    const url = await uploadToRepo(file, 'mediapool');
    if (!url) return '';
    const name = file.name.replace(/[^\w.\-]+/g, '_');
    const item = { name, url, thumb: url };
    try {
      const cur = await readPoolIndex();
      const next = [...cur, item];
      await writePoolIndex(next);
      setPool(next);
    } catch (e) {
      setStatus('⚠ Pool index update failed: ' + (e?.message || e));
    }
    return url;
  }

  /* ───────── Render guards to avoid SSR crash ───────── */
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

      {/* MISSIONS + MAP/DEVICES */}
      {tab==='missions' && (
        <MissionsAndMap
          suite={suite} setSuite={setSuite}
          config={config} setConfig={setConfig}
          showRings={showRings} setShowRings={setShowRings}
          devSearchQ={devSearchQ} setDevSearchQ={setDevSearchQ}
          devSearching={devSearching}
          devResults={devResults}
          devSearch={devSearch}
          useMyLocation={useMyLocation}
          placingDev={placingDev} setPlacingDev={setPlacingDev}
          devDraft={devDraft} setDevDraft={setDevDraft}
          devices={devices} setDevices={setDevices}
          selectedDevIdx={selectedDevIdx} setSelectedDevIdx={setSelectedDevIdx}
          saveDraftDevice={saveDraftDevice}
          deleteSelectedDevice={deleteSelectedDevice}
          duplicateSelectedDevice={duplicateSelectedDevice}
          moveSelectedDevice={moveSelectedDevice}
          setSelectedDeviceRadius={setSelectedDeviceRadius}
          applySearchResult={applySearchResult}
          startNew={startNew}
          saveToList={saveToList}
          cancelEdit={cancelEdit}
          editing={editing} setEditing={setEditing}
          selected={selected} setSelected={setSelected}
          dirty={dirty} setDirty={setDirty}
          removeMission={removeMission}
          moveMission={moveMission}
          duplicateMission={duplicateMission}
        />
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

      {/* TEXT */}
      {tab==='text' && <TextTab suite={suite} config={config} setConfig={setConfig} setStatus={setStatus}/>}

      {/* DEVICES tab (simple list) */}
      {tab==='devices' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <h3 style={{ marginTop:0 }}>Devices</h3>
            {(devices||[]).length===0 && <div style={{ color:'#9fb0bf' }}>No devices yet. Use the Missions tab manager.</div>}
            <ul style={{ paddingLeft:18 }}>
              {(devices||[]).map((x,i)=>(
                <li key={x.id||i} style={{ marginBottom:8 }}>
                  <code>D{i+1}</code> — {x.title||'(untitled)'} • {x.type} • radius {x.pickupRadius}m • effect {x.effectSeconds}s
                  {typeof x.lat==='number' && typeof x.lng==='number' ? <> • lat {x.lat}, lng {x.lng}</> : ' • (not placed)'}
                  {x.iconKey?<> • icon <code>{x.iconKey}</code></>:null}
                </li>
              ))}
            </ul>
          </div>
        </main>
      )}

      {/* MAP (read-only) */}
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

      {/* MEDIA (uploads + icons + global pool) */}
      {tab==='media' && (
        <MediaTab
          config={config} setConfig={setConfig}
          uploadStatus={uploadStatus} setUploadStatus={setUploadStatus}
          uploadToRepo={uploadToRepo}
          uploadToPool={uploadToPool}
          pool={pool} setPool={setPool}
          poolOpen={poolOpen} setPoolOpen={setPoolOpen}
          addPoolRefToGame={addPoolRefToGame}
          removePoolRefFromGame={removePoolRefFromGame}
          deleteFromLibrary={deleteFromLibrary}
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

/* ───────────────────────── Sub-components ───────────────────────── */

function MissionsAndMap(props) {
  const {
    suite, setSuite, config, setConfig,
    showRings, setShowRings,
    devSearchQ, setDevSearchQ, devSearching, devResults, devSearch, useMyLocation, applySearchResult,
    placingDev, setPlacingDev, devDraft, setDevDraft,
    devices, setDevices, selectedDevIdx, setSelectedDevIdx,
    saveDraftDevice, deleteSelectedDevice, duplicateSelectedDevice, moveSelectedDevice, setSelectedDeviceRadius,
    startNew, saveToList, cancelEdit, editing, setEditing, selected, setSelected, dirty, setDirty,
    removeMission, moveMission, duplicateMission
  } = props;

  return (
    <main style={S.wrapGrid2}>
      {/* Left list */}
      <aside style={S.sidebarTall}>
        <div style={{ display:'flex', gap:8, marginBottom:8 }}>
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
          <button onClick={startNew} style={S.button}>+ New Mission</button>
        </div>
        <div>
          {(suite.missions||[]).map((m, idx)=>(
            <div key={m.id} data-m-title={(m.title||'')+' '+m.id+' '+m.type} style={S.missionItem}>
              <div style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', gap:8, alignItems:'center' }}>
                <button style={{ ...S.button, padding:'6px 10px' }} onClick={()=>removeMission(m.id)}>Delete</button>
                <div onClick={()=>{ setEditing(m); setSelected(m.id); setDirty(false); }} style={{ cursor:'pointer' }}>
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
                Click to place a device (when “Add Device” is active). If a device is selected, click moves it.
                If none selected, click moves the nearest pin (mission/device).
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
              <button style={S.button} onClick={()=>{ setPlacingDev(true); setSelectedDevIdx(null); }}>+ Add Device</button>
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

          {/* If placing, show a small draft panel */}
          {placingDev && (
            <div style={{ border:'1px solid #22303c', borderRadius:10, padding:10, marginBottom:8 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8 }}>
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
              } else {
                const list=[...(config?.devices||[])];
                const d=list[idx]; if (!d) return;
                d.lat=Number(lat.toFixed(6)); d.lng=Number(lng.toFixed(6));
                setDevices(list);
              }
            }}
          />
        </div>

        {/* Overlay mission editor (same as earlier) */}
        {editing && (
          <MissionEditor
            editing={editing} setEditing={setEditing}
            dirty={dirty} setDirty={setDirty}
            saveToList={saveToList}
            cancelEdit={cancelEdit}
            suite={suite}
            TYPE_FIELDS={TYPE_FIELDS}
            TYPE_LABELS={TYPE_LABELS}
            defaultContentForType={defaultContentForType}
            S={S}
          />
        )}
      </section>
    </main>
  );
}

function MissionEditor({ editing, setEditing, dirty, setDirty, saveToList, cancelEdit, suite, TYPE_FIELDS, TYPE_LABELS, defaultContentForType, S }) {
  return (
    <div style={S.overlay}>
      <div style={{ ...S.card, width:'min(820px, 92vw)', maxHeight:'80vh', overflowY:'auto' }}>
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

        <hr style={S.hr}/>

        {/* Multiple Choice editor */}
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

        <div style={{ display:'flex', gap:8, marginTop:12 }}>
          <button style={S.button} onClick={saveToList}>Save Mission</button>
          <button style={S.button} onClick={cancelEdit}>Close</button>
        </div>
        {dirty && <div style={{ marginTop:6, color:'#ffd166' }}>Unsaved changes…</div>}
      </div>
    </div>
  );
}

/* TEXT rules */
function TextTab({ suite, config, setConfig, setStatus }) {
  const [smsRule, setSmsRule] = useState({ missionId:'', phoneSlot:1, message:'', delaySec:30 });
  function addSmsRule() {
    if (!smsRule.missionId || !smsRule.message) return setStatus('❌ Pick mission and message');
    const maxPlayers = config?.forms?.players || 1;
    if (smsRule.phoneSlot < 1 || smsRule.phoneSlot > Math.max(1, maxPlayers)) return setStatus('❌ Phone slot out of range');
    const rules = [...(config?.textRules || []), { ...smsRule, delaySec: Number(smsRule.delaySec || 0) }];
    setConfig({ ...config, textRules: rules });
    setSmsRule({ missionId:'', phoneSlot:1, message:'', delaySec:30 });
    setStatus('✅ SMS rule added (remember Save All)');
  }
  function removeSmsRule(idx) {
    const rules = [...(config?.textRules || [])]; rules.splice(idx, 1);
    setConfig({ ...config, textRules: rules });
  }
  return (
    <main style={S.wrap}>
      <div style={S.card}>
        <h3 style={{ marginTop:0 }}>Text Message Rules</h3>
        <div style={{ display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))' }}>
          <Field label="Mission (geofence)">
            <select style={S.input} value={smsRule.missionId} onChange={(e)=>setSmsRule({ ...smsRule, missionId:e.target.value })}>
              <option value="">— choose —</option>
              {(suite.missions||[]).map(m=><option key={m.id} value={m.id}>{m.id} — {m.title}</option>)}
            </select>
          </Field>
          <Field label="Phone slot">
            <select style={S.input} value={smsRule.phoneSlot} onChange={(e)=>setSmsRule({ ...smsRule, phoneSlot:Number(e.target.value) })}>
              {[1,2,3,4].map(n=><option key={n} value={n}>{'Player '+n}</option>)}
            </select>
          </Field>
          <Field label="Delay (sec)">
            <input type="number" min={0} max={3600} style={S.input} value={smsRule.delaySec} onChange={(e)=>setSmsRule({ ...smsRule, delaySec:e.target.value })}/>
          </Field>
          <Field label="Message">
            <input style={S.input} value={smsRule.message} onChange={(e)=>setSmsRule({ ...smsRule, message:e.target.value })}/>
          </Field>
        </div>
        <div style={{ marginTop:12 }}><button style={S.button} onClick={addSmsRule}>+ Add Rule</button></div>
        <hr style={S.hr}/>
        <ul style={{ paddingLeft:18 }}>
          {(config.textRules||[]).map((r,i)=>(
            <li key={i} style={{ marginBottom:8 }}>
              <code>{r.missionId}</code> → Player {r.phoneSlot} • delay {r.delaySec}s • “{r.message}”
              <button style={{ ...S.button, marginLeft:8, padding:'6px 10px' }} onClick={()=>removeSmsRule(i)}>Remove</button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

/* MEDIA tab with DnD + file chooser + Icons editors + GLOBAL MEDIA POOL */
function MediaTab({
  config, setConfig,
  uploadStatus, setUploadStatus,
  uploadToRepo, uploadToPool,
  pool, setPool,
  poolOpen, setPoolOpen,
  addPoolRefToGame, removePoolRefFromGame, deleteFromLibrary,
}) {
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
    for (const f of files) { await uploadToPool(f); }
  }

  function FileChooser({ label='Upload to Pool', folder='mediapool' }) {
    return (
      <label style={{ ...S.button, textAlign:'center' }}>
        {label}
        <input type="file" multiple style={{ display:'none' }}
          onChange={async (e)=>{
            const files = Array.from(e.target.files || []);
            for (const f of files) await uploadToPool(f);
            e.target.value = '';
          }}/>
      </label>
    );
  }

  const inGame = new Set((config.media?.pool || []).map(x=>x.url));

  return (
    <main style={S.wrap}>
      <div style={S.card}
           onDragEnter={(e)=>{ e.preventDefault(); e.stopPropagation(); setHover(true); }}
           onDragOver={(e)=>{ e.preventDefault(); e.stopPropagation(); }}
           onDragLeave={(e)=>{ e.preventDefault(); e.stopPropagation(); setHover(false); }}
           onDrop={handleDrop}>
        <h3 style={{ marginTop:0 }}>Media</h3>

        {/* Pool link + upload */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <button style={S.button} onClick={()=>setPoolOpen(true)}>📚 Media Pool</button>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <FileChooser />
            <span style={{ color:'#9fb0bf' }}>{uploadStatus}</span>
          </div>
        </div>

        <div style={{ border:'2px dashed #2a323b', borderRadius:12, padding:16, background:hover?'#0e1116':'transparent', marginBottom:12, color:'#9fb0bf' }}>
          Drag & drop images here to add them to the global Media Pool (stored under <code>public/media/mediapool/</code>).
        </div>

        {/* Simple icons editors below */}
        <IconsEditor config={config} setConfig={setConfig} label="Mission Icons" kind="missions" uploadToRepo={uploadToRepo}/>
        <IconsEditor config={config} setConfig={setConfig} label="Device Icons"  kind="devices"  uploadToRepo={uploadToRepo}/>
        <IconsEditor config={config} setConfig={setConfig} label="Reward Icons"  kind="rewards"  uploadToRepo={uploadToRepo}/>

        {/* Pool Modal */}
        {poolOpen && (
          <div style={modalStyles.backdrop} onClick={()=>setPoolOpen(false)}>
            <div style={modalStyles.sheet} onClick={(e)=>e.stopPropagation()}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <h3 style={{ margin:0 }}>Global Media Pool</h3>
                <button style={S.button} onClick={()=>setPoolOpen(false)}>Close</button>
              </div>
              {pool.length===0 ? (
                <div style={{ color:'#9fb0bf' }}>No images yet. Drag files into the Media panel or use “Upload to Pool”.</div>
              ) : (
                <div style={modalStyles.grid}>
                  {pool.map((it, i)=>(
                    <div key={i} style={modalStyles.tile}>
                      <div style={modalStyles.thumbWrap}>
                        <img src={toDirectMediaURL(it.thumb || it.url)} alt={it.name} style={modalStyles.thumbImg}/>
                      </div>
                      <div style={modalStyles.name}>{it.name || it.url.split('/').pop()}</div>
                      <div style={modalStyles.actions}>
                        {!inGame.has(it.url) ? (
                          <button style={S.button} onClick={()=>addPoolRefToGame(it)}>Add to Game</button>
                        ) : (
                          <button style={S.button} onClick={()=>removePoolRefFromGame(it)}>Remove from Game</button>
                        )}
                        <a href={it.url} target="_blank" rel="noreferrer"><button style={S.button}>Open</button></a>
                        <button style={{ ...S.button, background:'#3b0f12', borderColor:'#57151a' }} onClick={()=>deleteFromLibrary(it)}>Delete from Library</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

const modalStyles = {
  backdrop: { position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'grid', placeItems:'center', zIndex:3000, padding:16 },
  sheet:    { width:'min(1100px, 95vw)', maxHeight:'85vh', overflow:'auto', background:'#12181d', border:'1px solid #1f262d', borderRadius:12, padding:12 },
  grid:     { display:'grid', gap:12, gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))' },
  tile:     { border:'1px solid #1f262d', borderRadius:10, padding:10, background:'#0f1418' },
  thumbWrap:{ width:'100%', aspectRatio:'4/3', background:'#0b0c10', border:'1px solid #1f262d', borderRadius:8, overflow:'hidden', marginBottom:6 },
  thumbImg: { width:'100%', height:'100%', objectFit:'cover' },
  name:     { fontSize:13, color:'#e9eef2', marginBottom:8, wordBreak:'break-word' },
  actions:  { display:'flex', gap:6, flexWrap:'wrap' },
};

/* Icons editor */
function IconsEditor({ config, setConfig, label, kind, uploadToRepo }) {
  const list = config.icons?.[kind] || [];
  const setList = (next) => setConfig({ ...config, icons:{ ...(config.icons||{}), [kind]: next } });

  return (
    <div style={{ marginTop:16 }}>
      <h4 style={{ marginTop:0 }}>{label}</h4>
      <div style={{ display:'grid', gridTemplateColumns:'160px 1fr 1fr 140px', gap:8, alignItems:'center', fontSize:13, color:'#9fb0bf', marginBottom:6 }}>
        <div>Icon</div><div>Name</div><div>Key</div><div>Actions</div>
      </div>
      {list.map((row, idx)=>(
        <div key={row.key||idx} style={{ display:'grid', gridTemplateColumns:'160px 1fr 1fr 140px', gap:8, alignItems:'center', marginBottom:8 }}>
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8 }}>
              <input style={S.input} value={row.url||''} onChange={(e)=>{ const n=[...list]; n[idx]={ ...(n[idx]||{}), url:e.target.value }; setList(n); }} placeholder="Image URL"/>
              <label style={{ ...S.button, textAlign:'center' }}>
                Choose File
                <input type="file" style={{ display:'none' }}
                  onChange={async (e)=>{ const f=e.target.files?.[0]; if (!f) return; const url=await uploadToRepo(f,'icons'); if (url) { const n=[...list]; n[idx]={ ...(n[idx]||{}), url }; setList(n); } }}/>
              </label>
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

/* Rewards tab */
function RewardsTab({ config, setConfig }) {
  const list = Array.isArray(config.media?.rewards) ? config.media.rewards : DEFAULT_REWARDS;
  const setList = (next) => setConfig({ ...config, media:{ ...(config.media||{}), rewards: next } });
  return (
    <main style={S.wrap}>
      <div style={S.card}>
        <h3 style={{ marginTop:0 }}>Rewards</h3>
        <div style={{ display:'grid', gridTemplateColumns:'160px 1fr 1fr 140px', gap:8, alignItems:'center', fontSize:13, color:'#9fb0bf', marginBottom:6 }}>
          <div>Thumbnail</div><div>Name</div><div>Special ability</div><div>Actions</div>
        </div>
        {list.map((row, idx)=>(
          <div key={row.key||idx} style={{ display:'grid', gridTemplateColumns:'160px 1fr 1fr 140px', gap:8, alignItems:'center', marginBottom:8 }}>
            <div>
              <input style={S.input} value={row.thumbUrl||''} onChange={(e)=>{ const n=[...list]; n[idx]={ ...(n[idx]||{}), thumbUrl:e.target.value }; setList(n); }} placeholder="Thumbnail URL"/>
              {row.thumbUrl && <img alt="thumb" src={toDirectMediaURL(row.thumbUrl)} style={{ marginTop:6, width:'100%', maxHeight:80, objectFit:'contain', border:'1px solid #2a323b', borderRadius:8 }}/>}
            </div>
            <input style={S.input} value={row.name||''} onChange={(e)=>{ const n=[...list]; n[idx]={ ...(n[idx]||{}), name:e.target.value }; setList(n); }}/>
            <input style={S.input} value={row.ability||''} onChange={(e)=>{ const n=[...list]; n[idx]={ ...(n[idx]||{}), ability:e.target.value }; setList(n); }}/>
            <div style={{ display:'flex', gap:6 }}>
              <button style={S.button} onClick={()=>{ const n=[...list]; n.splice(idx,1); setList(n); }}>Delete</button>
              <button style={S.button} onClick={()=>{ const n=[...list]; const copy={ ...(n[idx]||{}), key:(row.key||`rw${idx}`)+'-copy' }; n.splice(idx+1,0,copy); setList(n); }}>Duplicate</button>
            </div>
          </div>
        ))}
        <button style={S.button} onClick={()=>{ setList([...(list||[]), { key:`rw${list.length+1}`, name:'', ability:'', thumbUrl:'' }]); }}>+ Add Reward</button>
      </div>
    </main>
  );
}

/* Common small components */
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

/* MapOverview — missions+devices; place draft, move selected, move nearest */
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

  function iconUrl(kind,key){
    if(!key)return''; const list=icons?.[kind]||[]; const it=list.find(x=>x.key===key); return it?toDirectMediaURL(it.url||''):'';
  }
  function numberedIcon(number, imgUrl, color='#60a5fa', highlight=false){
    const img = imgUrl
      ? `<img src="${imgUrl}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;border:2px solid ${highlight?'#22c55e':'white'};box-shadow:0 0 0 2px #1f2937"/>`
      : `<div style="width:20px;height:20px;border-radius:50%;background:${color};border:2px solid ${highlight?'#22c55e':'white'};box-shadow:0 0 0 2px #1f2937"></div>`;
    return window.L.divIcon({ className:'num-pin', html:`<div style="position:relative;display:grid;place-items:center">${img}<div style="position:absolute;bottom:-12px;left:50%;transform:translateX(-50%);font-weight:700;font-size:12px;color:#fff;text-shadow:0 1px 2px #000">${number}</div></div>`, iconSize:[24,28], iconAnchor:[12,12] });
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

    // CLICK: place draft / move selected / move nearest
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
