// game/pages/index.jsx
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

/* answer tag utilities */
function normalizeIdToken(token) {
  // Accept "m02" or "02" → returns "m02"
  const t = String(token || '').trim().toLowerCase();
  if (/^m\d+$/i.test(t)) return t;
  if (/^\d+$/.test(t)) return 'm' + String(t).padStart(2,'0');
  return t;
}
function expandText(text, answers) {
  if (!text) return text;
  return String(text).replace(/#id:([a-z0-9]+)answer#/gi, (_, id) => {
    const key = normalizeIdToken(id);
    const v = answers[key];
    return (v === undefined || v === null) ? '' : String(v);
  });
}

export default function Game() {
  const { slug, channel, preview } = readUrlParams();
  const [missions, setMissions] = React.useState([]);
  const [config, setConfig]     = React.useState(null);
  const [idx, setIdx]           = React.useState(0);
  const [points, setPoints]     = React.useState(0);

  // per-run state
  const [answers, setAnswers]   = React.useState({}); // { m01: "lucy", m02: "A", ... }
  const [items, setItems]       = React.useState({ video:[], audio:[], rewards:[], utilities:[] });

  const [overlay, setOverlay]   = React.useState(null); // mission-complete media viewer

  const leafletReady = useLeaflet();
  const mapDiv = React.useRef(null);
  const mapRef = React.useRef(null);
  const playerMarker = React.useRef(null);

  // origins
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

  // per-mission font
  React.useEffect(() => {
    const m = missions[idx];
    if (!m) return;
    const gf = (m.appearance?.enabled && m.appearance?.fontGF) ? m.appearance.fontGF : (config?.theme?.fontGF || null);
    if (gf) ensureGoogleFontLoaded(gf);
  }, [missions, idx, config?.theme?.fontGF]);

  // Init map
  React.useEffect(() => {
    if (!leafletReady || !mapDiv.current || mapRef.current) return;
    const L = window.L;
    const map = L.map(mapDiv.current).setView([44.9778,-93.265], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap' }).addTo(map);
    mapRef.current = map;
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition((pos) => {
        const p = [pos.coords.latitude, pos.coords.longitude];
        if (!playerMarker.current) {
          playerMarker.current = L.marker(p, { title:'You' }).addTo(map);
        } else {
          playerMarker.current.setLatLng(p);
        }
      }, ()=>{}, { enableHighAccuracy: true });
    }
  }, [leafletReady]);

  // Draw geofence of current mission
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

  // helpers
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
    // store an answer (by mission id)
    if (m?.id && answerValue !== undefined) {
      setAnswers(a => ({ ...a, [m.id]: String(answerValue) }));
    }

    // points
    const pts = Number(m.rewards?.points || 0);
    if (pts) setPoints(p => p + pts);

    // completion media → to pockets
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

    // next mission or finish
    setIdx(i => {
      const next = i + 1;
      if (next >= missions.length) {
        // finished — persist run
        sendRun();
        return i; // stay
      }
      return next;
    });
  }

  async function sendRun() {
    try {
      if (!ADMIN_ORIGIN) return;
      const payload = {
        answers, score: points,
        player: {}, // if you collect splash info, put it here { email, phone, name }
        meta: { finishedAt: new Date().toISOString(), preview },
      };
      const res = await fetch(`${ADMIN_ORIGIN}/api/runs/${encodeURIComponent(slug)}`, {
        method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload),
        credentials:'include',
      });
      // Optional: inspect response
      await res.text();
    } catch {}
  }

  // appearance
  const m = missions[idx] || null;
  const ap = (m?.appearanceOverrideEnabled ? m.appearance : (config?.appearance || {})) || {};
  const appStyle = {};
  if (ap.screenBgImage) appStyle.background = `linear-gradient(${applyOpacity('#000', ap.screenBgOpacity ?? 0)}, ${applyOpacity('#000', ap.screenBgOpacity ?? 0)}), url(${ap.screenBgImage}) center/cover no-repeat`;
  else appStyle.background = applyOpacity(ap.screenBgColor || '#0b0c10', ap.screenBgOpacity ?? 0);

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
    ? { position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex: 9, pointerEvents:'none' }
    : { position:'fixed', top:54+12, left:12, right:12, zIndex: 9, pointerEvents:'none' });

  return (
    <main style={styles.main}>
      <div style={{ ...styles.app, ...appStyle }}>
        {/* top bar */}
        <div style={styles.topbar}>
          <div style={styles.title}>{config?.game?.title || 'Game'}</div>
          <div style={styles.score}>⭐ {points}</div>
          <button style={styles.mediaBtn} onClick={()=>{ const p=document.getElementById('backpack'); p.style.display = (p.style.display==='block')?'none':'block'; }}>🎒 Backpack</button>
        </div>

        {/* map */}
        <div ref={mapDiv} style={styles.map} />

        {/* mission content */}
        <div style={dockStyle}>
          <div style={{ ...styles.card, pointerEvents:'auto' }}>
            {!m ? (
              <div style={{ color:'#9fb0bf' }}>No missions in this game.</div>
            ) : (
              <>
                <div style={{ marginBottom: 6, fontWeight: 700 }}>{m.title || m.id}</div>
                <div style={textWrap}>
                  {m.type === 'multiple_choice' && (
                    <div>
                      <div style={{ marginBottom: 8 }}>{expandText(m.content?.question || '', answers)}</div>
                      <div style={{ display:'grid', gap:6 }}>
                        {(m.content?.choices || []).map((c, i) => (
                          <button key={i} style={styles.choice}
                            onClick={() => completeMission(m, c)}
                          >{expandText(c, answers)}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {m.type === 'short_answer' && (
                    <ShortAnswer
                      prompt={expandText(m.content?.question || '', answers)}
                      onSubmit={(val) => completeMission(m, val)}
                    />
                  )}
                  {m.type === 'statement' && (
                    <div>{expandText(m.content?.text || '', answers)}</div>
                  )}
                  {m.type === 'video' && (
                    <div style={{ display:'grid', gap:8 }}>
                      {m.content?.videoUrl && <video src={m.content.videoUrl} controls style={{ width:'100%', borderRadius:10 }} />}
                      {m.content?.overlayText && <div>{expandText(m.content.overlayText, answers)}</div>}
                      <button style={styles.primaryBtn} onClick={()=>completeMission(m, '')}>Continue</button>
                    </div>
                  )}
                </div>
                {m?.content?.geofenceEnabled && (
                  <div style={{ marginTop: 10, fontSize: 12, color:'#9fb0bf' }}>
                    Reach the marked area to unlock / complete.
                    {preview && <button style={{ ...styles.smallBtn, marginLeft: 8 }} onClick={()=>completeMission(m, '')}>Simulate reach</button>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* backpack */}
        <div id="backpack" style={styles.backpackPanel}>
          <Backpack items={items} onUse={useUtility} />
        </div>

        {/* overlay media viewer */}
        {overlay && (
          <div style={styles.overlay}>
            <div style={styles.overlayCard}>
              <div style={{ marginBottom:8, fontWeight:700 }}>{overlay.title || overlay.message || 'Mission complete!'}</div>
              {overlay.kind === 'video' && <video src={overlay.url} controls autoPlay style={{ width:'100%', borderRadius:10 }} />}
              {overlay.kind === 'audio' && <audio src={overlay.url} controls autoPlay style={{ width:'100%' }} />}
              {overlay.kind === 'image' && <img src={overlay.url} alt="" style={{ width:'100%', borderRadius:10 }} />}
              {overlay.kind === 'message' && <div style={{ ...textWrap }}>{overlay.message}</div>}
              <button style={{ ...styles.primaryBtn, marginTop:10 }} onClick={()=>setOverlay(null)}>OK</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function ShortAnswer({ prompt, onSubmit }) {
  const [v, setV] = React.useState('');
  return (
    <div>
      <div style={{ marginBottom: 8 }}>{prompt}</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8 }}>
        <input value={v} onChange={e=>setV(e.target.value)} placeholder="Type your answer…"
          style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid #2a323b', background:'#0b0c10', color:'#e9eef2' }} />
        <button style={{ padding:'10px 14px', borderRadius:10, border:'1px solid #2a323b', background:'#1a2027', color:'#e9eef2' }}
          onClick={()=>onSubmit(v)}>Submit</button>
      </div>
    </div>
  );
}

function Backpack({ items, onUse }) {
  const tabs = [
    { key:'video',     label:'Video' },
    { key:'audio',     label:'Audio' },
    { key:'rewards',   label:'Rewards' },
    { key:'utilities', label:'Utilities' },
  ];
  const [tab, setTab] = React.useState('video');
  return (
    <div>
      <div style={{ display:'flex', gap:6, marginBottom:8 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={()=>setTab(t.key)}
            style={{ padding:'6px 10px', borderRadius:8, border:'1px solid #2a323b', background: tab===t.key ? '#1a2027' : '#0f1418', color:'#e9eef2' }}>
            {t.label}
          </button>
        ))}
      </div>
      <div>
        {tab === 'video'     && <PocketGrid items={items.video} kind="video" />}
        {tab === 'audio'     && <PocketGrid items={items.audio} kind="audio" />}
        {tab === 'rewards'   && <PocketGrid items={items.rewards} kind="rewards" />}
        {tab === 'utilities' && <PocketGrid items={items.utilities} kind="utilities" onUse={onUse} />}
      </div>
    </div>
  );
}
function PocketGrid({ items, kind, onUse }) {
  if (!items || items.length === 0) return <div style={{ color:'#9fb0bf' }}>Nothing here yet.</div>;
  return (
    <div style={styles.grid}>
      {items.map((it, i) => (
        <div key={i} style={styles.tile}>
          <div style={styles.thumbWrap}>
            {it.thumb
              ? <img src={it.thumb} alt="" style={styles.thumbImg} />
              : <div style={styles.thumbFallback}>{kind === 'video' ? '🎥' : kind === 'audio' ? '🎵' : kind === 'utilities' ? '🧰' : '💎'}</div>
            }
          </div>
          <div style={styles.tileTitle}>{it.title || it.name || '(untitled)'}</div>
          <div style={styles.tileActions}>
            {it.url && <a href={it.url} target="_blank" rel="noreferrer"><button style={styles.smallBtn}>Open</button></a>}
            {it.imageUrl && <a href={it.imageUrl} target="_blank" rel="noreferrer"><button style={styles.smallBtn}>View</button></a>}
            {onUse && kind==='utilities' && <button style={styles.smallBtn} onClick={()=>onUse(it.name)}>Use</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* styles */
const TOPBAR_H = 54;
const styles = {
  main: { minHeight:'100vh', background:'#0b0c10', color:'#e9eef2' },
  app:  { minHeight:'100vh', position:'relative' },
  topbar: { position:'fixed', top:0, left:0, right:0, height:TOPBAR_H, display:'flex', alignItems:'center', gap:12,
            padding:'0 12px', background:'#0b0c10cc', backdropFilter:'blur(8px)', borderBottom:'1px solid #1d2329', zIndex:10 },
  title: { fontWeight:800, flex:1 },
  score: { fontWeight:600 },
  mediaBtn: { padding:'8px 10px', borderRadius:10, border:'1px solid #2a323b', background:'#1a2027', color:'#e9eef2', cursor:'pointer' },
  map:   { position:'fixed', top:TOPBAR_H, left:0, right:0, bottom: 0, background:'#0b1116' },
  card:  { background:'#12181d', border:'1px solid #1f262d', borderRadius:14, padding:12, maxWidth:720, width:'calc(100vw - 24px)' },
  backpackPanel: { position:'fixed', left:12, bottom:12, width:'min(92vw, 520px)', maxHeight:'60vh', overflow:'auto',
                   background:'#12181d', border:'1px solid #1f262d', borderRadius:12, padding:10, display:'none', zIndex:11 },
  grid: { display:'grid', gap:8, gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))' },
  tile: { border:'1px solid #1f262d', borderRadius:10, padding:8, background:'#0f1418' },
  thumbWrap: { width:'100%', aspectRatio:'4/3', background:'#0b0c10', border:'1px solid #1f262d', borderRadius:8, display:'grid', placeItems:'center', overflow:'hidden' },
  thumbImg: { width:'100%', height:'100%', objectFit:'cover' },
  thumbFallback: { fontSize: 28, opacity: 0.8 },
  tileTitle: { marginTop:6, fontSize: 13, fontWeight: 600 },
  tileActions: { marginTop:6, display:'flex', gap:6, flexWrap:'wrap' },
  smallBtn: { padding:'6px 10px', borderRadius:8, border:'1px solid #2a323b', background:'#1a2027', color:'#e9eef2', cursor:'pointer' },
  primaryBtn: { padding:'10px 14px', borderRadius:10, border:'1px solid #2a323b', background:'#103217', color:'#e9eef2', cursor:'pointer' },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'grid', placeItems:'center', zIndex: 100 },
  overlayCard: { width:'min(560px, 92vw)', background:'#12181d', border:'1px solid #1f262d', borderRadius:12, padding:12 },
};
