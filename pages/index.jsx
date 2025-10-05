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
};
const TYPE_OPTIONS = [
  { value:'multiple_choice', label:'Multiple Choice' },
  { value:'short_answer',    label:'Question (Short Answer)' },
  { value:'statement',       label:'Statement' },
  { value:'video',           label:'Video' },
  { value:'geofence_image',  label:'Geo Fence Image' },
  { value:'geofence_video',  label:'Geo Fence Video' },
  { value:'ar_image',        label:'AR Image' },
  { value:'ar_video',        label:'AR Video' },
];
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

  const [suite, setSuite] = useState(null);   // missions + version
  const [config, setConfig] = useState(null); // devices + media + icons + appearance
  const [status, setStatus] = useState('');

  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [dirty, setDirty] = useState(false);

  // inline “Add Device” on the same map
  const [placingDev, setPlacingDev] = useState(false);
  const [devDraft, setDevDraft] = useState({ title:'', type:'smoke', iconKey:'', pickupRadius:100, effectSeconds:120, lat:null, lng:null });

  const [uploadStatus, setUploadStatus] = useState('');

  const gameBase =
    ((typeof window !== 'undefined'
      ? (window.__GAME_ORIGIN__ || process.env.NEXT_PUBLIC_GAME_ORIGIN)
      : process.env.NEXT_PUBLIC_GAME_ORIGIN) || (config?.gameOrigin) || '');

  const getDevices = () => (config?.devices?.length ? config.devices : (config?.powerups || []));
  const setDevices = (list) => setConfig({ ...config, devices: list, powerups: list });

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/games', { credentials:'include' });
        const j = await r.json();
        if (j.ok) setGames(j.games || []);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setStatus('Loading…');
        const missionUrls = activeSlug ? [`/games/${encodeURIComponent(activeSlug)}/missions.json`, `/missions.json`] : [`/missions.json`];
        const configUrl   = activeSlug ? `/api/config?slug=${encodeURIComponent(activeSlug)}` : `/api/config`;

        const m  = await fetchFirstJson(missionUrls, { version:'0.0.0', missions:[] });
        const c0 = await fetchJsonSafe(configUrl, defaultConfig());

        const normalized = {
          ...m,
          missions: (m.missions || []).map(x => ({
            ...x,
            appearanceOverrideEnabled: !!x.appearanceOverrideEnabled,
            appearance: { ...defaultAppearance(), ...(x.appearance || {}) },
          })),
        };

        const dc = defaultConfig();
        const merged = {
          ...dc,
          ...c0,
          timer: { ...dc.timer, ...(c0.timer||{}) },
          devices: (c0.devices && Array.isArray(c0.devices)) ? c0.devices
                   : (c0.powerups && Array.isArray(c0.powerups)) ? c0.powerups : [],
          media: { ...(c0.media || {}) },
          icons: { ...(c0.icons || {}), ...DEFAULT_ICONS },
          appearance: { ...dc.appearance, ...(c0.appearance || {}) },
        };

        setSuite(normalized);
        setConfig(merged);
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
      game: { title:'Untitled Game', type:'Mystery' },
      forms: { players:1 },
      timer: { durationMinutes:0, alertMinutes:10 },
      textRules: [],
      devices: [],
      powerups: [],
      media: {},
      icons: DEFAULT_ICONS,
      appearance: defaultAppearance(),
    };
  }
  function defaultContentForType(t) {
    const baseGeo = { geofenceEnabled:false, lat:'', lng:'', radiusMeters:25, cooldownSeconds:30 };
    switch (t) {
      case 'multiple_choice': return { question:'', choices:[], correctIndex:undefined, mediaUrl:'', ...baseGeo };
      case 'short_answer':    return { question:'', answer:'', acceptable:'', mediaUrl:'', ...baseGeo };
      case 'statement':       return { text:'', mediaUrl:'', ...baseGeo };
      case 'video':           return { videoUrl:'', overlayText:'', ...baseGeo };
      case 'geofence_image':  return { lat:'', lng:'', radiusMeters:25, cooldownSeconds:30, imageUrl:'', overlayText:'' };
      case 'geofence_video':  return { lat:'', lng:'', radiusMeters:25, cooldownSeconds:30, videoUrl:'', overlayText:'' };
      case 'ar_image':        return { markerUrl:'', assetUrl:'', overlayText:'', ...baseGeo };
      case 'ar_video':        return { markerUrl:'', assetUrl:'', overlayText:'', ...baseGeo };
      default:                return { ...baseGeo };
    }
  }

  async function saveAll() {
    if (!suite || !config) return;
    setStatus('Saving…');
    const qs = activeSlug ? `?slug=${encodeURIComponent(activeSlug)}` : '';
    const [a,b] = await Promise.all([
      fetch('/api/save' + qs,        { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ missions: suite }) }),
      fetch('/api/save-config' + qs, { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ config }) }),
    ]);
    const ok = a.ok && b.ok;
    if (!ok) setStatus('❌ Save failed:\n' + (await a.text()) + '\n' + (await b.text()));
    else     setStatus('✅ Saved (files committed)');
  }
  async function handlePublish() {
    try {
      setStatus('Publishing…');
      const res  = await fetch(`/api/game/${activeSlug || ''}?channel=published`, {
        method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ action:'publish' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Publish failed');
      setStatus(`✅ Published v${data?.version || ''}`);
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
      if (f.type==='number') continue;
      const v = editing.content?.[f.key];
      if (f.key!=='mediaUrl' && (v===undefined || v===null || v==='')) return setStatus('❌ Missing: ' + f.label);
    }
    const missions = [...(suite.missions||[])];
    const i = missions.findIndex(m=>m.id===editing.id);
    const toSave = { ...editing };
    if (!toSave.appearanceOverrideEnabled) delete toSave.appearance;
    if (i>=0) missions[i]=toSave; else missions.push(toSave);
    setSuite({ ...suite, missions, version:bumpVersion(suite.version||'0.0.0') });
    setSelected(editing.id); setEditing(null); setDirty(false);
    setStatus('✅ List updated (remember Save All)');
  }
  function removeMission(id) {
    if (!suite) return;
    setSuite({ ...suite, missions:(suite.missions||[]).filter(m=>m.id!==id) });
    if (selected===id) { setSelected(null); setEditing(null); }
  }
  function moveMission(idx, dir) {
    if (!suite) return;
    const list=[...(suite.missions||[])];
    const j=idx+dir; if (j<0||j>=list.length) return;
    const [row]=list.splice(idx,1); list.splice(j,0,row);
    setSuite({ ...suite, missions:list });
  }
  function duplicateMission(idx) {
    const list=[...(suite.missions||[])];
    const src=list[idx]; if (!src) return;
    const cp=JSON.parse(JSON.stringify(src)); cp.id=suggestId(); cp.title=(src.title||'Copy')+' (copy)';
    list.splice(idx+1,0,cp);
    setSuite({ ...suite, missions:list });
    setStatus('✅ Duplicated (remember Save All)');
  }

  /* Devices */
  function beginPlaceDevice() {
    setPlacingDev(true);
    setDevDraft({ title:'', type:'smoke', iconKey:'', pickupRadius:100, effectSeconds:120, lat:null, lng:null });
  }
  function confirmPlaceDevice() {
    const d=devDraft;
    if (d.lat==null || d.lng==null) { setStatus('❌ Click on the map to place the device'); return; }
    const list=getDevices();
    const item={
      id:'d'+String(list.length+1).padStart(2,'0'),
      title: d.title || (d.type.charAt(0).toUpperCase()+d.type.slice(1)),
      type: d.type, iconKey: d.iconKey || '',
      pickupRadius: clamp(Number(d.pickupRadius||0),1,2000),
      effectSeconds: clamp(Number(d.effectSeconds||0),5,3600),
      lat: Number(d.lat.toFixed(6)), lng: Number(d.lng.toFixed(6))
    };
    setDevices([...(list||[]), item]);
    setPlacingDev(false);
    setStatus('✅ Device added (remember Save All)');
  }
  function cancelPlaceDevice(){ setPlacingDev(false); }

  function onAltMoveNearest(kind, index, lat, lng) {
    // now used for single-click nearest move
    if (kind==='mission') {
      const list=[...(suite?.missions||[])];
      const m=list[index]; if (!m) return;
      const c={ ...(m.content||{}) };
      c.lat=Number(lat.toFixed(6)); c.lng=Number(lng.toFixed(6)); c.geofenceEnabled=true;
      c.radiusMeters=Number(c.radiusMeters||25);
      list[index]={ ...m, content:c };
      setSuite({ ...suite, missions:list });
      setStatus(`Moved mission #${index+1}`);
    } else {
      const list=[...getDevices()];
      const d=list[index]; if (!d) return;
      d.lat=Number(lat.toFixed(6)); d.lng=Number(lng.toFixed(6));
      setDevices(list);
      setStatus(`Moved device D${index+1}`);
    }
  }

  /* Upload helper (MEDIA) */
  async function uploadToRepo(file, subfolder='uploads') {
    const array = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(array)));
    const path = `public/media/${subfolder}/${Date.now()}-${file.name}`;
    setUploadStatus('Uploading…');
    const res = await fetch('/api/upload', {
      method:'POST', headers:{ 'Content-Type':'application/json' }, credentials:'include',
      body: JSON.stringify({ path, contentBase64: base64, message:`upload ${file.name}` }),
    });
    const j = await res.json();
    setUploadStatus(res.ok ? `✅ Uploaded` : `❌ ${j?.error || 'upload failed'}`);
    if (res.ok) return `/${path.replace(/^public\//,'')}`;
    return '';
  }

  /* UI */
  const devices = getDevices();

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
            <button onClick={beginPlaceDevice} style={S.button}>+ Add Device</button>
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

      {/* MISSIONS: left list / right map; editor overlays map */}
      {tab==='missions' && (
        <main style={S.wrapGrid2}>
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
                      <div style={{ color:'#9fb0bf', fontSize:12 }}>{m.type} — id: {m.id}</div>
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

          <section style={{ position:'relative' }}>
            <div style={S.card}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', gap:12, marginBottom:8 }}>
                <div>
                  <h3 style={{ margin:0 }}>Overview Map</h3>
                  <div style={{ color:'#9fb0bf', fontSize:12 }}>
                    Click to place devices (when “Add Device” is active). Click to move the nearest pin otherwise.
                    Pins are numbered to match the list.
                  </div>
                </div>
                <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <input type="checkbox" checked={showRings} onChange={(e)=>setShowRings(e.target.checked)}/> Show radius rings (admin only)
                </label>
              </div>

              {/* Inline device placement panel */}
              {placingDev && (
                <div style={{ border:'1px solid #22303c', borderRadius:10, padding:12, marginBottom:10 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12 }}>
                    <Field label="Title"><input style={S.input} value={devDraft.title} onChange={(e)=>setDevDraft({ ...devDraft, title:e.target.value })}/></Field>
                    <Field label="Type">
                      <select style={S.input} value={devDraft.type} onChange={(e)=>setDevDraft({ ...devDraft, type:e.target.value })}>
                        {DEVICE_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Icon">
                      <select style={S.input} value={devDraft.iconKey} onChange={(e)=>setDevDraft({ ...devDraft, iconKey:e.target.value })}>
                        <option value="">(default)</option>
                        {(config.icons?.devices||[]).map(it=><option key={it.key} value={it.key}>{it.name||it.key}</option>)}
                      </select>
                    </Field>
                    <Field label="Pickup radius (m)">
                      <input type="number" min={1} max={2000} style={S.input} value={devDraft.pickupRadius}
                        onChange={(e)=>setDevDraft({ ...devDraft, pickupRadius:clamp(Number(e.target.value||0),1,2000) })}/>
                    </Field>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                    <Field label="Effect duration (sec)">
                      <input type="number" min={5} max={3600} style={S.input} value={devDraft.effectSeconds}
                        onChange={(e)=>setDevDraft({ ...devDraft, effectSeconds:clamp(Number(e.target.value||0),5,3600) })}/>
                    </Field>
                    <div style={{ display:'flex', alignItems:'flex-end', gap:8, justifyContent:'flex-end' }}>
                      <button style={S.button} onClick={()=>setPlacingDev(false)}>Cancel</button>
                      <button style={S.button} onClick={confirmPlaceDevice}>Save Device</button>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, marginTop:8, alignItems:'center' }}>
                    <input type="range" min={5} max={2000} step={5} value={devDraft.pickupRadius}
                      onChange={(e)=>setDevDraft({ ...devDraft, pickupRadius:Number(e.target.value) })}/>
                    <code style={{ color:'#9fb0bf' }}>{devDraft.pickupRadius} m</code>
                  </div>
                  <div style={{ color:'#9fb0bf', fontSize:12, marginTop:6 }}>
                    {devDraft.lat==null ? 'Click the map to place the device.' : `lat ${Number(devDraft.lat).toFixed(6)}, lng ${Number(devDraft.lng).toFixed(6)}`}
                  </div>
                </div>
              )}

              <MapOverview
                missions={(suite?.missions)||[]}
                devices={devices}
                icons={config.icons || DEFAULT_ICONS}
                showRings={showRings}
                interactive={placingDev}
                draftDevice={placingDev ? { lat:devDraft.lat, lng:devDraft.lng, radius:devDraft.pickupRadius } : null}
                onDraftChange={(lat,lng)=>setDevDraft({ ...devDraft, lat, lng })}
                onAltMoveNearest={(kind, idx, lat, lng)=>onAltMoveNearest(kind, idx, lat, lng)}
              />
            </div>

            {/* Overlay mission editor */}
            {editing && (
              <div style={S.overlay}>
                <div style={{ ...S.card, width:'min(780px, 92vw)', maxHeight:'80vh', overflowY:'auto' }}>
                  <h3 style={{ marginTop:0 }}>Edit Mission</h3>
                  <Field label="ID"><input style={S.input} value={editing.id} onChange={(e)=>{ setEditing({ ...editing, id:e.target.value }); setDirty(true); }}/></Field>
                  <Field label="Title"><input style={S.input} value={editing.title} onChange={(e)=>{ setEditing({ ...editing, title:e.target.value }); setDirty(true); }}/></Field>
                  <Field label="Type">
                    <select style={S.input} value={editing.type}
                      onChange={(e)=>{ const t=e.target.value; setEditing({ ...editing, type:t, content:defaultContentForType(t) }); setDirty(true); }}>
                      {TYPE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
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
                  {(editing.type==='multiple_choice'||editing.type==='short_answer'||editing.type==='statement'||editing.type==='video') && (
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
                            onChange={(e)=>{ setEditing({ ...editing, content:{ ...editing.content, [f.key]:e.target.value } }); setDirty(true); }}/>
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
                            setEditing({ ...editing, content:{ ...editing.content, [f.key]:e.target.value } }); setDirty(true);
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

      {/* DEVICES tab */}
      {tab==='devices' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <h3 style={{ marginTop:0 }}>Devices</h3>
            {(devices||[]).length===0 && <div style={{ color:'#9fb0bf' }}>No devices yet. Use “+ Add Device” on the Missions tab.</div>}
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

      {/* MAP large */}
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

      {/* MEDIA (uploads + icons) */}
      {tab==='media' && (
        <MediaTab config={config} setConfig={setConfig} uploadStatus={uploadStatus} setUploadStatus={setUploadStatus} uploadToRepo={uploadToRepo}/>
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

/* ───────────────────────── Sub-tabs & Components ───────────────────────── */

function TextTab({ suite, config, setConfig, setStatus }) {
  const [smsRule, setSmsRule] = useState({ missionId:'', phoneSlot:1, message:'', delaySec:30 });
  function addSmsRule() {
    if (!smsRule.missionId || !smsRule.message) return setStatus('❌ Pick mission and message');
    const maxPlayers = config?.forms?.players || 1;
    if (smsRule.phoneSlot < 1 || smsRule.phoneSlot > Math.max(1,maxPlayers)) return setStatus('❌ Phone slot out of range');
    const rules = [...(config?.textRules||[]), { ...smsRule, delaySec: Number(smsRule.delaySec||0) }];
    setConfig({ ...config, textRules: rules });
    setSmsRule({ missionId:'', phoneSlot:1, message:'', delaySec:30 });
    setStatus('✅ SMS rule added (remember Save All)');
  }
  function removeSmsRule(idx) {
    const rules=[...(config?.textRules||[])]; rules.splice(idx,1);
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

function MediaTab({ config, setConfig, uploadStatus, setUploadStatus, uploadToRepo }) {
  const [hover, setHover] = useState(false);

  return (
    <main style={S.wrap}>
      <div style={S.card}
           onDragOver={(e)=>{ e.preventDefault(); e.stopPropagation(); setHover(true); }}
           onDragLeave={(e)=>{ setHover(false); }}
           onDrop={async (e)=>{ e.preventDefault(); e.stopPropagation(); setHover(false);
              const files=[...e.dataTransfer.files]; for (const f of files) await uploadToRepo(f,'uploads'); }}>
        <h3 style={{ marginTop:0 }}>Media</h3>
        <div style={{
          border:'2px dashed #2a323b', borderRadius:12, padding:12, background:hover?'#0e1116':'transparent',
          marginBottom:12, color:'#9fb0bf'
        }}>
          Drag & drop files here or use “Choose File” buttons. Files are committed to <code>public/media/…</code>.
          <div style={{ float:'right' }}>{uploadStatus}</div>
        </div>

        <IconsEditor config={config} setConfig={setConfig} label="Mission Icons" kind="missions" uploadToRepo={uploadToRepo}/>
        <IconsEditor config={config} setConfig={setConfig} label="Device Icons"  kind="devices"  uploadToRepo={uploadToRepo}/>
        <IconsEditor config={config} setConfig={setConfig} label="Reward Icons"  kind="rewards"  uploadToRepo={uploadToRepo}/>
      </div>
    </main>
  );
}

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

/* ───────────────────────── Styles ───────────────────────── */
const S = {
  body: { background:'#0b0c10', color:'#e9eef2', minHeight:'100vh', fontFamily:'system-ui, Arial, sans-serif' },
  header: { padding:16, background:'#11161a', borderBottom:'1px solid #1d2329' },
  wrap: { maxWidth:1200, margin:'0 auto', padding:16 },
  wrapGrid2: { display:'grid', gridTemplateColumns:'360px 1fr', gap:16, alignItems:'start', maxWidth:1400, margin:'0 auto', padding:16 },
  sidebarTall: { background:'#12181d', border:'1px solid #1f262d', borderRadius:14, padding:12, position:'sticky', top:12, height:'calc(100vh - 120px)', overflow:'auto' },
  card: { background:'#12181d', border:'1px solid #1f262d', borderRadius:14, padding:16 },
  missionItem: { borderBottom:'1px solid #1f262d', padding:'10px 4px' },
  input: { width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid #2a323b', background:'#0b0c10', color:'#e9eef2' },
  button:{ padding:'10px 14px', borderRadius:10, border:'1px solid #2a323b', background:'#1a2027', color:'#e9eef2', cursor:'pointer' },
  tab: { padding:'8px 12px', borderRadius:10, border:'1px solid #2a323b', background:'#0f1418', color:'#e9eef2', cursor:'pointer' },
  tabActive: { background:'#1a2027' },
  search:{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid #2a323b', background:'#0b0c10', color:'#e9eef2', marginBottom:10 },
  hr:{ border:'1px solid #1f262d', borderBottom:'none' },
  overlay:{ position:'fixed', inset:0, display:'grid', placeItems:'center', background:'rgba(0,0,0,0.55)', zIndex:2000, padding:16 },
};

/* ───────────────────────── MapOverview ───────────────────────── */
function MapOverview({
  missions = [],
  devices = [],
  icons = DEFAULT_ICONS,
  showRings = true,
  interactive = false,           // Add Device mode
  draftDevice = null,            // {lat,lng,radius}
  onDraftChange = null,          // (lat,lng)
  onAltMoveNearest = null,       // (kind, idx, lat, lng) — now used for single-click move
}) {
  const divRef = React.useRef(null);
  const [leafletReady, setLeafletReady] = React.useState(!!(typeof window !== 'undefined' && window.L));

  function getMissionPos(m){ const c=m?.content||{}; const lat=Number(c.lat), lng=Number(c.lng);
    if(!isFinite(lat)||!isFinite(lng))return null; if(!(c.geofenceEnabled||Number(c.radiusMeters)>0))return null; return [lat,lng]; }
  function getDevicePos(d){ const lat=Number(d?.lat),lng=Number(d?.lng); if(!isFinite(lat)||!isFinite(lng))return null; return [lat,lng]; }
  function toDirect(u){ return toDirectMediaURL(u); }
  function findIconUrl(kind,key){ if(!key)return''; const list=icons?.[kind]||[]; const it=list.find(x=>x.key===key); return it?toDirect(it.url||''):''; }
  function makeNumberedIcon(number, imgUrl, color='#60a5fa'){
    const img = imgUrl
      ? `<img src="${imgUrl}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;border:2px solid white;box-shadow:0 0 0 2px #1f2937"/>`
      : `<div style="width:20px;height:20px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 0 2px #1f2937"></div>`;
    return window.L.divIcon({ className:'num-pin', html:`<div style="position:relative;display:grid;place-items:center">${img}<div style="position:absolute;bottom:-12px;left:50%;transform:translateX(-50%);font-weight:700;font-size:12px;color:#fff;text-shadow:0 1px 2px #000">${number}</div></div>`, iconSize:[24,28], iconAnchor:[12,12] });
  }

  React.useEffect(()=>{
    if(typeof window==='undefined')return;
    if(window.L){ setLeafletReady(true); return; }
    const link=document.createElement('link'); link.rel='stylesheet'; link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link);
    const s=document.createElement('script'); s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.async=true; s.onload=()=>setLeafletReady(true); document.body.appendChild(s);
  },[]);

  React.useEffect(()=>{
    if(!leafletReady||!divRef.current||typeof window==='undefined')return;
    const L=window.L; if(!L)return;

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
      const url=findIconUrl('missions', m.iconKey);
      L.marker(pos,{icon:makeNumberedIcon(idx+1, url, '#60a5fa')}).addTo(layer);
      const rad=Number(m.content?.radiusMeters||0);
      if(showRings && rad>0) L.circle(pos,{ radius:rad, color:'#60a5fa', fillOpacity:0.08 }).addTo(layer);
      bounds.extend(pos);
    });

    (devices||[]).forEach((d,idx)=>{
      const pos=getDevicePos(d); if(!pos) return;
      const url=findIconUrl('devices', d.iconKey);
      L.marker(pos,{icon:makeNumberedIcon(`D${idx+1}`, url, '#f59e0b')}).addTo(layer);
      const rad=Number(d.pickupRadius||0);
      if(showRings && rad>0) L.circle(pos,{ radius:rad, color:'#f59e0b', fillOpacity:0.08 }).addTo(layer);
      bounds.extend(pos);
    });

    if(draftDevice && typeof draftDevice.lat==='number' && typeof draftDevice.lng==='number'){
      const pos=[draftDevice.lat, draftDevice.lng];
      const mk=L.marker(pos,{ icon:makeNumberedIcon('D+','', '#34d399'), draggable:true }).addTo(layer);
      if(showRings && Number(draftDevice.radius)>0){
        const c=L.circle(pos,{ radius:Number(draftDevice.radius), color:'#34d399', fillOpacity:0.08 }).addTo(layer);
        mk.on('drag',()=>c.setLatLng(mk.getLatLng()));
      }
      mk.on('dragend',()=>{ const p=mk.getLatLng(); onDraftChange && onDraftChange(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))); });
      bounds.extend(pos);
    }

    // CLICK: if placing device → set draft; else move nearest mission/device
    if (map._clickHandler) map.off('click', map._clickHandler);
    map._clickHandler = (e) => {
      const lat = e.latlng.lat, lng = e.latlng.lng;
      if (interactive && onDraftChange) { onDraftChange(Number(lat.toFixed(6)), Number(lng.toFixed(6))); return; }

      if (!onAltMoveNearest) return;
      const candidates=[];
      (missions||[]).forEach((m,idx)=>{ const p=getMissionPos(m); if(p) candidates.push({ kind:'mission', idx, lat:p[0], lng:p[1] }); });
      (devices||[]).forEach((d,idx)=>{ const p=getDevicePos(d); if(p) candidates.push({ kind:'device', idx, lat:p[0], lng:p[1] }); });
      if(candidates.length===0) return;

      let best=null, bestDist=Infinity;
      candidates.forEach(c=>{ const d=map.distance([c.lat,c.lng], e.latlng); if(d<bestDist){bestDist=d; best=c;} });
      if(best) onAltMoveNearest(best.kind, best.idx, lat, lng);
    };
    map.on('click', map._clickHandler);

    if(bounds.isValid()) map.fitBounds(bounds.pad(0.2));
  },[leafletReady, missions, devices, icons, showRings, interactive, draftDevice, onDraftChange, onAltMoveNearest]);

  return (
    <div>
      {!leafletReady && <div style={{ color:'#9fb0bf', marginBottom:8 }}>Loading map…</div>}
      <div ref={divRef} style={{ height:560, borderRadius:12, border:'1px solid #22303c', background:'#0b1116' }}/>
    </div>
  );
}
