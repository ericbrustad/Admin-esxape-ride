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
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link);
    const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.async = true; s.onload = () => setReady(true); document.body.appendChild(s);
  }, []);
  return ready;
}
function haversine(a, b) {
  const R = 6371000;
  const toRad = (x) => (x*Math.PI)/180;
  const dLat = toRad(b[0]-a[0]); const dLon = toRad(b[1]-a[1]);
  const s1 = Math.sin(dLat/2)**2 + Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(s1));
}
function ensureGoogleFontLoaded(gf) {
  if (!gf) return;
  if (typeof document === 'undefined') return;
  const id = `gf-${gf}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${gf}:wght@400;600;700&display=swap`;
  document.head.appendChild(link);
}

export default function Game() {
  const { slug, channel, preview } = readUrlParams();
  const [missions, setMissions] = React.useState([]);
  const [config, setConfig] = React.useState(null);
  const [idx, setIdx] = React.useState(0);
  const [points, setPoints] = React.useState(0);
  const [items, setItems] = React.useState([]);
  const [overlay, setOverlay] = React.useState(null); // mission-complete media
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
        setConfig({ game:{ title:'Game' }, theme:{}, forms:{players:1} });
        setMissions([]);
        return;
      }
      // Load global theme font if any
      if (c?.theme?.fontGF) ensureGoogleFontLoaded(c.theme.fontGF);
      setConfig(c);
      setMissions(Array.isArray(m.missions) ? m.missions : []);
      setIdx(0);
      setPoints(0);
      setItems([]);
    }
    if (slug) load();
  }, [slug, channel]);

  // load per-mission font when mission changes
  React.useEffect(() => {
    const m = missions[idx];
    if (!m) return;
    const gf = (m.appearance?.enabled && m.appearance?.fontGF) ? m.appearance.fontGF : (config?.theme?.fontGF || null);
    if (gf) ensureGoogleFontLoaded(gf);
  }, [missions, idx, config?.theme?.fontGF]);

  // init map
  React.useEffect(() => {
    if (!leafletReady || !mapDiv.current || mapRef.current) return;
    const L = window.L;
    const map = L.map(mapDiv.current).setView([44.9778,-93.265], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'© OpenStreetMap' }).addTo(map);
    mapRef.current = map;

    // track player
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

  // draw geofences of current mission
  React.useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
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

  function completeMission(m) {
    const pts = Number(m.rewards?.points || 0);
    if (pts) setPoints(p => p + pts);
    const newItems = Array.isArray(m.rewards?.items) ? m.rewards.items.filter(Boolean) : [];
    if (newItems.length) setItems(prev => [...prev, ...newItems]);

    const mc = m.completion || {};
    if (mc.mediaType === 'audio' && mc.mediaUrl) {
      const a = new Audio(mc.mediaUrl); a.play().catch(()=>{});
    } else if (mc.mediaType === 'video' && mc.mediaUrl) {
      setOverlay({ kind:'video', url: mc.mediaUrl, message: mc.message || 'Mission complete!' });
    } else if (mc.mediaType === 'image' && mc.mediaUrl) {
      setOverlay({ kind:'image', url: mc.mediaUrl, message: mc.message || 'Mission complete!' });
    } else {
      setOverlay({ kind:'message', message: mc.message || 'Mission complete!' });
    }

    setIdx(i => Math.min(i + 1, (missions.length - 1)));
  }

  function useItem(name) {
    if (name.toLowerCase().includes('smoke')) {
      const elm = document.createElement('div');
      elm.style.position = 'fixed';
      elm.style.inset = '0';
      elm.style.pointerEvents = 'none';
      elm.style.background = 'radial-gradient(ellipse at center, rgba(120,120,120,0.35), rgba(0,0,0,0.85) 70%)';
      elm.style.transition = 'opacity 400ms ease';
      elm.style.opacity = '0';
      document.body.appendChild(elm);
      requestAnimationFrame(()=>{ elm.style.opacity = '1'; });
      setTimeout(()=>{ elm.style.opacity = '0'; setTimeout(()=>elm.remove(), 500); }, 8000);
    }
    setItems(prev => {
      const i = prev.indexOf(name);
      if (i >= 0) { const next = [...prev]; next.splice(i,1); return next; }
      return prev;
    });
  }

  const m = missions[idx] || null;

  const ap = (m?.appearance?.enabled ? m.appearance : (config?.theme || {})) || {};
  const appStyle = {};
  if (ap.screenImg) appStyle.background = `url(${ap.screenImg}) center/cover no-repeat`;
  else if (ap.screenBg) appStyle.background = ap.screenBg;

  const textStyle = {
    fontFamily: ap.fontFamily || 'inherit',
    fontSize: (ap.fontSize ?? 18) + 'px',
    color: ap.fontColor || '#fff',
    background: ap.fontBg || 'transparent',
    display: 'inline-block',
    padding: '6px 10px',
    borderRadius: 8,
  };

  return (
    <main style={styles.main}>
      <div style={{ ...styles.app, ...appStyle }}>
        <div style={styles.topbar}>
          <div style={styles.title}>{config?.game?.title || 'Game'}</div>
          <div style={styles.score}>⭐ {points}</div>
        </div>

        <div ref={mapDiv} style={styles.map} />

        <div style={styles.backpackDock}>
          <button style={styles.backpackBtn} onClick={() => {
            const p = document.getElementById('backpack-panel');
            p.style.display = (p.style.display === 'block') ? 'none' : 'block';
          }}>
            🎒 <span style={{ marginLeft: 6 }}>Backpack</span>
          </button>
          <div id="backpack-panel" style={styles.backpackPanel}>
            {(items.length === 0) ? (
              <div style={{ color:'#9fb0bf' }}>No items yet.</div>
            ) : (
              <ul style={{ listStyle:'none', padding:0, margin:0 }}>
                {items.map((it, i) => (
                  <li key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid #1d2329' }}>
                    <div>{it}</div>
                    <div style={{ display:'flex', gap:6 }}>
                      <button style={styles.smallBtn} onClick={()=>useItem(it)}>Use</button>
                      <button style={styles.smallBtn} onClick={()=>setItems(prev => { const next=[...prev]; next.splice(i,1); return next; })}>Remove</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

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

        {overlay && (
          <div style={styles.overlay}>
            <div style={styles.overlayCard}>
              <div style={{ marginBottom:8, fontWeight:700 }}>{overlay.message || 'Mission complete!'}</div>
              {overlay.kind === 'video' && <video src={overlay.url} controls autoPlay style={{ width:'100%', borderRadius:10 }} />}
              {overlay.kind === 'image' && <img src={overlay.url} alt="" style={{ width:'100%', borderRadius:10 }} />}
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

const styles = {
  main: { minHeight:'100vh', background:'#0b0c10', color:'#e9eef2' },
  app: { minHeight:'100vh', position:'relative', paddingBottom: 90 },
  topbar: { position:'fixed', top:0, left:0, right:0, height:54, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px', background:'#0b0c10cc', backdropFilter:'blur(8px)', borderBottom:'1px solid #1d2329', zIndex:10 },
  title: { fontWeight:800 },
  score: { fontWeight:600 },
  map: { position:'fixed', top:54, left:0, right:0, bottom: 90, background:'#0b1116' },
  card: { position:'fixed', left:12, right:12, bottom:12, background:'#12181d', border:'1px solid #1f262d', borderRadius:14, padding:12, zIndex: 9 },
  backpackDock: { position:'fixed', left:12, bottom: 90+12, zIndex: 9 },
  backpackBtn: { padding:'8px 10px', borderRadius:10, border:'1px solid #2a323b', background:'#1a2027', color:'#e9eef2', display:'flex', alignItems:'center' },
  backpackPanel: { display:'none', marginTop:8, background:'#12181d', border:'1px solid #1f262d', borderRadius:10, padding:10, width:260, maxHeight:240, overflow:'auto' },
  choice: { display:'block', textAlign:'left', padding:'10px 12px', borderRadius:10, border:'1px solid #2a323b', background:'#0f1418', color:'#e9eef2' },
  smallBtn: { padding:'6px 10px', borderRadius:8, border:'1px solid #2a323b', background:'#1a2027', color:'#e9eef2', cursor:'pointer' },
  primaryBtn: { padding:'10px 14px', borderRadius:10, border:'1px solid #2a323b', background:'#103217', color:'#e9eef2', cursor:'pointer' },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'grid', placeItems:'center', zIndex: 100 },
  overlayCard: { width:'min(520px, 92vw)', background:'#12181d', border:'1px solid #1f262d', borderRadius:12, padding:12 },
};
