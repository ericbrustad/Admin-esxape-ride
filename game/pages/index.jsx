import React from 'react';

/* ---------------- URL params ---------------- */
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

/* ---------------- Leaflet loader ---------------- */
function useLeaflet() {
  const [ready, setReady] = React.useState(!!(typeof window !== 'undefined' && window.L));
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.L) { setReady(true); return; }
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link);
    const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.async = true; s.onload = () => setReady(true); document.body.appendChild(s);
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
  const h = hex.replace('#', '');
  let r,g,b;
  if (h.length === 3) { r=parseInt(h[0]+h[0],16); g=parseInt(h[1]+h[1],16); b=parseInt(h[2]+h[2],16); }
  else { r=parseInt(h.slice(0,2),16); g=parseInt(h.slice(2,4),16); b=parseInt(h.slice(4,6),16); }
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${a})`;
}

/* ---------------- Main ---------------- */
export default function Game() {
  const { slug, channel, preview } = readUrlParams();
  const [missions, setMissions] = React.useState([]);
  const [config, setConfig] = React.useState(null);
  const [idx, setIdx] = React.useState(0);
  const [points, setPoints] = React.useState(0);

  // Backpack pockets
  const [pack, setPack] = React.useState({ video: [], audio: [], rewards: [], utilities: [] });
  const [bpOpen, setBpOpen] = React.useState(false);
  const [bpTab, setBpTab] = React.useState('video'); // video | audio | rewards | utilities

  // Overlay for mission complete / viewing media
  const [overlay, setOverlay] = React.useState(null); // { kind:'video'|'audio'|'image'|'message', url?, title?, message? }

  const leafletReady = useLeaflet();
  const mapDiv = React.useRef(null);
  const mapRef = React.useRef(null);
  const playerMarker = React.useRef(null);

  React.useEffect(() => {
    async function load() {
      const base = channel === 'draft' ? `/games/${encodeURIComponent(slug)}/draft` : `/games/${encodeURIComponent(slug)}`;
      const [c, m] = await Promise.all([
        fetch(`${base}/config.json`, { cache:'no-store' }).then(r=>r.ok?r.json():null),
        fetch(`${base}/missions.json`, { cache:'no-store' }).then(r=>r.ok?r.json():null),
      ]);
      if (!c || !m) {
        setConfig({ game:{ title:'Game' }, theme:{}, media:{ thumbs:{ rewards:{}, utilities:{} } }, forms:{players:1} });
        setMissions([]);
        return;
      }
      if (c?.theme?.fontGF) ensureGoogleFontLoaded(c.theme.fontGF);
      setConfig({ ...c, media: c.media || { thumbs:{ rewards:{}, utilities:{} } } });
      setMissions(Array.isArray(m.missions) ? m.missions : []);
      setIdx(0); setPoints(0); setPack({ video:[], audio:[], rewards:[], utilities:[] }); setOverlay(null);
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

  // Map
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

  // Draw geofence for current mission
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

  /* ---------- helpers ---------- */
  function isUtilityName(name='') {
    const s = name.toLowerCase();
    return ['smoke','jammer','xray','x-ray','clone','bot','clone bot','clone bots'].some(k => s.includes(k));
  }
  function rewardThumb(name) {
    return config?.media?.thumbs?.rewards?.[name] || '';
  }
  function utilityThumb(name) {
    return config?.media?.thumbs?.utilities?.[name] || '';
  }
  function addToPack(kind, item) {
    setPack(p => ({ ...p, [kind]: [...p[kind], item] }));
  }

  function completeMission(m) {
    // points
    const pts = Number(m.rewards?.points || 0);
    if (pts) setPoints(p => p + pts);

    // rewards → split into reward vs utility pockets
    const list = Array.isArray(m.rewards?.items) ? m.rewards.items.filter(Boolean) : [];
    if (list.length) {
      list.forEach(name => {
        if (isUtilityName(name)) addToPack('utilities', { name, thumb: utilityThumb(name) });
        else addToPack('rewards', { name, thumb: rewardThumb(name) });
      });
    }

    // completion media → add to media pockets
    const mc = m.completion || {};
    const mediaTitle = mc.title || (m.title ? `${m.title} — ${mc.mediaType || 'media'}` : 'Mission Media');
    const mediaThumb = mc.thumbUrl || '';
    if (mc.mediaType === 'audio' && mc.mediaUrl) {
      addToPack('audio', { title: mediaTitle, url: mc.mediaUrl, thumb: mediaThumb });
      try { const a = new Audio(mc.mediaUrl); a.play().catch(()=>{}); } catch {}
    } else if (mc.mediaType === 'video' && mc.mediaUrl) {
      addToPack('video', { title: mediaTitle, url: mc.mediaUrl, thumb: mediaThumb });
      setOverlay({ kind:'video', url: mc.mediaUrl, title: mediaTitle, message: mc.message || 'Mission complete!' });
    } else if (mc.mediaType === 'image' && mc.mediaUrl) {
      addToPack('rewards', { name: mediaTitle, thumb: mediaThumb || mc.mediaUrl, imageUrl: mc.mediaUrl, isImage: true });
      setOverlay({ kind:'image', url: mc.mediaUrl, title: mediaTitle, message: mc.message || 'Mission complete!' });
    } else {
      setOverlay({ kind:'message', message: mc.message || 'Mission complete!' });
    }

    // advance (keeps you on last mission if at end)
    setIdx(i => Math.min(i + 1, (missions.length - 1)));
  }

  function useUtility(name) {
    // Example: smoke effect
    if (name.toLowerCase().includes('smoke')) {
      const elm = document.createElement('div');
      elm.style.position = 'fixed';
      elm.style.inset = '0';
      elm.style.pointerEvents = 'none';
      elm.style.background = 'radial-gradient(ellipse at center, rgba(120,120,120,0.35), rgba(0,0,0,0.85) 70%)';
      elm.style.transition = 'opacity 400ms ease';
      elm.style.opacity = '0';
      elm.style.zIndex = '200';
      document.body.appendChild(elm);
      requestAnimationFrame(()=>{ elm.style.opacity = '1'; });
      setTimeout(()=>{ elm.style.opacity = '0'; setTimeout(()=>elm.remove(), 500); }, 8000);
    }
    // remove one instance
    setPack(p => {
      const i = p.utilities.findIndex(x => x.name === name);
      if (i < 0) return p;
      const next = { ...p, utilities: [...p.utilities] };
      next.utilities.splice(i,1);
      return next;
    });
  }

  /* ---------- appearance ---------- */
  const m = missions[idx] || null;
  const ap = (m?.appearance?.enabled ? m.appearance : (config?.theme || {})) || {};
  const textAlignV = ap.textAlignV || 'top'; // 'top' | 'center'

  // Screen background layers
  const screenBgStyle = {
    backgroundColor: applyOpacity(ap.screenBg || '#0b0c10', ap.screenBgOpacity ?? 1)
  };
  const screenImgStyle = ap.screenImg ? {
    backgroundImage: `url(${ap.screenImg})`,
    backgroundSize: 'cover', backgroundPosition: 'center',
    opacity: (ap.screenImgOpacity ?? 1)
  } : null;

  // Text bubble style
  const textStyle = {
    fontFamily: ap.fontFamily || 'inherit',
    fontSize: (ap.fontSize ?? 18) + 'px',
    color: applyOpacity(ap.fontColor || '#fff', ap.fontColorOpacity ?? 1),
    background: applyOpacity(ap.fontBg || '#000000', ap.fontBgOpacity ?? 0.5),
    display: 'inline-block',
    padding: '8px 12px',
    borderRadius: 10
  };

  const dockStyle = (textAlignV === 'center'
    ? styles.dockCenter
    : styles.dockTop);

  return (
    <main style={styles.main}>
      {/* background layers */}
      <div style={{ ...styles.app }}>
        <div style={{ ...styles.bgColor, ...screenBgStyle }} />
        {screenImgStyle && <div style={{ ...styles.bgImage, ...screenImgStyle }} />}

        {/* Top bar */}
        <div style={styles.topbar}>
          <div style={styles.title}>{config?.game?.title || 'Game'}</div>
          <div style={styles.score}>⭐ {points}</div>
          <button
            style={styles.mediaBtn}
            onClick={() => { setBpOpen((s)=>!s); }}
            aria-label="Toggle Backpack"
          >
            🎒 Backpack
          </button>
        </div>

        {/* Map (kept full area, backpack floats) */}
        <div ref={mapDiv} style={styles.map} />

        {/* Mission content dock (top or center). Never covers the backpack (backpack is bottom-left). */}
        <div style={dockStyle}>
          <div style={styles.card}>
            {!m ? (
              <div style={{ color:'#9fb0bf' }}>No missions in this game.</div>
            ) : (
              <>
                <div style={{ marginBottom: 6, fontWeight: 700 }}>{m.title || m.id}</div>
                <div style={textStyle}>
                  {m.type === 'multiple_choice' && (
                    <div>
                      <div style={{ marginBottom: 8 }}>{m.content?.question || ''}</div>
                      <div style={{ display:'grid', gap:6 }}>
                        {(m.content?.choices || []).map((c, i) => (
                          <button key={i} style={styles.choice}
                            onClick={() => { completeMission(m); }}
                          >{c}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {m.type === 'short_answer' && (
                    <ShortAnswer onSubmit={() => completeMission(m)} prompt={m.content?.question || ''} />
                  )}
                  {m.type === 'statement' && (
                    <div>{m.content?.text || ''}</div>
                  )}
                  {m.type === 'video' && (
                    <div style={{ display:'grid', gap:8 }}>
                      {m.content?.videoUrl && <video src={m.content.videoUrl} controls style={{ width:'100%', borderRadius:10 }} />}
                      {m.content?.overlayText && <div>{m.content.overlayText}</div>}
                      <button style={styles.primaryBtn} onClick={()=>completeMission(m)}>Continue</button>
                    </div>
                  )}
                </div>

                {m?.content?.geofenceEnabled && (
                  <div style={{ marginTop: 10, fontSize: 12, color:'#9fb0bf' }}>
                    Reach the marked area to unlock / complete.
                    {preview && <button style={{ ...styles.smallBtn, marginLeft: 8 }} onClick={()=>completeMission(m)}>Simulate reach</button>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Backpack panel (pockets) */}
        <div style={{ ...styles.backpackPanel, display: bpOpen ? 'block' : 'none' }}>
          <div style={styles.bpTabs}>
            {['video','audio','rewards','utilities'].map(k => (
              <button
                key={k}
                onClick={()=>setBpTab(k)}
                style={{ ...styles.bpTabBtn, ...(bpTab===k? styles.bpTabActive : {}) }}
              >
                {k.toUpperCase()}
              </button>
            ))}
          </div>
          <div style={styles.bpBody}>
            {bpTab === 'video' && <PocketGrid items={pack.video} kind="video" onOpen={(it)=>setOverlay({ kind:'video', url: it.url, title: it.title })} onRemove={(i)=>setPack(p=>({ ...p, video: p.video.filter((_,j)=>j!==i) }))} />}
            {bpTab === 'audio' && <PocketGrid items={pack.audio} kind="audio" onOpen={(it)=>setOverlay({ kind:'audio', url: it.url, title: it.title })} onRemove={(i)=>setPack(p=>({ ...p, audio: p.audio.filter((_,j)=>j!==i) }))} />}
            {bpTab === 'rewards' && <PocketGrid items={pack.rewards} kind="rewards" onOpen={(it)=>it.imageUrl? setOverlay({ kind:'image', url: it.imageUrl, title: it.name }):null} onRemove={(i)=>setPack(p=>({ ...p, rewards: p.rewards.filter((_,j)=>j!==i) }))} />}
            {bpTab === 'utilities' && (
              <PocketGrid
                items={pack.utilities} kind="utilities"
                onUse={(it)=>useUtility(it.name)}
                onRemove={(i)=>setPack(p=>({ ...p, utilities: p.utilities.filter((_,j)=>j!==i) }))}
              />
            )}
          </div>
        </div>

        {/* Overlay (Mission Complete / Media viewer) ALWAYS CENTER, uses mission/global appearance */}
        {overlay && (
          <div style={styles.overlay}>
            <div style={{ ...styles.overlayCard, fontFamily: ap.fontFamily || 'inherit' }}>
              <div style={{ marginBottom: 8, fontWeight: 700, fontSize: (ap.fontSize ?? 18) + 'px',
                color: applyOpacity(ap.fontColor || '#fff', ap.fontColorOpacity ?? 1) }}>
                {overlay.title || overlay.message || 'Mission complete!'}
              </div>
              {overlay.kind === 'video' && <video src={overlay.url} controls autoPlay style={{ width:'100%', borderRadius:10 }} />}
              {overlay.kind === 'audio' && <audio src={overlay.url} controls autoPlay style={{ width:'100%' }} />}
              {overlay.kind === 'image' && <img src={overlay.url} alt="" style={{ width:'100%', borderRadius:10 }} />}
              {overlay.kind === 'message' && (
                <div style={{ ...styles.msgBubble,
                  color: applyOpacity(ap.fontColor || '#fff', ap.fontColorOpacity ?? 1),
                  background: applyOpacity(ap.fontBg || '#000000', ap.fontBgOpacity ?? 0.5) }}>
                  {overlay.message}
                </div>
              )}
              <button style={{ ...styles.primaryBtn, marginTop:10 }} onClick={()=>setOverlay(null)}>OK</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

/* ---------------- Smaller components ---------------- */
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

function PocketGrid({ items, kind, onOpen, onUse, onRemove }) {
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
            {onOpen && it.url && <button style={styles.smallBtn} onClick={()=>onOpen(it)}>Open</button>}
            {onOpen && it.imageUrl && <button style={styles.smallBtn} onClick={()=>onOpen(it)}>View</button>}
            {onUse && <button style={styles.smallBtn} onClick={()=>onUse(it)}>Use</button>}
            {onRemove && <button style={styles.smallBtn} onClick={()=>onRemove(i)}>Remove</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Styles ---------------- */
const TOPBAR_H = 54;
const styles = {
  main: { minHeight:'100vh', background:'#0b0c10', color:'#e9eef2' },
  app: { minHeight:'100vh', position:'relative' },

  bgColor: { position:'fixed', inset:0, zIndex: 0 },
  bgImage: { position:'fixed', inset:0, zIndex: 0 },

  topbar: { position:'fixed', top:0, left:0, right:0, height:TOPBAR_H, display:'flex', alignItems:'center', gap:12,
            padding:'0 12px', background:'#0b0c10cc', backdropFilter:'blur(8px)', borderBottom:'1px solid #1d2329', zIndex:10 },
  title: { fontWeight:800, flex:1 },
  score: { fontWeight:600 },
  mediaBtn: { padding:'8px 10px', borderRadius:10, border:'1px solid #2a323b', background:'#1a2027', color:'#e9eef2', cursor:'pointer' },

  map: { position:'fixed', top:TOPBAR_H, left:0, right:0, bottom: 0, background:'#0b1116', zIndex: 1 },

  // Content dock — top or center, never bottom (to keep backpack visible)
  dockTop: { position:'fixed', top: TOPBAR_H + 12, left: 12, right: 12, display:'grid', placeItems:'center', zIndex: 9, pointerEvents:'none' },
  dockCenter: { position:'fixed', top: '50%', left: '50%', transform:'translate(-50%,-50%)', display:'grid', placeItems:'center', zIndex: 9, pointerEvents:'none' },

  card: { background:'#12181d', border:'1px solid #1f262d', borderRadius:14, padding:12, maxWidth: 720, width: 'calc(100vw - 24px)',
          pointerEvents:'auto' },

  // Backpack
  backpackPanel: { position:'fixed', left:12, bottom:12, width: 'min(92vw, 520px)', maxHeight: '60vh', overflow:'auto',
                   background:'#12181d', border:'1px solid #1f262d', borderRadius:12, padding:8, zIndex: 11 },
  bpTabs: { display:'flex', gap:6, marginBottom: 8 },
  bpTabBtn: { padding:'6px 10px', borderRadius:8, border:'1px solid #2a323b', background:'#0f1418', color:'#e9eef2', cursor:'pointer' },
  bpTabActive: { background:'#1a2027' },
  bpBody: { },

  grid: { display:'grid', gap:8, gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))' },
  tile: { border:'1px solid #1f262d', borderRadius:10, padding:8, background:'#0f1418' },
  thumbWrap: { width:'100%', aspectRatio:'4/3', background:'#0b0c10', border:'1px solid #1f262d', borderRadius:8, display:'grid', placeItems:'center', overflow:'hidden' },
  thumbImg: { width: '100%', height: '100%', objectFit:'cover' },
  thumbFallback: { fontSize: 28, opacity: 0.8 },
  tileTitle: { marginTop:6, fontSize: 13, fontWeight: 600 },
  tileActions: { marginTop:6, display:'flex', gap:6, flexWrap:'wrap' },

  choice: { display:'block', textAlign:'left', padding:'10px 12px', borderRadius:10, border:'1px solid #2a323b', background:'#0f1418', color:'#e9eef2', cursor:'pointer' },
  smallBtn: { padding:'6px 10px', borderRadius:8, border:'1px solid #2a323b', background:'#1a2027', color:'#e9eef2', cursor:'pointer' },
  primaryBtn: { padding:'10px 14px', borderRadius:10, border:'1px solid #2a323b', background:'#103217', color:'#e9eef2', cursor:'pointer' },

  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'grid', placeItems:'center', zIndex: 100 },
  overlayCard: { width:'min(560px, 92vw)', background:'#12181d', border:'1px solid #1f262d', borderRadius:12, padding:12 },
  msgBubble: { display:'inline-block', padding:'8px 12px', borderRadius:10 },
};
