import React from 'react';

function readUrlParams() {
  if (typeof window === 'undefined') return { slug:'', channel:'published', preview:false };
  const url = new URL(window.location.href);
  let slug = url.searchParams.get('slug') || '';
  if (!slug) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0]) slug = parts[0];
  }
  const channel = url.searchParams.get('channel') || 'published';
  const preview = url.searchParams.get('preview') === '1';
  return { slug, channel, preview };
}
function useLeaflet() {
  const [ready, setReady] = React.useState(!!(typeof window !== 'undefined' && window.L));
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.L) { setReady(true); return; }
    const link = document.createElement('link'); link.rel='stylesheet'; link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link);
    const s = document.createElement('script'); s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.async=true; s.onload=()=>setReady(true); document.body.appendChild(s);
  }, []);
  return ready;
}
function ensureGoogleFontLoaded(gf) {
  if (!gf || typeof document === 'undefined') return;
  const id = `gf-${gf}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id; link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${gf}:wght@400;600;700&display=swap`;
  document.head.appendChild(link);
}
function applyOpacity(hex, alpha=1) {
  if (!hex) return `rgba(0,0,0,${alpha})`;
  const h = hex.replace('#','');
  let r,g,b;
  if (h.length === 3) { r=parseInt(h[0]+h[0],16); g=parseInt(h[1]+h[1],16); b=parseInt(h[2]+h[2],16); }
  else { r=parseInt(h.slice(0,2),16); g=parseInt(h.slice(2,4),16); b=parseInt(h.slice(4,6),16); }
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${a})`;
}

/* Answer tag utils */
function normMid(idOrNum) {
  const t = String(idOrNum || '').trim().toLowerCase();
  if (/^m\d+$/i.test(t)) return t;
  if (/^\d+$/.test(t)) return 'm' + String(t).padStart(2,'0');
  return t;
}
function expandText(text, answers) {
  if (!text) return text;
  // Support #m03#, #id:03answer#, #id:m03answer#
  return String(text)
    .replace(/#m(\d{1,3})#/gi, (_, num) => (answers[normMid(num)] ?? ''))
    .replace(/#id:(m?\d{1,3})answer#/gi, (_, tok) => (answers[normMid(tok)] ?? ''));
}

export default function Game() {
  const { slug, channel, preview } = readUrlParams();

  // Session id (for partial saves)
  const sessionRef = React.useRef('');
  if (typeof window !== 'undefined' && !sessionRef.current) {
    const k = `esx_session_${slug}`;
    sessionRef.current = window.localStorage.getItem(k) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
    window.localStorage.setItem(k, sessionRef.current);
  }

  const [missions, setMissions] = React.useState([]);
  const [config, setConfig]     = React.useState(null);
  const [idx, setIdx]           = React.useState(0);
  const [points, setPoints]     = React.useState(0);

  const [answers, setAnswers]   = React.useState({}); // { m01: "lucy", ... }
  const [items, setItems]       = React.useState({ video:[], audio:[], rewards:[], utilities:[] });
  const [overlay, setOverlay]   = React.useState(null);

  const leafletReady = useLeaflet();
  const mapDiv = React.useRef(null);
  const mapRef = React.useRef(null);
  const playerMarker = React.useRef(null);

  const ADMIN_ORIGIN =
    (typeof window !== 'undefined'
      ? (window.__ADMIN_ORIGIN__ || process.env.NEXT_PUBLIC_ADMIN_ORIGIN)
      : process.env.NEXT_PUBLIC_ADMIN_ORIGIN) || '';

  React.useEffect(() => {
    async function load() {
      const base = channel === 'draft' ? `/games/${encodeURIComponent(slug)}/draft` : `/games/${encodeURIComponent(slug)}`;
      const [c, m] = await Promise.all([
        fetch(`${base}/config.json`, { cache:'no-store' }).then(r=>r.ok?r.json():null),
        fetch(`${base}/missions.json`, { cache:'no-store' }).then(r=>r.ok?r.json():null),
      ]);
      if (!c || !m) {
        setConfig({ game:{ title:'Game' }, theme:{}, forms:{players:1} });
        setMissions([]);
        return;
      }
      if (c?.theme?.fontGF) ensureGoogleFontLoaded(c.theme.fontGF);
      setConfig(c);
      setMissions(Array.isArray(m.missions) ? m.missions : []);
      setIdx(0);
      setPoints(0);
      setAnswers({});
      setItems({ video:[], audio:[], rewards:[], utilities:[] });
      setOverlay(null);
    }
    if (slug) load();
  }, [slug, channel]);

  React.useEffect(() => {
    const m = missions[idx];
    if (!m) return;
    const gf = (m.appearanceOverrideEnabled && m.appearance?.fontGF) ? m.appearance.fontGF : (config?.theme?.fontGF || null);
    if (gf) ensureGoogleFontLoaded(gf);
  }, [missions, idx, config?.theme?.fontGF]);

  // Map init
  React.useEffect(() => {
    if (!leafletReady || !mapDiv.current || mapRef.current) return;
    const L = window.L;
    const map = L.map(mapDiv.current).setView([44.9778,-93.265], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap' }).addTo(map);
    mapRef.current = map;
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition((pos) => {
        const p = [pos.coords.latitude, pos.coords.longitude];
        if (!playerMarker.current) playerMarker.current = L.marker(p, { title:'You' }).addTo(map);
        else playerMarker.current.setLatLng(p);
      }, ()=>{}, { enableHighAccuracy: true });
    }
  }, [leafletReady]);

  // Draw current mission geofence
  React.useEffect(() => {
    const L = window.L; const map = mapRef.current;
    if (!leafletReady || !map) return;
    if (!map._playLayer) map._playLayer = L.layerGroup().addTo(map);
    map._playLayer.clearLayers();
    const m = missions[idx];
    if (m?.content?.geofenceEnabled && m.content.lat && m.content.lng) {
      const pos = [Number(m.content.lat), Number(m.content.lng)];
      L.marker(pos, { title: m.title || m.id }).addTo(map._playLayer);
      const rad = Number(m.content.radiusMeters || 25);
      L.circle(pos, { radius: rad, color: '#60a5fa', fillOpacity: 0.08 }).addTo(map._playLayer);
      map.setView(pos, 15);
    }
  }, [leafletReady, missions, idx]);

  // Save run (partial or final)
  async function saveRun({ partial=false } = {}) {
    if (!ADMIN_ORIGIN) return;
    try {
      const payload = {
        answers,
        score: points,
        player: {}, // if you collect splash data, add here
        meta: { updatedAt: new Date().toISOString(), preview, partial },
        ...(partial ? { session: sessionRef.current } : {}),
      };
      await fetch(`${ADMIN_ORIGIN}/api/runs/${encodeURIComponent(slug)}`, {
        method:'POST', headers:{ 'Content-Type':'application/json' }, credentials:'include',
        body: JSON.stringify(payload),
      });
    } catch {}
  }

  // Utilities
  function useUtility(name) {
    if (name.toLowerCase().includes('smoke')) {
      const elm = document.createElement('div');
      elm.style.position='fixed'; elm.style.inset='0'; elm.style.pointerEvents='none';
      elm.style.background='radial-gradient(ellipse at center, rgba(120,120,120,0.35), rgba(0,0,0,0.85) 70%)';
      elm.style.transition='opacity 400ms ease'; elm.style.opacity='0'; elm.style.zIndex='200';
      document.body.appendChild(elm);
      requestAnimationFrame(()=>{ elm.style.opacity='1'; });
      setTimeout(()=>{ elm.style.opacity='0'; setTimeout(()=>elm.remove(), 500); }, 8000);
    }
    setItems(p => {
      const i = p.utilities.findIndex(x => x.name === name);
      if (i < 0) return p;
      const next = { ...p, utilities:[...p.utilities] };
      next.utilities.splice(i,1);
      return next;
    });
  }

  function completeMission(m, answerValue) {
    // Record answer by mission id (if provided)
    if (m?.id && answerValue !== undefined) {
      setAnswers(a => ({ ...a, [m.id]: String(answerValue) }));
    }

    // Points
    const pts = Number(m.rewards?.points || 0);
    if (pts) setPoints(p => p + pts);

    // Media to backpack
    const mc = m.completion || {};
    const title = mc.title || (m.title ? `${m.title} — ${mc.mediaType || 'media'}` : 'Mission Media');
    const thumb = mc.thumbUrl || '';
    if (mc.mediaType === 'audio' && mc.mediaUrl) {
      setItems(x => ({ ...x, audio: [...x.audio, { title, url: mc.mediaUrl, thumb }] }));
      try { const a = new Audio(mc.mediaUrl); a.play().catch(()=>{}); } catch {}
    } else if (mc.mediaType === 'video' && mc.mediaUrl) {
      setItems(x => ({ ...x, video: [...x.video, { title, url: mc.mediaUrl, thumb }] }));
      setOverlay({ kind:'video', url: mc.mediaUrl, title, message: mc.message || 'Mission complete!' });
    } else if (mc.mediaType === 'image' && mc.mediaUrl) {
      setItems(x => ({ ...x, rewards: [...x.rewards, { name: title, thumb: thumb || mc.mediaUrl, imageUrl: mc.mediaUrl, isImage:true }] }));
      setOverlay({ kind:'image', url: mc.mediaUrl, title, message: mc.message || 'Mission complete!' });
    } else {
      setOverlay({ kind:'message', message: mc.message || 'Mission complete!' });
    }

    // After recording result → save partial
    saveRun({ partial:true });

    setIdx(i => {
      const nxt = i + 1;
      if (nxt >= missions.length) {
        // finish → final save
        saveRun({ partial:false });
        return i;
      }
      return nxt;
    });
  }

  // appearance
  const m = missions[idx] || null;
  const ap = (m?.appearanceOverrideEnabled ? m.appearance : (config?.appearance || {})) || {};
  const appStyle = ap.screenBgImage
    ? { background: `linear-gradient(${applyOpacity('#000', ap.screenBgOpacity ?? 0)}, ${applyOpacity('#000', ap.screenBgOpacity ?? 0)}), url(${ap.screenBgImage}) center/cover no-repeat` }
    : { background: applyOpacity(ap.screenBgColor || '#0b0c10', ap.screenBgOpacity ?? 0) };

  const textWrap = {
    fontFamily: ap.fontFamily || 'inherit',
    fontSize: (ap.fontSizePx ?? 18) + 'px',
    color: ap.fontColor || '#fff',
    background: applyOpacity(ap.textBgColor || '#000', ap.textBgOpacity ?? 0),
    display: 'inline-block',
    padding: '8px 12px',
    borderRadius: 10,
    textAlign: ap.textAlign || 'center',
  };
  const dockStyle = (ap.textVertical === 'center'
    ? { position:'fixed', top:'50%', left:'
