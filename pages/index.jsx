// pages/index.jsx
import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

// --- React-Leaflet (client-only) ---
const MapContainer = dynamic(
  async () => (await import('react-leaflet')).MapContainer,
  { ssr: false }
);
const TileLayer = dynamic(
  async () => (await import('react-leaflet')).TileLayer,
  { ssr: false }
);
const Marker = dynamic(
  async () => (await import('react-leaflet')).Marker,
  { ssr: false }
);
const Popup = dynamic(
  async () => (await import('react-leaflet')).Popup,
  { ssr: false }
);
const Circle = dynamic(
  async () => (await import('react-leaflet')).Circle,
  { ssr: false }
);

// --- Appearance choices ---
const FONT_CHOICES = [
  { label: 'System Sans', value: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, Helvetica' },
  { label: 'Inter', value: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Segoe UI', value: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Garamond', value: 'Garamond, serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: 'Consolas', value: 'Consolas, Menlo, Monaco, monospace' },
  { label: 'Comic Sans', value: '"Comic Sans MS", cursive, sans-serif' },
];
const COLOR_CHOICES = [
  '#e9eef2', '#ffffff', '#cbd5e1', '#94a3b8', '#64748b', '#1f2937',
  '#0b0c10', '#000000', '#f87171', '#fb923c', '#fbbf24', '#34d399',
  '#60a5fa', '#a78bfa', '#f472b6'
];

// --- Utils ---
function arrayMove(arr, from, to) {
  const a = arr.slice();
  if (from < 0 || from >= a.length || to < 0 || to >= a.length) return a;
  const [item] = a.splice(from, 1);
  a.splice(to, 0, item);
  return a;
}

function isMixedContent(parentUrl, childUrl) {
  try {
    const p = new URL(parentUrl);
    const c = new URL(childUrl);
    return p.protocol === 'https:' && c.protocol === 'http:';
  } catch {
    return false;
  }
}

function getInitialGameOrigin() {
  if (typeof window !== 'undefined') {
    const v = window.localStorage.getItem('admin_game_origin');
    if (v) return v;
  }
  if (process.env.NEXT_PUBLIC_GAME_ORIGIN) return process.env.NEXT_PUBLIC_GAME_ORIGIN;
  return '';
}

export default function AdminPage() {
  const [tab, setTab] = useState('MISSIONS');
  const [slugs, setSlugs] = useState([]);
  const [slug, setSlug] = useState('');
  const [suite, setSuite] = useState({ id: 'suite', version: 1, missions: [] });
  const [config, setConfig] = useState({ game: { title: 'Untitled' }, theme: { missionDefault: { fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial', fontSize: 18, textColor: '#e9eef2', backgroundColor: '#0b0c10' } } });
  const [selectedId, setSelectedId] = useState('');
  const [channel, setChannel] = useState('published');
  const [gameOrigin, setGameOrigin] = useState(getInitialGameOrigin());

  const selected = useMemo(() => (suite.missions || []).find(m => m.id === selectedId) || null, [suite, selectedId]);

  // load slugs
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/games');
        const j = await r.json();
        if (j?.slugs) {
          setSlugs(j.slugs);
          if (!slug && j.slugs.length) setSlug(j.slugs[0]);
        }
      } catch {}
    })();
  }, []); // only once

  // load data for slug+channel
  useEffect(() => {
    (async () => {
      if (!slug) return;
      try {
        const r = await fetch(`/api/load?slug=${encodeURIComponent(slug)}&channel=${encodeURIComponent(channel)}`);
        const j = await r.json();
        if (j?.ok) {
          if (j.config) setConfig(j.config);
          if (j.missions) {
            setSuite(j.missions);
            if (j.missions.missions?.length) setSelectedId(j.missions.missions[0].id);
          }
        }
      } catch {}
    })();
  }, [slug, channel]);

  // actions
  async function saveAll() {
    try {
      const r = await fetch('/api/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, channel, config, missions: suite }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || 'Save failed');
      alert('Saved.');
    } catch (e) {
      alert(String(e.message || e));
    }
  }

  async function publishNow() {
    try {
      const r = await fetch('/api/publish', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || 'Publish failed');
      alert('Published.');
    } catch (e) {
      alert(String(e.message || e));
    }
  }

  async function createGame() {
    const input = window.prompt('Enter new game slug (letters, numbers, hyphens). Leave blank to auto-generate:');
    const body = input ? { slug: input.trim() } : {};
    const r = await fetch('/api/games', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => null);
    if (!j?.ok) { alert('Create failed: ' + (j?.error || 'unknown')); return; }
    setSlugs(j.slugs || []);
    setSlug(j.slug);
  }

  function newMission(type = 'short_answer') {
    const id = `m${Math.random().toString(36).slice(2, 6)}`;
    const draft = { id, type, title: 'New Mission', content: {} };
    setSuite(s => ({ ...s, missions: [...(s.missions || []), draft] }));
    setSelectedId(id);
    setTab('MISSIONS');
  }

  function deleteMission(id) {
    setSuite(s => ({ ...s, missions: (s.missions || []).filter(m => m.id !== id) }));
    if (selectedId === id) setSelectedId('');
  }

  function moveMission(id, dir) {
    setSuite(s => {
      const idx = (s.missions || []).findIndex(m => m.id === id);
      if (idx === -1) return s;
      const to = dir === 'up' ? idx - 1 : idx + 1;
      return { ...s, missions: arrayMove(s.missions, idx, to) };
    });
  }

  function updateSelected(patch) {
    setSuite(s => ({
      ...s,
      missions: (s.missions || []).map(m => (m.id === selectedId ? { ...m, ...patch } : m)),
    }));
  }

  const geofenced = useMemo(
    () => (suite?.missions || []).filter(m => Number.isFinite(m?.lat) && Number.isFinite(m?.lng)),
    [suite]
  );

  // TEST tab URL
  const iframeSrc = useMemo(() => {
    if (!gameOrigin || !slug) return '';
    const base = gameOrigin.replace(/\/+$/, '');
    return `${base}/?slug=${encodeURIComponent(slug)}&channel=${encodeURIComponent(channel)}&preview=1`;
  }, [gameOrigin, slug, channel]);
  const mixed = (typeof window !== 'undefined') && iframeSrc && isMixedContent(window.location.href, iframeSrc);

  return (
    <main style={{ padding: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
        <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['SETTINGS', 'MISSIONS', 'TEXT', 'POWERUPS', 'MAP', 'TEST'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={tabBtnStyle(tab === t)}>{t}</button>
          ))}
        </nav>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={slug} onChange={e => setSlug(e.target.value)} style={inputStyle(220)}>
            {!slugs.length && <option>(no games yet)</option>}
            {slugs.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={createGame} style={btnStyle()}>+ New Game</button>
        </div>
      </header>

      <section style={{ display: 'flex', gap: 12 }}>
        <aside style={{ width: 320, flex: '0 0 auto' }}>
          <div style={cardStyle()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ color: '#9fb0bf', fontSize: 12 }}>Game</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={channel} onChange={e => setChannel(e.target.value)} style={inputStyle(150)}>
                  <option value="published">published</option>
                  <option value="draft">draft</option>
                </select>
                <button onClick={saveAll} style={btnStyle(true)}>💾 Save All</button>
                <button onClick={publishNow} style={btnStyle()}>Publish</button>
              </div>
            </div>
          </div>

          <div style={cardStyle()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong>Missions</strong>
              <button onClick={() => newMission('short_answer')} style={btnStyle()}>+ New</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(suite?.missions || []).map((m) => (
                <div key={m.id} style={listItemStyle(selectedId === m.id)} onClick={() => setSelectedId(m.id)}>
                  <div>
                    <div><strong>{m.title || m.id}</strong></div>
                    <div style={{ color: '#9fb0bf', fontSize: 12 }}>{m.type} — id: {m.id}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={(e) => { e.stopPropagation(); moveMission(m.id, 'up'); }} style={btnStyle()}>↑</button>
                    <button onClick={(e) => { e.stopPropagation(); moveMission(m.id, 'down'); }} style={btnStyle()}>↓</button>
                    <button onClick={(e) => { e.stopPropagation(); deleteMission(m.id); }} style={btnStyle()}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div style={{ flex: '1 1 auto' }}>
          <div style={cardStyle()}>
            {tab === 'MISSIONS' && (
              <MissionEditor mission={selected} updateSelected={updateSelected} />
            )}
            {tab === 'MAP' && (
              <MapTab items={geofenced} />
            )}
            {tab === 'TEST' && (
              <TestTab
                gameOrigin={gameOrigin}
                setGameOrigin={setGameOrigin}
                iframeSrc={iframeSrc}
                mixed={mixed}
              />
            )}
            {tab !== 'MISSIONS' && tab !== 'MAP' && tab !== 'TEST' && (
              <div style={{ color: '#9fb0bf' }}>This tab is a placeholder. Focus on MISSIONS, MAP, and TEST for now.</div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

// --- Subcomponents ---
function MissionEditor({ mission, updateSelected }) {
  if (!mission) return <div style={{ color: '#9fb0bf' }}>Select a mission or click <b>+ New</b>.</div>;
  const content = mission.content || {};
  const styleEnabled = !!content.styleEnabled;
  const style = content.style || {};

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Edit: {mission.title || mission.id}</h2>

      <KV label="Title">
        <input value={mission.title || ''} onChange={e => updateSelected({ title: e.target.value })} style={inputStyle()} />
      </KV>

      <KV label="Type">
        <select value={mission.type || 'short_answer'} onChange={e => updateSelected({ type: e.target.value })} style={inputStyle()}>
          <option value="statement">Statement</option>
          <option value="short_answer">Short Answer</option>
          <option value="multiple_choice">Multiple Choice</option>
          <option value="powerup">Power-up</option>
        </select>
      </KV>

      <KV label="Latitude">
        <input value={mission.lat ?? ''} onChange={e => updateSelected({ lat: parseFloat(e.target.value) || undefined })} placeholder="44.9778" style={inputStyle()} />
      </KV>
      <KV label="Longitude">
        <input value={mission.lng ?? ''} onChange={e => updateSelected({ lng: parseFloat(e.target.value) || undefined })} placeholder="-93.2650" style={inputStyle()} />
      </KV>
      <KV label="Radius (m)">
        <input type="number" min="0" value={mission.radiusMeters ?? ''} onChange={e => updateSelected({ radiusMeters: parseFloat(e.target.value) || undefined })} placeholder="optional" style={inputStyle()} />
      </KV>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <input type="checkbox" checked={styleEnabled} onChange={e => updateSelected({ content: { ...content, styleEnabled: e.target.checked, style: content.style || {} } })} />
        <div>Use custom appearance for this mission</div>
      </div>

      {styleEnabled && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
          <div>
            <div style={{ color: '#9fb0bf', fontSize: 12, marginBottom: 4 }}>Font</div>
            <select
              value={style.fontFamily || ''}
              onChange={e => updateSelected({ content: { ...content, style: { ...style, fontFamily: e.target.value } } })}
              style={inputStyle()}
            >
              <option value="">(inherit)</option>
              {FONT_CHOICES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <div style={{ marginTop: 6, padding: 8, border: '1px dashed #22303c', borderRadius: 6, fontFamily: style.fontFamily || 'inherit' }}>
              The quick brown fox… (sample)
            </div>
          </div>

          <div>
            <div style={{ color: '#9fb0bf', fontSize: 12, marginBottom: 4 }}>Font size</div>
            <input
              type="number" min="10" max="64" step="1"
              value={style.fontSize ?? ''}
              onChange={e => updateSelected({ content: { ...content, style: { ...style, fontSize: Number(e.target.value) || undefined } } })}
              placeholder="inherit"
              style={inputStyle()}
            />
          </div>

          <ColorPicker
            label="Text color"
            value={style.textColor || ''}
            onChange={(val) => updateSelected({ content: { ...content, style: { ...style, textColor: val } } })}
          />
          <ColorPicker
            label="Background color"
            value={style.backgroundColor || ''}
            onChange={(val) => updateSelected({ content: { ...content, style: { ...style, backgroundColor: val } } })}
          />

          <div style={{ gridColumn: '1 / span 2' }}>
            <div style={{ color: '#9fb0bf', fontSize: 12, marginBottom: 4 }}>Background image URL</div>
            <input
              value={style.backgroundImageUrl || ''}
              onChange={e => updateSelected({ content: { ...content, style: { ...style, backgroundImageUrl: e.target.value } } })}
              placeholder="https://…"
              style={inputStyle()}
            />
          </div>

          <div>
            <div style={{ color: '#9fb0bf', fontSize: 12, marginBottom: 4 }}>Background size</div>
            <input
              value={style.backgroundSize || ''}
              onChange={e => updateSelected({ content: { ...content, style: { ...style, backgroundSize: e.target.value } } })}
              placeholder="cover | contain | 100% 100%"
              style={inputStyle()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MapTab({ items }) {
  const center = items.length ? [items[0].lat, items[0].lng] : [44.9778, -93.2650];
  return (
    <div>
      <div style={{ color: '#9fb0bf', marginBottom: 8 }}>Only items with <code>lat</code> and <code>lng</code> are shown.</div>
      <div style={{ height: '65vh', width: '100%', border: '1px solid #22303c', borderRadius: 10, overflow: 'hidden' }}>
        <MapContainer center={center} zoom={13} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
          {items.map(it => (
            <React.Fragment key={it.id}>
              <Marker position={[it.lat, it.lng]}>
                <Popup><strong>{it.title || it.id}</strong></Popup>
              </Marker>
              {Number.isFinite(it.radiusMeters) && it.radiusMeters > 0 && (
                <Circle center={[it.lat, it.lng]} radius={it.radiusMeters} pathOptions={{ color:'#60a5fa', weight:2, opacity:0.6 }} />
              )}
            </React.Fragment>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

function TestTab({ gameOrigin, setGameOrigin, iframeSrc, mixed }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <label style={{ color: '#9fb0bf', fontSize: 12, minWidth: 100 }}>Game origin</label>
        <input value={gameOrigin} onChange={e => { const v = e.target.value.trim(); setGameOrigin(v); try { localStorage.setItem('admin_game_origin', v); } catch {} }} placeholder="https://esxaperide.com" style={inputStyle()} />
        <a href={iframeSrc || '#'} target="_blank" rel="noreferrer" style={btnLinkStyle()}>Open full window</a>
      </div>
      {!gameOrigin && (
        <div style={warningStyle()}>Set <b>Game origin</b> (e.g., <code>https://esxaperide.com</code>) to enable the preview here.</div>
      )}
      {mixed && (
        <div style={warningStyle()}>Your Admin runs over HTTPS but the Game origin is HTTP. Browsers block mixed‑content iframes. Use HTTPS or open in a new tab.</div>
      )}
      {!!iframeSrc && !mixed && (
        <iframe src={iframeSrc} title="Game Preview" style={{ width: '100%', height: '70vh', border: '1px solid #22303c', borderRadius: 8, background: '#000' }} />
      )}
    </div>
  );
}

// --- Small UI helpers ---
function KV({ label, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8, alignItems: 'center', marginBottom: 8 }}>
      <div style={{ color: '#9fb0bf' }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

function ColorPicker({ label, value, onChange }) {
  return (
    <div>
      <div style={{ color: '#9fb0bf', fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {COLOR_CHOICES.map(c => (
          <button
            key={c}
            onClick={() => onChange(c)}
            title={c}
            style={{
              width: 22, height: 22, borderRadius: 4, border: '1px solid #22303c',
              background: c, outline: value === c ? '2px solid #2dd4bf' : 'none', cursor: 'pointer'
            }}
          />
        ))}
      </div>
      <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder="#RRGGBB" style={{ ...inputStyle(), marginTop: 6 }} />
    </div>
  );
}

function cardStyle() {
  return { background: '#0f141b', border: '1px solid #22303c', borderRadius: 10, padding: 12 };
}
function btnStyle(primary) {
  return { padding: '8px 12px', border: '1px solid #22303c', borderRadius: 8, background: primary ? '#0e191f' : '#0b0f15', color: '#e9eef2', cursor: 'pointer' };
}
function btnLinkStyle() {
  return { display: 'inline-block', padding: '8px 12px', border: '1px solid #22303c', borderRadius: 8, background: '#0b0f15', color: '#e9eef2', textDecoration: 'none' };
}
function inputStyle(width) {
  return { width: width || '100%', padding: '6px 8px', border: '1px solid #22303c', borderRadius: 6, background: '#0b0f15', color: '#e9eef2' };
}
function listItemStyle(selected) {
  return { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, border: '1px solid #22303c', borderRadius: 8, background: selected ? '#111a22' : '#0c1219', cursor: 'pointer' };
}
function tabBtnStyle(active) {
  return { padding: '8px 12px', border: '1px solid #22303c', borderRadius: 999, background: active ? '#111a22' : '#0b0f15', color: '#e9eef2', cursor: 'pointer' };
}
function warningStyle() {
  return { padding: 12, border: '1px solid #5b3b00', background: '#251a00', borderRadius: 8, color: '#ffd18a', marginBottom: 12 };
}
