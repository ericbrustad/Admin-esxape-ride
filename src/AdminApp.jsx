// src/AdminApp.jsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// Map components only load on client
const RL = {
  MapContainer: null, TileLayer: null, Marker: null, Popup: null, Circle: null
};
const ReactLeaflet = dynamic(async () => {
  const m = await import('react-leaflet');
  RL.MapContainer = m.MapContainer; RL.TileLayer = m.TileLayer; RL.Marker = m.Marker; RL.Popup = m.Popup; RL.Circle = m.Circle;
  return () => null;
}, { ssr: false });

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

function pretty(obj) { return JSON.stringify(obj, null, 2); }

function arrayMove(arr, from, to) {
  const a = arr.slice();
  if (from < 0 || from >= a.length || to < 0 || to >= a.length) return a;
  const [item] = a.splice(from, 1);
  a.splice(to, 0, item);
  return a;
}
function moveMissionById(missions, id, dir) {
  const idx = missions.findIndex(m => m.id === id);
  if (idx === -1) return missions;
  const to = dir === 'up' ? idx - 1 : idx + 1;
  return arrayMove(missions, idx, to);
}

function getInitialGameOrigin() {
  if (typeof window !== 'undefined') {
    const v = window.localStorage.getItem('admin_game_origin');
    if (v) return v;
  }
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_GAME_ORIGIN) {
    return process.env.NEXT_PUBLIC_GAME_ORIGIN;
  }
  return '';
}
function setPersistedGameOrigin(url) { try { window.localStorage.setItem('admin_game_origin', url || ''); } catch {} }
function isMixedContent(parentUrl, childUrl) {
  try { const p = new URL(parentUrl); const c = new URL(childUrl); return p.protocol === 'https:' && c.protocol === 'http:'; }
  catch { return false; }
}

export default function AdminApp() {
  const [tab, setTab] = useState('MISSIONS'); // MISSIONS | MAP | TEST | SETTINGS | TEXT | POWERUPS
  const [slugs, setSlugs] = useState([]);
  const [slug, setSlug] = useState('');
  const [suite, setSuite] = useState({ id: 'suite', version: 1, missions: [] });
  const [config, setConfig] = useState({ game: { title: 'Untitled' }, theme: { missionDefault: { fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial', fontSize: 18, textColor: '#e9eef2', backgroundColor: '#0b0c10' } } });
  const [selectedId, setSelectedId] = useState('');
  const [channel, setChannel] = useState('published'); // for test/save
  const [gameOrigin, setGameOrigin] = useState(getInitialGameOrigin());
  const selected = suite.missions.find(m => m.id === selectedId) || null;

  // Load list of games
  async function refreshSlugs() {
    const r = await fetch('/api/games'); const j = await r.json().catch(()=>({ slugs:[] }));
    if (j?.slugs) {
      setSlugs(j.slugs);
      if (!slug && j.slugs.length) setSlug(j.slugs[0]);
    }
  }
  useEffect(() => { refreshSlugs(); }, []);

  // Load config/missions for slug+channel
  useEffect(() => {
    (async () => {
      if (!slug) return;
      const r = await fetch(`/api/load?slug=${encodeURIComponent(slug)}&channel=${encodeURIComponent(channel)}`);
      const j = await r.json().catch(()=>null);
      if (j?.ok) {
        if (j.config) setConfig(j.config);
        if (j.missions) setSuite(j.missions);
        if (j.missions?.missions?.length) setSelectedId(j.missions.missions[0].id);
      }
    })();
  }, [slug, channel]);

  // Mission CRUD
  function newMission(type='short_answer') {
    const id = `m${Math.random().toString(36).slice(2,6)}`;
    const draft = { id, type, title: 'New Mission', content: {} };
    setSuite(s => ({ ...s, missions: [...(s.missions||[]), draft] }));
    setSelectedId(id);
    setTab('MISSIONS');
  }
  function deleteMission(id) {
    setSuite(s => ({ ...s, missions: (s.missions||[]).filter(m => m.id !== id) }));
    if (selectedId === id) setSelectedId('');
  }
  function updateSelected(patch) {
    setSuite(s => ({
      ...s,
      missions: (s.missions||[]).map(m => m.id === selectedId ? { ...m, ...patch } : m)
    }));
  }

  async function saveAll() {
    const r = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, channel, config, missions: suite })
    });
    const j = await r.json().catch(()=>null);
    if (!j?.ok) alert('Save failed: ' + (j?.error || 'unknown'));
  }

  async function publishNow() {
    const r = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug })
    });
    const j = await r.json().catch(()=>null);
    if (!j?.ok) alert('Publish failed: ' + (j?.error || 'unknown'));
  }

  async function createGame() {
    const input = window.prompt('Enter new game slug (letters, numbers, hyphens). Leave blank to auto-generate:');
    const body = input ? { slug: input.trim() } : {};
    const r = await fetch('/api/games', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(()=>null);
    if (!j?.ok) { alert('Create failed: ' + (j?.error || 'unknown')); return; }
    setSlugs(j.slugs || []);
    setSlug(j.slug);
  }

  const geofenced = useMemo(() => (suite?.missions||[]).filter(m => Number.isFinite(m?.lat) && Number.isFinite(m?.lng)), [suite]);

  const iframeSrc = useMemo(() => {
    if (!gameOrigin || !slug) return '';
    const base = gameOrigin.replace(/\/+$/,'');
    return `${base}/?slug=${encodeURIComponent(slug)}&channel=${encodeURIComponent(channel)}&preview=1`;
  }, [gameOrigin, slug, channel]);

  const mixed = (typeof window !== 'undefined') && iframeSrc && isMixedContent(window.location.href, iframeSrc);

  return (
    <main style={{ padding: 16 }}>
      <header className="row" style={{ justifyContent:'space-between', marginBottom: 10 }}>
        <div className="tabs">
          {['SETTINGS','MISSIONS','TEXT','POWERUPS','MAP','TEST'].map(t => (
            <button key={t} className={'tab'+(tab===t?' active':'')} onClick={()=>setTab(t)}>{t}</button>
          ))}
        </div>
        <div className="row">
          <select className="input" value={slug} onChange={e=>setSlug(e.target.value)} style={{ width:220 }}>
            {!slugs.length && <option>(no games yet)</option>}
            {slugs.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn" onClick={createGame}>+ New Game</button>
        </div>
      </header>

      <section className="row">
        <aside className="sidebar">
          <div className="card" style={{ marginBottom:12 }}>
            <div className="row" style={{ justifyContent:'space-between' }}>
              <div className="badge">Game</div>
              <div className="row">
                <select className="input" value={channel} onChange={e=>setChannel(e.target.value)} style={{ width:150 }}>
                  <option value="published">published</option>
                  <option value="draft">draft</option>
                </select>
                <button className="btn primary" onClick={saveAll}>💾 Save All</button>
                <button className="btn" onClick={publishNow}>Publish</button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="row" style={{ justifyContent:'space-between', marginBottom:8 }}>
              <strong>Missions</strong>
              <button className="btn" onClick={()=>newMission('short_answer')}>+ New</button>
            </div>
            <div className="list">
              {(suite?.missions||[]).map((m, i) => (
                <div className="list-item" key={m.id} onClick={()=>setSelectedId(m.id)} style={{ cursor:'pointer', background: selectedId===m.id?'#111a22':'#0c1219' }}>
                  <div>
                    <div><strong>{m.title || m.id}</strong></div>
                    <div className="badge">{m.type} — id: {m.id}</div>
                  </div>
                  <div className="row">
                    <button className="btn" onClick={(e)=>{e.stopPropagation(); setSuite(s=>({...s, missions: moveMissionById(s.missions, m.id, 'up')}));}}>↑</button>
                    <button className="btn" onClick={(e)=>{e.stopPropagation(); setSuite(s=>({...s, missions: moveMissionById(s.missions, m.id, 'down')}));}}>↓</button>
                    <button className="btn" onClick={(e)=>{e.stopPropagation(); deleteMission(m.id);}}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="main">
          <div className="card">
            {tab === 'MISSIONS' && (
              <MissionEditor
                mission={selected}
                updateSelected={updateSelected}
              />
            )}

            {tab === 'MAP' && (
              <MapTab items={geofenced} />
            )}

            {tab === 'TEST' && (
              <TestTab
                gameOrigin={gameOrigin}
                setGameOrigin={(v)=>{ setGameOrigin(v); setPersistedGameOrigin(v); }}
                iframeSrc={iframeSrc}
                mixed={mixed}
              />
            )}

            {tab !== 'MISSIONS' && tab !== 'MAP' && tab !== 'TEST' && (
              <div className="hint">This tab is a placeholder in the full build. Focus on MISSIONS, MAP, and TEST for now.</div>
            )}
          </div>
        </div>
      </section>

      {/* ensure dynamic module loads */}
      <ReactLeaflet />
    </main>
  );
}

function MissionEditor({ mission, updateSelected }) {
  if (!mission) return <div className="hint">Select a mission or click <b>+ New</b>.</div>;
  const content = mission.content || {};
  const styleEnabled = !!content.styleEnabled;
  const style = content.style || {};

  return (
    <div>
      <h2 style={{ marginTop:0 }}>Edit: {mission.title || mission.id}</h2>
      <div className="kv"><div>Title</div><input className="input" value={mission.title||''} onChange={e=>updateSelected({ title: e.target.value })} /></div>
      <div className="kv"><div>Type</div>
        <select className="input" value={mission.type||'short_answer'} onChange={e=>updateSelected({ type: e.target.value })}>
          <option value="statement">Statement</option>
          <option value="short_answer">Short Answer</option>
          <option value="multiple_choice">Multiple Choice</option>
          <option value="powerup">Power-up</option>
        </select>
      </div>

      {/* Geofence */}
      <div className="kv"><div>Latitude</div>
        <input className="input" value={mission.lat??''} onChange={e=>updateSelected({ lat: parseFloat(e.target.value)||undefined })} placeholder="e.g., 44.9778" />
      </div>
      <div className="kv"><div>Longitude</div>
        <input className="input" value={mission.lng??''} onChange={e=>updateSelected({ lng: parseFloat(e.target.value)||undefined })} placeholder="-93.2650" />
      </div>
      <div className="kv"><div>Radius (m)</div>
        <input className="input" type="number" min="0" value={mission.radiusMeters??''} onChange={e=>updateSelected({ radiusMeters: parseFloat(e.target.value)||undefined })} placeholder="optional" />
      </div>

      {/* Appearance */}
      <label style={{ display:'flex', alignItems:'center', gap:8, marginTop:12 }}>
        <input type="checkbox" checked={styleEnabled} onChange={e=>updateSelected({ content: { ...content, styleEnabled: e.target.checked, style: content.style||{} } })} />
        Use custom appearance for this mission
      </label>

      {styleEnabled && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:8 }}>
          <div>
            <div className="badge" style={{ marginBottom:4 }}>Font</div>
            <select className="input" value={style.fontFamily || ''} onChange={e=>updateSelected({ content:{ ...content, style:{ ...style, fontFamily: e.target.value } } })}>
              <option value="">(inherit)</option>
              {FONT_CHOICES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          <div>
            <div className="badge" style={{ marginBottom:4 }}>Font size</div>
            <input className="input" type="number" min="10" max="64" step="1" value={style.fontSize ?? ''}
              onChange={e=>updateSelected({ content:{ ...content, style:{ ...style, fontSize: Number(e.target.value)||undefined } } })} placeholder="inherit" />
          </div>

          <div>
            <div className="badge" style={{ marginBottom:4 }}>Text color</div>
            <select className="input" value={style.textColor || ''} onChange={e=>updateSelected({ content:{ ...content, style:{ ...style, textColor: e.target.value } } })}>
              <option value="">(inherit)</option>
              {COLOR_CHOICES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <div className="badge" style={{ marginBottom:4 }}>Background color</div>
            <select className="input" value={style.backgroundColor || ''} onChange={e=>updateSelected({ content:{ ...content, style:{ ...style, backgroundColor: e.target.value } } })}>
              <option value="">(none)</option>
              {COLOR_CHOICES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ gridColumn:'1 / span 2' }}>
            <div className="badge" style={{ marginBottom:4 }}>Background image URL</div>
            <input className="input" value={style.backgroundImageUrl || ''} onChange={e=>updateSelected({ content:{ ...content, style:{ ...style, backgroundImageUrl: e.target.value } } })} placeholder="https://…" />
          </div>

          <div>
            <div className="badge" style={{ marginBottom:4 }}>Background size</div>
            <input className="input" value={style.backgroundSize || ''} onChange={e=>updateSelected({ content:{ ...content, style:{ ...style, backgroundSize: e.target.value } } })} placeholder="cover | contain | 100% 100%" />
          </div>
        </div>
      )}

      <details style={{ marginTop:16 }}>
        <summary className="badge">Raw mission JSON</summary>
        <pre style={{ maxHeight: 220, overflow:'auto', background:'#091019', padding:10, borderRadius:8, border:'1px solid #22303c' }}>{pretty(mission)}</pre>
      </details>
    </div>
  );
}

function MapTab({ items }) {
  const [map, setMap] = useState(null);
  const center = items.length ? [items[0].lat, items[0].lng] : [44.9778, -93.2650];

  useEffect(() => {
    if (!map) return;
    const t = setTimeout(() => { try { map.invalidateSize(); } catch {} }, 0);
    const onResize = () => { try { map.invalidateSize(); } catch {} };
    window.addEventListener('resize', onResize);
    return () => { clearTimeout(t); window.removeEventListener('resize', onResize); };
  }, [map]);

  return (
    <div>
      <div className="hint" style={{ marginBottom:8 }}>Only items with <code>lat</code> and <code>lng</code> are shown.</div>
      <div className="mapShell">
        {RL.MapContainer ? (
          <RL.MapContainer center={center} zoom={13} whenCreated={setMap} style={{ height:'100%', width:'100%' }} scrollWheelZoom>
            <RL.TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
            {items.map(it => (
              <React.Fragment key={it.id}>
                <RL.Marker position={[it.lat, it.lng]}>
                  <RL.Popup><strong>{it.title || it.id}</strong></RL.Popup>
                </RL.Marker>
                {Number.isFinite(it.radiusMeters) && it.radiusMeters > 0 && (
                  <RL.Circle center={[it.lat, it.lng]} radius={it.radiusMeters} pathOptions={{ color:'#60a5fa', weight:2, opacity:0.6 }} />
                )}
              </React.Fragment>
            ))}
          </RL.MapContainer>
        ) : (
          <div className="hint" style={{ padding:12 }}>Loading map…</div>
        )}
      </div>
    </div>
  );
}

function TestTab({ gameOrigin, setGameOrigin, iframeSrc, mixed }) {
  return (
    <div>
      <div className="row" style={{ marginBottom:12 }}>
        <label className="badge" style={{ minWidth:100 }}>Game origin</label>
        <input className="input" value={gameOrigin} onChange={e=>setGameOrigin(e.target.value.trim())} placeholder="https://esxaperide.com" />
        <a className="btn" href={iframeSrc || '#'} target="_blank" rel="noreferrer">Open full window</a>
      </div>

      {!gameOrigin && (
        <div className="card" style={{ borderColor:'#5b3b00', background:'#251a00', color:'#ffd18a', marginBottom:12 }}>
          Set <b>Game origin</b> (e.g., <code>https://esxaperide.com</code>) to enable the preview here.
        </div>
      )}
      {mixed && (
        <div className="card" style={{ borderColor:'#5b3b00', background:'#251a00', color:'#ffd18a', marginBottom:12 }}>
          Your Admin runs over HTTPS but the Game origin is HTTP. Browsers block mixed‑content iframes. Use HTTPS or open in a new tab.
        </div>
      )}
      {!!iframeSrc && !mixed && (
        <iframe src={iframeSrc} title="Game Preview" style={{ width:'100%', height:'70vh', border:'1px solid #22303c', borderRadius:8, background:'#000' }} />
      )}
    </div>
  );
}
