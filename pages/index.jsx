import { useEffect, useRef, useState, forwardRef } from 'react';

/* ===========================================================
   Minimal styles
   =========================================================== */
const S = {
  page: { color: '#e9eef2', background: '#0b1116', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' },
  header: { display: 'flex', padding: 12, alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1a2530' },
  hLeft: { display: 'flex', gap: 8, alignItems: 'center' },
  hRight: { display: 'flex', gap: 8, alignItems: 'center' },
  button: { padding: '8px 12px', borderRadius: 10, background: '#111827', color: '#e9eef2', border: '1px solid #2a3642', cursor: 'pointer' },
  input: { background: '#0b1116', color: '#e9eef2', border: '1px solid #22303c', padding: '8px 10px', borderRadius: 10, outline: 'none' },
  tabs: { display: 'flex', gap: 6, padding: 8, borderBottom: '1px solid #1a2530' },
  tabBtn: (active) => ({ ...S.button, padding: '6px 10px', background: active ? '#17212b' : '#0b1116' }),
  wrap: { maxWidth: 1200, margin: '0 auto', padding: 12, display: 'grid', gap: 12 },
  card: { background: '#0c141b', border: '1px solid #22303c', borderRadius: 12, padding: 12 },
  split: { display: 'grid', gridTemplateColumns: '380px 1fr', gap: 12 },
  hr: { border: 'none', borderTop: '1px solid #1a2530', margin: '12px 0' },
};

function Field({ label, children, hint }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 4 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 12, color: '#6d7f90', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

/* ===========================================================
   Helpers / Defaults
   =========================================================== */
function defaultMission(i = 1) {
  return {
    id: `m${String(i).padStart(2, '0')}`,
    title: `Mission ${i}`,
    type: 'statement',
    content: {
      text: 'Do the thing!',
      geofenceEnabled: false,
      lat: null,
      lng: null,
      radiusMeters: 0,
    },
  };
}
function defaultConfig() {
  return {
    version: 1,
    timer: { durationMinutes: 0, alertMinutes: 10 },
    display: { hideRadiusInGame: false }, // NEW — hide rings in game client
    scoring: { pointsPerMission: 10, penalty: 0 },
    powerups: [],
    textRules: [],
  };
}

/* ===========================================================
   MapOverview (Leaflet)
   =========================================================== */
function MapOverview({ missions = [], powerups = [], showRings = true, height = 520 }) {
  const divRef = useRef(null);
  const [leafletReady, setLeafletReady] = useState(!!(typeof window !== 'undefined' && window.L));

  const getLL = (src) => {
    if (!src) return null;
    const c = src.content || src;
    const lat = Number(c.lat ?? c.latitude ?? (c.center && c.center.lat));
    const lng = Number(c.lng ?? c.longitude ?? (c.center && c.center.lng));
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return [lat, lng];
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.L) { setLeafletReady(true); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.async = true; s.onload = () => setLeafletReady(true);
    document.body.appendChild(s);
  }, []);

  useEffect(() => {
    if (!leafletReady || !divRef.current || typeof window === 'undefined') return;
    const L = window.L; if (!L) return;

    if (!divRef.current._leaflet_map) {
      const map = L.map(divRef.current, { center: [44.9778, -93.2650], zoom: 12 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
      divRef.current._leaflet_map = map;
    }
    const map = divRef.current._leaflet_map;

    if (!map._overviewLayer) map._overviewLayer = L.layerGroup().addTo(map);
    map._overviewLayer.clearLayers();
    const layer = map._overviewLayer;
    const bounds = L.latLngBounds([]);

    const missionIcon = L.divIcon({ className: 'mission-icon', html: '<div style="width:18px;height:18px;border-radius:50%;background:#60a5fa;border:2px solid white;box-shadow:0 0 0 2px #1f2937"></div>' });
    const powerIcon   = L.divIcon({ className: 'power-icon', html: '<div style="width:18px;height:18px;border-radius:4px;background:#f59e0b;border:2px solid white;box-shadow:0 0 0 2px #1f2937"></div>' });

    (missions || []).forEach((m) => {
      const pos = getLL(m);
      const c = (m && m.content) || {};
      const isFence = !!(c.geofenceEnabled || Number(c.radiusMeters) > 0);
      if (!pos || !isFence) return;
      const rad = Number(c.radiusMeters || 0);
      const mk = window.L.marker(pos, { icon: missionIcon }).addTo(layer);
      const title = m.title || m.id || 'Mission';
      const t = m.type || '';
      mk.bindPopup(`<b>${title}</b><br/>${t}${rad ? `<br/>radius: ${rad}m` : ''}`);
      if (showRings && rad > 0) window.L.circle(pos, { radius: rad, color: '#60a5fa', fillOpacity: 0.08 }).addTo(layer);
      bounds.extend(pos);
    });

    (powerups || []).forEach((p) => {
      const pos = getLL(p); if (!pos) return;
      const rad = Number(p.pickupRadius || p.radiusMeters || 0);
      const mk = window.L.marker(pos, { icon: powerIcon }).addTo(layer);
      const title = p.title || p.type || 'Power-up';
      mk.bindPopup(`<b>${title}</b>${rad ? `<br/>pickup: ${rad}m` : ''}`);
      if (showRings && rad > 0) window.L.circle(pos, { radius: rad, color: '#f59e0b', fillOpacity: 0.08 }).addTo(layer);
      bounds.extend(pos);
    });

    if (bounds.isValid()) map.fitBounds(bounds.pad(0.2));
  }, [leafletReady, missions, powerups, showRings]);

  return (
    <div>
      {!leafletReady && <div style={{ color: '#9fb0bf', marginBottom: 8 }}>Loading map…</div>}
      <div ref={divRef} style={{ height, borderRadius: 12, border: '1px solid #22303c', background: '#0b1116' }} />
      {((missions || []).filter(m => (m.content?.geofenceEnabled || Number(m.content?.radiusMeters) > 0)).length === 0) &&
       ((powerups || []).length === 0) && (
        <div style={{ color: '#9fb0bf', marginTop: 8 }}>
          No geofenced missions or power-ups found. Enable a mission’s geofence (lat/lng & radius) or add power-ups with lat/lng.
        </div>
      )}
    </div>
  );
}

/* ===========================================================
   SortableMissionsList — delete (small, left) + up/down + duplicate
   =========================================================== */
function SortableMissionsList({ items = [], selectedId, onSelect, onReorder, onDelete, onDuplicate }) {
  const [dragId, setDragId] = useState(null);
  const onDragStart = (e, id) => { setDragId(id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); };
  const onDragOver  = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const onDrop = (e, id) => {
    e.preventDefault();
    const from = dragId, to = id;
    if (!from || !to || from === to) return;
    const cur = items.slice();
    const fromIdx = cur.findIndex(x => x.id === from);
    const toIdx   = cur.findIndex(x => x.id === to);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = cur.splice(fromIdx, 1);
    cur.splice(toIdx, 0, moved);
    onReorder && onReorder(cur);
  };
  const move = (id, dir) => {
    const cur = items.slice();
    const i = cur.findIndex(x => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= cur.length) return;
    const [m] = cur.splice(i, 1);
    cur.splice(j, 0, m);
    onReorder && onReorder(cur);
  };

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {items.map((m) => (
        <div
          key={m.id}
          draggable
          onDragStart={(e) => onDragStart(e, m.id)}
          onDragOver={onDragOver}
          onDrop={(e) => onDrop(e, m.id)}
          onClick={() => onSelect && onSelect(m.id)}
          style={{ border: '1px solid #293744', borderRadius: 12, padding: 10, background: m.id === selectedId ? '#17212b' : '#0b1116', display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', cursor: 'grab' }}
        >
          {/* Left: Delete (small) */}
          <div onClick={(e) => e.stopPropagation()}>
            <button
              style={{ ...S.button, background: '#3a1f25', border: '1px solid #6b1e22', padding: '4px 8px', fontSize: 12 }}
              onClick={() => onDelete && onDelete(m.id)}
            >
              Delete
            </button>
          </div>

          {/* Middle: Text */}
          <div style={{ paddingLeft: 8 }}>
            <div style={{ fontWeight: 600 }}>{m.title || 'Untitled'}</div>
            <div style={{ fontSize: 12, color: '#9fb0bf' }}>{m.type} — id: {m.id}</div>
          </div>

          {/* Right: Up/Down + Duplicate */}
          <div style={{ display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
            <button style={{ ...S.button, padding: '6px 10px' }} onClick={() => move(m.id, -1)}>↑</button>
            <button style={{ ...S.button, padding: '6px 10px' }} onClick={() => move(m.id, +1)}>↓</button>
            <button style={{ ...S.button, padding: '6px 10px' }} onClick={() => onDuplicate && onDuplicate(m.id)}>Duplicate</button>
          </div>
        </div>
      ))}
      {items.length === 0 && <div style={{ color: '#9fb0bf', fontSize: 14 }}>No missions yet.</div>}
    </div>
  );
}

/* ===========================================================
   GameTestbed — lightweight simulator
   =========================================================== */
const GameTestbed = forwardRef(function GameTestbed({ missions = [], config = {} }, ref) {
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [elapsed, setElapsed] = useState(0); // seconds
  const [status, setStatus] = useState('Idle');

  const durationMin = Number(config?.timer?.durationMinutes || 0);
  const alertMin = Number(config?.timer?.alertMinutes ?? 10);
  const pointsPer = Number(config?.scoring?.pointsPerMission ?? 10);
  const penalty = Number(config?.scoring?.penalty ?? 0);
  const total = (missions || []).length;

  useEffect(() => {
    if (!ref) return;
    ref.current = {
      start: () => { setStarted(true); setStatus('Running'); },
      reset: () => { setStarted(false); setIdx(0); setScore(0); setElapsed(0); setStatus('Idle'); },
    };
  }, [ref]);

  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [started]);

  const timeLimitSec = durationMin > 0 ? durationMin * 60 : null;
  const timeLeft = timeLimitSec != null ? Math.max(0, timeLimitSec - elapsed) : null;
  useEffect(() => {
    if (timeLimitSec != null && elapsed >= timeLimitSec && started) {
      setStarted(false); setStatus('Time up');
    }
  }, [elapsed, timeLimitSec, started]);

  const fmt = (sec) => { const m = Math.floor(sec / 60), s = sec % 60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; };
  const cur = missions[idx] || null;
  const next = () => { if (idx + 1 < total) setIdx(idx + 1); else { setStarted(false); setStatus('Finished'); } };
  const complete = () => { setScore((s) => s + pointsPer); next(); };
  const fail = () => { setScore((s) => Math.max(0, s - penalty)); next(); };

  const renderMission = (m) => {
    if (!m) return <div style={{ color: '#9fb0bf' }}>No mission.</div>;
    const t = m.type || ''; const c = m.content || {};
    const title = <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{m.title || 'Untitled'}</div>;
    const hint = c.hint || c.prompt || c.text || '';
    if (t === 'multiple_choice') {
      const choices = Array.isArray(c.choices) ? c.choices : [];
      return (
        <div>
          {title}
          {hint && <div style={{ marginBottom: 8, color: '#9fb0bf' }}>{hint}</div>}
          <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
            {choices.map((ch, i) => (
              <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="radio" name={`mc_${m.id}`} />
                {typeof ch === 'string' ? ch : (ch?.label ?? JSON.stringify(ch))}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={S.button} onClick={complete}>Submit</button>
            <button style={S.button} onClick={fail}>Fail</button>
          </div>
        </div>
      );
    }
    if (t === 'geofence_image' || t === 'geofence' || c.geofenceEnabled) {
      return (
        <div>
          {title}
          {c.imageUrl && <img src={c.imageUrl} alt="" style={{ maxWidth: '100%', borderRadius: 8, marginBottom: 8 }} />}
          <div style={{ color: '#9fb0bf', marginBottom: 8 }}>Simulate entering the mission geofence.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={S.button} onClick={complete}>Simulate Enter (Complete)</button>
            <button style={S.button} onClick={fail}>Fail</button>
          </div>
        </div>
      );
    }
    return (
      <div>
        {title}
        {hint && <div style={{ marginBottom: 8, color: '#9fb0bf' }}>{hint}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.button} onClick={complete}>Complete</button>
          <button style={S.button} onClick={fail}>Fail</button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', marginBottom: 8 }}>
        <div style={{ color: '#9fb0bf' }}>
          Status: <b>{status}</b>
          {started && timeLimitSec != null && (timeLeft <= (Number(config?.timer?.alertMinutes ?? 10) * 60)) &&
            <span style={{ marginLeft: 8, color: '#f59e0b' }}>⚠ Alert</span>}
        </div>
        <div style={{ fontWeight: 600 }}>Score: {score}</div>
        <div style={{ fontVariantNumeric: 'tabular-nums' }}>{timeLimitSec == null ? `Elapsed ${fmt(elapsed)}` : `Time ${fmt(timeLeft || 0)}`}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 12 }}>
        <div style={{ border: '1px solid #22303c', borderRadius: 12, padding: 10, background: '#0b1116' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Missions</div>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {(missions || []).map((m, i) => (
              <li key={m.id} style={{ marginBottom: 4, color: i === idx ? '#e9eef2' : '#9fb0bf' }}>
                <a href="#" onClick={(e) => { e.preventDefault(); setIdx(i); }} style={{ color: 'inherit' }}>
                  {m.title || m.id || `Mission ${i + 1}`}
                </a>
              </li>
            ))}
          </ol>
        </div>
        <div style={{ border: '1px solid #22303c', borderRadius: 12, padding: 12, background: '#0b1116' }}>
          {renderMission(cur)}
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between' }}>
            <div>Mission {Math.min(idx + 1, total)} / {total}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={S.button} onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx <= 0}>Prev</button>
              <button style={S.button} onClick={() => setIdx(Math.min(total - 1, idx + 1))} disabled={idx >= total - 1}>Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

/* ===========================================================
   Main Admin
   =========================================================== */
export default function Admin() {
  // active game slug
  const [activeSlug, setActiveSlug] = useState('game-1');

  // data
  const [suite, setSuite] = useState({ missions: [defaultMission(1), defaultMission(2)] });
  const [config, setConfig] = useState(defaultConfig());

  // ui
  const [tab, setTab] = useState('missions'); // 'settings' | 'missions' | 'text' | 'powerups' | 'map' | 'test'
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(null);

  // map/ui toggles
  const [showRings, setShowRings] = useState(true);
  const testRef = useRef(null);
  const [testChannel, setTestChannel] = useState('draft');
  const gameBase = (typeof window !== 'undefined'
    ? (window.__GAME_ORIGIN__ || process.env.NEXT_PUBLIC_GAME_ORIGIN)
    : process.env.NEXT_PUBLIC_GAME_ORIGIN) || (config?.gameOrigin) || '';

  // ----- demo persistence (localStorage) -----
  useEffect(() => {
    try {
      const raw = localStorage.getItem('admin_demo_state');
      if (raw) {
        const { suite: s, config: c } = JSON.parse(raw);
        if (s) setSuite(s);
        if (c) setConfig(c);
      }
    } catch {}
  }, []);
  function saveAll() {
    try {
      localStorage.setItem('admin_demo_state', JSON.stringify({ suite, config }));
      setStatus('Saved locally (demo)');
    } catch (e) {
      setStatus('Save failed: ' + (e?.message || e));
    }
  }
  async function handlePublish() {
    try {
      setStatus('Publishing…');
      const res = await fetch(`/api/game/${activeSlug}?channel=published`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Publish failed');
      setStatus(`✅ Published v${data?.version || ''}`);
    } catch (e) {
      setStatus('❌ Publish failed: ' + (e?.message || e));
    }
  }

  // ----- missions CRUD -----
  function editExisting(m) { setEditing(m); }
  function removeMission(id) {
    if (!confirm('Delete this mission?')) return;
    const next = (suite.missions || []).filter((x) => x.id !== id);
    setSuite({ ...suite, missions: next });
    if (editing?.id === id) setEditing(null);
    setStatus('Deleted mission');
  }
  function duplicateMission(id) {
    const cur = (suite.missions || []);
    const idx = cur.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const orig = cur[idx];
    const clone = JSON.parse(JSON.stringify(orig));
    const ids = new Set(cur.map(x => x.id));
    const base = (orig.id || 'm') + '-copy';
    let cand = base; let n = 2;
    while (ids.has(cand)) { cand = base + '-' + (n++); }
    clone.id = cand;
    clone.title = (orig.title || 'Untitled') + ' (copy)';
    const next = cur.slice(); next.splice(idx + 1, 0, clone);
    setSuite({ ...suite, missions: next });
    setStatus('✅ Duplicated mission');
  }
  function addMission() {
    const nextIdx = (suite.missions?.length || 0) + 1;
    const m = defaultMission(nextIdx);
    const next = [...(suite.missions || []), m];
    setSuite({ ...suite, missions: next }); setEditing(m);
  }

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.hLeft}>
          <strong>Escape Ride — Admin</strong>
          <select style={S.input} value={activeSlug} onChange={(e) => setActiveSlug(e.target.value)}>
            <option value="game-1">game-1</option>
            <option value="game-2">game-2</option>
          </select>
          <span style={{ color: '#9fb0bf', fontSize: 12 }}>status: {status || '—'}</span>
        </div>
        <div style={S.hRight}>
          <button style={S.button} onClick={saveAll}>Save All</button>
          <button style={{ ...S.button, background: '#103217', border: '1px solid #1d5c2a' }} onClick={handlePublish}>Publish</button>
        </div>
      </header>

      {/* tabs */}
      <div style={S.tabs}>
        {['settings', 'missions', 'text', 'powerups', 'map', 'test'].map((t) => (
          <button key={t} style={S.tabBtn(tab === t)} onClick={() => setTab(t)}>{t.toUpperCase()}</button>
        ))}
      </div>

      {/* SETTINGS */}
      {tab === 'settings' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <h3 style={{ marginTop: 0 }}>Game Timer</h3>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
              <Field label="Duration (minutes)" hint="0 means count up">
                <input
                  type="number"
                  style={S.input}
                  value={config.timer?.durationMinutes ?? 0}
                  onChange={(e) => setConfig({ ...config, timer: { ...(config.timer || {}), durationMinutes: Number(e.target.value || 0) } })}
                />
              </Field>
              <Field label="Alert (minutes before end)">
                <input
                  type="number"
                  style={S.input}
                  value={config.timer?.alertMinutes ?? 10}
                  onChange={(e) => setConfig({ ...config, timer: { ...(config.timer || {}), alertMinutes: Number(e.target.value || 10) } })}
                />
              </Field>
            </div>
            <div style={{ color: '#9fb0bf', marginTop: 8 }}>
              If duration is 0 it counts up; otherwise it counts down, plays an alarm when {config.timer?.alertMinutes ?? 10} minutes remain,
              and shows <b>“TIME IS UP! GAME OVER. TRY AGAIN”</b> at 0.
            </div>

            <hr style={S.hr} />
            <h3 style={{ marginTop: 0 }}>Display</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={!!(config.display?.hideRadiusInGame)}
                onChange={(e) => setConfig({ ...config, display: { ...(config.display || {}), hideRadiusInGame: e.target.checked } })}
              />
              Hide geofence radius in the game client
            </label>
            <div style={{ color: '#9fb0bf' }}>Players won’t see radius circles around missions or power-ups in-game. (Admin → MAP still shows rings.)</div>

            <hr style={S.hr} />
            <h3 style={{ marginTop: 0 }}>Scoring</h3>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
              <Field label="Points per mission">
                <input
                  type="number"
                  style={S.input}
                  value={config.scoring?.pointsPerMission ?? 10}
                  onChange={(e) => setConfig({ ...config, scoring: { ...(config.scoring || {}), pointsPerMission: Number(e.target.value || 10) } })}
                />
              </Field>
              <Field label="Penalty (fail)">
                <input
                  type="number"
                  style={S.input}
                  value={config.scoring?.penalty ?? 0}
                  onChange={(e) => setConfig({ ...config, scoring: { ...(config.scoring || {}), penalty: Number(e.target.value || 0) } })}
                />
              </Field>
            </div>
          </div>
        </main>
      )}

      {/* MISSIONS */}
      {tab === 'missions' && (
        <main style={{ ...S.wrap, gridTemplateColumns: '1fr' }}>
          <div style={{ ...S.card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Missions</h3>
              <button style={S.button} onClick={addMission}>+ New Mission</button>
            </div>

            <div style={S.split}>
              {/* left list */}
              <div>
                <SortableMissionsList
                  items={(suite.missions || [])}
                  selectedId={editing?.id || null}
                  onSelect={(id) => {
                    const m = (suite.missions || []).find((x) => x.id === id);
                    if (m) editExisting(m);
                  }}
                  onDelete={(id) => removeMission(id)}
                  onDuplicate={(id) => duplicateMission(id)}
                  onReorder={(next) => {
                    setSuite({ ...suite, missions: next });
                    setStatus('Reordered missions');
                  }}
                />
              </div>

              {/* right editor */}
              <div style={{ border: '1px solid #22303c', borderRadius: 12, padding: 12 }}>
                {!editing && (
                  <div style={{ color: '#9fb0bf' }}>
                    Select a mission or click <i>New Mission</i>.
                  </div>
                )}
                {editing && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0 }}>Edit Mission</h4>
                      <button
                        style={{ ...S.button, background: '#3a1f25', border: '1px solid #6b1e22' }}
                        onClick={() => removeMission(editing.id)}
                      >
                        Delete Mission
                      </button>
                    </div>
                    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
                      <Field label="ID">
                        <input style={S.input} value={editing.id} onChange={(e) => setEditing({ ...editing, id: e.target.value })} />
                      </Field>
                      <Field label="Title">
                        <input style={S.input} value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                      </Field>
                      <Field label="Type">
                        <select
                          style={S.input}
                          value={editing.type || 'statement'}
                          onChange={(e) => setEditing({ ...editing, type: e.target.value })}
                        >
                          <option value="statement">statement</option>
                          <option value="multiple_choice">multiple_choice</option>
                          <option value="geofence">geofence</option>
                          <option value="geofence_image">geofence_image</option>
                        </select>
                      </Field>
                      <Field label="Geofence enabled">
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={!!(editing.content?.geofenceEnabled)}
                            onChange={(e) => setEditing({ ...editing, content: { ...(editing.content || {}), geofenceEnabled: e.target.checked } })}
                          />
                          Enabled
                        </label>
                      </Field>
                      <Field label="Latitude">
                        <input
                          style={S.input}
                          type="number"
                          value={editing.content?.lat ?? ''}
                          onChange={(e) => setEditing({ ...editing, content: { ...(editing.content || {}), lat: Number(e.target.value || 0) } })}
                        />
                      </Field>
                      <Field label="Longitude">
                        <input
                          style={S.input}
                          type="number"
                          value={editing.content?.lng ?? ''}
                          onChange={(e) => setEditing({ ...editing, content: { ...(editing.content || {}), lng: Number(e.target.value || 0) } })}
                        />
                      </Field>
                      <Field label="Radius (meters)">
                        <input
                          style={S.input}
                          type="number"
                          value={editing.content?.radiusMeters ?? 0}
                          onChange={(e) => setEditing({ ...editing, content: { ...(editing.content || {}), radiusMeters: Number(e.target.value || 0) } })}
                        />
                      </Field>
                      <Field label="Text / Prompt">
                        <input
                          style={S.input}
                          value={editing.content?.text || ''}
                          onChange={(e) => setEditing({ ...editing, content: { ...(editing.content || {}), text: e.target.value } })}
                        />
                      </Field>
                      <Field label="Image URL (for geofence_image)">
                        <input
                          style={S.input}
                          value={editing.content?.imageUrl || ''}
                          onChange={(e) => setEditing({ ...editing, content: { ...(editing.content || {}), imageUrl: e.target.value } })}
                        />
                      </Field>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        style={S.button}
                        onClick={() => {
                          const next = (suite.missions || []).map((x) => (x.id === editing.id ? editing : x));
                          setSuite({ ...suite, missions: next });
                          setStatus('Saved edits (unsaved globally until Save All)');
                        }}
                      >
                        Apply Edits
                      </button>
                      <button
                        style={S.button}
                        onClick={() => setEditing(null)}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* TEXT (placeholder) */}
      {tab === 'text' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <h3 style={{ marginTop: 0 }}>Text Rules</h3>
            <div style={{ color: '#9fb0bf' }}>Add your text rules UI here (kept minimal).</div>
          </div>
        </main>
      )}

      {/* POWERUPS (simplified list) */}
      {tab === 'powerups' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <h3 style={{ marginTop: 0 }}>Power-Ups</h3>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
              <Field label="Title">
                <input
                  style={S.input}
                  value={config._pu?.title || ''}
                  onChange={(e) => setConfig({ ...config, _pu: { ...(config._pu || {}), title: e.target.value } })}
                />
              </Field>
              <Field label="Type">
                <select
                  style={S.input}
                  value={config._pu?.type || 'signal_jammer'}
                  onChange={(e) => setConfig({ ...config, _pu: { ...(config._pu || {}), type: e.target.value } })}
                >
                  <option value="signal_jammer">signal_jammer</option>
                  <option value="speed_boost">speed_boost</option>
                </select>
              </Field>
              <Field label="Pickup radius (m)">
                <input
                  type="number"
                  style={S.input}
                  value={config._pu?.pickupRadius ?? 50}
                  onChange={(e) => setConfig({ ...config, _pu: { ...(config._pu || {}), pickupRadius: Number(e.target.value || 0) } })}
                />
              </Field>
              <Field label="Effect seconds">
                <input
                  type="number"
                  style={S.input}
                  value={config._pu?.effectSeconds ?? 30}
                  onChange={(e) => setConfig({ ...config, _pu: { ...(config._pu || {}), effectSeconds: Number(e.target.value || 0) } })}
                />
              </Field>
            </div>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
              <Field label="Latitude">
                <input
                  type="number"
                  style={S.input}
                  value={config._pu?.lat ?? 0}
                  onChange={(e) => setConfig({ ...config, _pu: { ...(config._pu || {}), lat: Number(e.target.value || 0) } })}
                />
              </Field>
              <Field label="Longitude">
                <input
                  type="number"
                  style={S.input}
                  value={config._pu?.lng ?? 0}
                  onChange={(e) => setConfig({ ...config, _pu: { ...(config._pu || {}), lng: Number(e.target.value || 0) } })}
                />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                style={S.button}
                onClick={() => {
                  const item = {
                    id: 'p' + String((config.powerups?.length || 0) + 1).padStart(2, '0'),
                    title: config._pu?.title || 'Power-up',
                    type: config._pu?.type || 'signal_jammer',
                    pickupRadius: Number(config._pu?.pickupRadius || 50),
                    effectSeconds: Number(config._pu?.effectSeconds || 30),
                    lat: Number(config._pu?.lat || 0),
                    lng: Number(config._pu?.lng || 0),
                  };
                  const list = Array.isArray(config.powerups) ? [...config.powerups, item] : [item];
                  const next = { ...config, powerups: list, _pu: undefined };
                  setConfig(next);
                  setStatus('✅ Power-up added (remember Save All)');
                }}
              >+ Add Power-Up</button>
            </div>

            <hr style={S.hr} />
            <h4>Placed Power-Ups</h4>
            {(config.powerups || []).length === 0 && <div style={{ color: '#9fb0bf' }}>No power-ups yet.</div>}
            <ul style={{ paddingLeft: 18 }}>
              {(config.powerups || []).map((x, i) => (
                <li key={x.id} style={{ marginBottom: 8 }}>
                  <code>{x.id}</code> — {x.title || '(untitled)'} • {x.type} • radius {x.pickupRadius}m • effect {x.effectSeconds}s • lat {x.lat}, lng {x.lng}
                  <button
                    style={{ ...S.button, marginLeft: 8, padding: '6px 10px' }}
                    onClick={() => {
                      const next = [...(config.powerups || [])];
                      next.splice(i, 1);
                      setConfig({ ...config, powerups: next });
                    }}
                  >Remove</button>
                </li>
              ))}
            </ul>
          </div>
        </main>
      )}

      {/* MAP */}
      {tab === 'map' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Game Map</h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={showRings} onChange={(e) => setShowRings(e.target.checked)} />
                Show radius rings (admin only)
              </label>
            </div>
            <MapOverview missions={(suite?.missions) || []} powerups={(config?.powerups) || []} showRings={showRings} />
            <div style={{ color: '#9fb0bf', marginTop: 8 }}>Shows all geofenced missions and power-ups for the selected game.</div>
          </div>
        </main>
      )}

      {/* TEST */}
      {tab === 'test' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Test Game</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={S.button} onClick={() => testRef?.current?.start()}>Start</button>
                <button style={S.button} onClick={() => testRef?.current?.reset()}>Reset</button>
              </div>
            </div>

            <GameTestbed ref={testRef} missions={(suite?.missions) || []} config={(config) || {}} />

            <hr style={S.hr} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>Play Test (iframe)</h4>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label>Channel:&nbsp;
                  <select value={testChannel} onChange={(e) => setTestChannel(e.target.value)} style={S.input}>
                    <option value="draft">draft</option>
                    <option value="published">published</option>
                  </select>
                </label>
                <a
                  href={(gameBase ? `${gameBase}/?slug=${activeSlug}&channel=${testChannel}` : '#')}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...S.button, textDecoration: 'none' }}
                >
                  Open full window
                </a>
              </div>
            </div>

            {!gameBase && (
              <div style={{ color: '#9fb0bf', marginBottom: 8 }}>
                Set <code>NEXT_PUBLIC_GAME_ORIGIN</code> (or <code>config.gameOrigin</code>) to enable embedded preview.
              </div>
            )}
            {gameBase && (
              <iframe
                src={`${gameBase}/?slug=${activeSlug}&channel=${testChannel}&preview=1`}
                style={{ width: '100%', height: '70vh', border: '1px solid #22303c', borderRadius: 12 }}
              />
            )}
          </div>
        </main>
      )}
    </div>
  );
}
