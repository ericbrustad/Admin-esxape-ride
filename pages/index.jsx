import React, { useEffect, useRef, useState } from 'react';
import TestLauncher from '../components/TestLauncher';

/* ============== Helpers ============== */
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

/* ============== Constants & defaults ============== */
const TYPE_FIELDS = {
  multiple_choice: [
    { key:'question', label:'Question', type:'text' },
    { key:'mediaUrl',  label:'Image or Video URL (optional)', type:'text' },
  ],
  short_answer: [
    { key:'question',  label:'Question', type:'text' },
    { key:'answer',    label:'Correct Answer', type:'text' },
    { key:'acceptable',label:'Also Accept (comma-separated)', type:'text' },
    { key:'mediaUrl',  label:'Image or Video URL (optional)', type:'text' },
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
  { v:'Georgia, serif',                   label:'Georgia' },
  { v:'Times New Roman, Times, serif',   label:'Times New Roman' },
  { v:'Arial, Helvetica, sans-serif',    label:'Arial' },
  { v:'Courier New, Courier, monospace', label:'Courier New' },
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
  { key:'gold-coin', name:'Gold Coin', ability:'Adds a coin to your wallet.', thumbUrl:'https://drive.google.com/uc?export=view&id=1TicLeS2LLwY8nVk-7Oc6ESxk_SyvxZGw' },
];

/* ============== Admin page ============== */
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

  const [suite, setSuite] = useState(null);
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState('');

  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [dirty, setDirty] = useState(false);

  const [placingDev, setPlacingDev] = useState(false);
  const [devDraft, setDevDraft]   = useState({ title:'', type:'smoke', iconKey:'', pickupRadius:100, effectSeconds:120, lat:null, lng:null });

  const [uploadStatus, setUploadStatus] = useState('');

  const gameBase =
    ((typeof window !== 'undefined'
      ? (window.__GAME_ORIGIN__ || process.env.NEXT_PUBLIC_GAME_ORIGIN)
      : process.env.NEXT_PUBLIC_GAME_ORIGIN) || (config?.gameOrigin) || '');

  const getDevices = () => (config?.devices?.length ? config.devices : (config?.powerups || []));
  const setDevices = (list) => setConfig({ ...config, devices:list, powerups:list });

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
          media:  { ...(c0.media || {}) },
          icons:  { ...(c0.icons || {}), ...DEFAULT_ICONS },
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
      default:                return { ...base };
    }
  }

  /* ---------- Save/Publish with Vercel deploy feedback (optional) ---------- */
  async function pollVercel(project='game') {
    try {
      const r = await fetch(`/api/vercel-status?project=${project}`, { credentials:'include' });
      const j = await r.json();
      if (!j.ok || j.disabled) return null;
      return j.state; // READY | BUILDING | QUEUED | ERROR | CANCELED
    } catch { return null; }
  }
  async function watchDeploy(project='game') {
    // Optional — only shows live text if Vercel envs exist; otherwise no-op.
    for (let i = 0; i < 40; i++) {
      const st = await pollVercel(project);
      if (!st) break;
      if (st === 'READY') { setStatus('✅ Deployed'); break; }
      if (st === 'ERROR' || st === 'CANCELED') { setStatus(`⚠ Build ${st.toLowerCase()}`); break; }
      setStatus(`Rebuilding ${project}… (${st.toLowerCase()})`);
      await new Promise(r=>setTimeout(r, 4000));
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
    if (!ok) {
      setStatus('❌ Save failed:\n' + (await a.text()) + '\n' + (await b.text()));
    } else {
      setStatus('✅ Saved. Rebuilding game…');
      watchDeploy('game'); // optional if you set VERCEL_TOKEN + PROJECT_ID
    }
  }
  async function handlePublish() {
    try {
      setStatus('Publishing…');
      const res  = await fetch(`/api/game/${activeSlug || ''}?channel=published`, {
        method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
        body: JSON.stringify({ action:'publish' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Publish failed');
      setStatus(`✅ Published v${data?.version || ''}. Rebuilding game…`);
      watchDeploy('game'); // optional
    } catch (e) {
      setStatus('❌ Publish failed: ' + (e?.message || e));
    }
  }

  /* ---------- Missions CRUD ---------- */
  function suggestId() { const base='m'; let i=1; const ids=new Set((suite?.missions||[]).map(m=>m.id)); while(ids.has(base+String(i).padStart(2,'0'))) i++; return base+String(i).padStart(2,'0'); }
  function startNew() {
    const draft = { id:suggestId(), title:'New Mission', type:'multiple_choice', iconKey:'', rewards:{ points:25 },
      content: defaultContentForType('multiple_choice'), appearanceOverrideEnabled:false, appearance: defaultAppearance() };
    setEditing(draft); setSelected(null); setDirty(true);
  }
  function editExisting(m) {
    const e={ ...JSON.parse(JSON.stringify(m)) };
    e.appearanceOverrideEnabled = !!e.appearanceOverrideEnabled;
    e.appearance = { ...defaultAppearance(), ...(e.appearance||{}) };
    setEditing(e); setSelected(m.id); setDirty(false);
  }
  function cancelEdit(){ setEditing(null); setSelected(null); setDirty(false); }
  function bumpVersion(v){ const p=String(v||'0.0.0').split('.').map(n=>parseInt(n||'0',10)); while(p.length<3)p.push(0); p[2]+=1; return p.join('.'); }
  function saveToList(){
    if(!editing||!suite) return;
    if(!editing.id||!editing.title||!editing.type) return setStatus('❌ Fill id, title, type');
    const fields=TYPE_FIELDS[editing.type]||[];
    for(const f of fields){ if(f.type==='number') continue; const v=editing.content?.[f.key];
      if(f.key!=='mediaUrl' && (v===undefined||v===null||v==='')) return setStatus('❌ Missing: '+f.label); }
    const list=[...(suite.missions||[])];
    const i=list.findIndex(m=>m.id===editing.id);
    const saveObj={ ...editing }; if(!saveObj.appearanceOverrideEnabled) delete saveObj.appearance;
    if(i>=0) list[i]=saveObj; else list.push(saveObj);
    setSuite({ ...suite, missions:list, version:bumpVersion(suite.version||'0.0.0') });
    setSelected(editing.id); setEditing(null); setDirty(false);
    setStatus('✅ List updated (remember Save All)');
  }
  function removeMission(id){
    if(!suite) return;
    setSuite({ ...suite, missions:(suite.missions||[]).filter(m=>m.id!==id) });
    if(selected===id){ setSelected(null); setEditing(null); }
  }
  function moveMission(idx, dir){
    if(!suite) return;
    const list=[...(suite.missions||[])]; const j=idx+dir; if(j<0||j>=list.length) return;
    const [row]=list.splice(idx,1); list.splice(j,0,row);
    setSuite({ ...suite, missions:list });
  }
  function duplicateMission(idx){
    const list=[...(suite.missions||[])]; const src=list[idx]; if(!src) return;
    const cp=JSON.parse(JSON.stringify(src)); cp.id=suggestId(); cp.title=(src.title||'Copy')+' (copy)';
    list.splice(idx+1,0,cp); setSuite({ ...suite, missions:list });
    setStatus('✅ Duplicated (remember Save All)');
  }

  /* ---------- Devices (add inline on map) ---------- */
  function beginPlaceDevice(){ setPlacingDev(true); setDevDraft({ title:'', type:'smoke', iconKey:'', pickupRadius:100, effectSeconds:120, lat:null, lng:null }); }
  function confirmPlaceDevice(){
    const d=devDraft; if(d.lat==null||d.lng==null) { setStatus('❌ Click the map to place the device'); return; }
    const list=getDevices();
    const item={ id:'d'+String(list.length+1).padStart(2,'0'), title:d.title||(d.type[0].toUpperCase()+d.type.slice(1)),
      type:d.type, iconKey:d.iconKey||'', pickupRadius:clamp(Number(d.pickupRadius||0),1,2000),
      effectSeconds:clamp(Number(d.effectSeconds||0),
