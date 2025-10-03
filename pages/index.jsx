import React, { useEffect, useRef, useState } from 'react';

/* =====================================================================
   0) HELPERS
   ===================================================================== */
async function fetchJsonSafe(url, fallback) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    const ct = r.headers.get('content-type') || '';
    if (r.ok && ct.includes('application/json')) return await r.json();
  } catch {}
  return fallback;
}
async function fetchFirstJson(urls, fallback) {
  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: 'no-store' });
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
      if (url.searchParams.has('dl')) url.searchParams.delete('dl');
      if (!url.searchParams.has('raw')) url.searchParams.set('raw', '1');
      return url.toString();
    }
    return u;
  } catch {
    return u;
  }
}

/* =====================================================================
   1) SCHEMAS
   ===================================================================== */
const TYPE_FIELDS = {
  multiple_choice: [
    { key: 'question', label: 'Question', type: 'text' },
    { key: 'mediaUrl', label: 'Image or Video URL (optional)', type: 'text' },
  ],
  short_answer: [
    { key: 'question', label: 'Question', type: 'text' },
    { key: 'answer', label: 'Correct Answer', type: 'text' },
    { key: 'acceptable', label: 'Also Accept (comma-separated)', type: 'text' },
    { key: 'mediaUrl', label: 'Image or Video URL (optional)', type: 'text' },
  ],
  statement: [
    { key: 'text', label: 'Statement Text', type: 'multiline' },
    { key: 'mediaUrl', label: 'Image or Video URL (optional)', type: 'text' },
  ],
  video: [
    { key: 'videoUrl', label: 'Video URL (https)', type: 'text' },
    { key: 'overlayText', label: 'Overlay Text (optional)', type: 'text' },
  ],
  geofence_image: [
    { key: 'lat', label: 'Latitude', type: 'number' },
    { key: 'lng', label: 'Longitude', type: 'number' },
    { key: 'radiusMeters', label: 'Geofence Radius (m)', type: 'number', min: 5, max: 2000 },
    { key: 'cooldownSeconds', label: 'Cooldown (sec)', type: 'number', min: 5, max: 240 },
    { key: 'imageUrl', label: 'Image URL (https)', type: 'text' },
    { key: 'overlayText', label: 'Caption/Text', type: 'text' },
  ],
  geofence_video: [
    { key: 'lat', label: 'Latitude', type: 'number' },
    { key: 'lng', label: 'Longitude', type: 'number' },
    { key: 'radiusMeters', label: 'Geofence Radius (m)', type: 'number', min: 5, max: 2000 },
    { key: 'cooldownSeconds', label: 'Cooldown (sec)', type: 'number', min: 5, max: 240 },
    { key: 'videoUrl', label: 'Video URL (https)', type: 'text' },
    { key: 'overlayText', label: 'Overlay Text (optional)', type: 'text' },
  ],
  ar_image: [
    { key: 'markerUrl', label: 'AR Marker Image URL (png/jpg)', type: 'text' },
    { key: 'assetUrl', label: 'AR Overlay Image URL (png/jpg)', type: 'text' },
    { key: 'overlayText', label: 'Overlay Text (optional)', type: 'text' },
  ],
  ar_video: [
    { key: 'markerUrl', label: 'AR Marker Image URL (png/jpg)', type: 'text' },
    { key: 'assetUrl', label: 'AR Video URL (mp4)', type: 'text' },
    { key: 'overlayText', label: 'Overlay Text (optional)', type: 'text' },
  ],
};

const TYPE_OPTIONS = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'short_answer', label: 'Question (Short Answer)' },
  { value: 'statement', label: 'Statement' },
  { value: 'video', label: 'Video' },
  { value: 'geofence_image', label: 'Geo Fence Image' },
  { value: 'geofence_video', label: 'Geo Fence Video' },
  { value: 'ar_image', label: 'AR Image' },
  { value: 'ar_video', label: 'AR Video' },
];

const GAME_TYPES = ['Mystery', 'Chase', 'Race', 'Thriller', 'Hunt'];

const POWERUP_TYPES = [
  { value: 'smoke', label: 'Smoke (hide on GPS)' },
  { value: 'clone', label: 'Clone (decoy location)' },
  { value: 'jammer', label: 'Signal Jammer (blackout radius)' },
];

/* =====================================================================
   2) ROOT
   ===================================================================== */
export default function Admin() {
  const [tab, setTab] = useState('missions');

  // games
  const [games, setGames] = useState([]);
  const [activeSlug, setActiveSlug] = useState('');
  const [showNewGame, setShowNewGame] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('Mystery');
  const [newMode, setNewMode] = useState('single');
  const [newDurationMin, setNewDurationMin] = useState(0);   // minutes; 0 = infinite
  const [newAlertMin, setNewAlertMin] = useState(10);        // minutes before end
  const [showRings, setShowRings] = useState(true);
  const [testChannel, setTestChannel] = useState('published');
  const gameBase = (typeof window !== 'undefined'
    ? (window.__GAME_ORIGIN__ || process.env.NEXT_PUBLIC_GAME_ORIGIN)
    : process.env.NEXT_PUBLIC_GAME_ORIGIN) || (config?.gameOrigin) || '';


  // data
  const [suite, setSuite] = useState(null);
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState('');

  // mission edit
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [dirty, setDirty] = useState(false);

  // text rules
  const [smsRule, setSmsRule] = useState({ missionId: '', phoneSlot: 1, message: '', delaySec: 30 });

  // powerups (new)
  const [pu, setPu] = useState({
    title: '',
    type: 'smoke',
    pickupRadius: 15,
    effectSeconds: 60,
    lat: 44.9778,
    lng: -93.265,
  });

  // load games
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/games');
        const j = await r.json();
        if (j.ok) setGames(j.games || []);
      } catch {}
    })();
  }, []);

  // load suite/config per slug
  useEffect(() => {
    (async () => {
      try {
        setStatus('Loading…');

        const missionUrls = activeSlug
          ? [`/games/${encodeURIComponent(activeSlug)}/missions.json`, `/missions.json`]
          : [`/missions.json`];

        const configUrl = activeSlug ? `/api/config?slug=${encodeURIComponent(activeSlug)}` : `/api/config`;

        const m = await fetchFirstJson(missionUrls, { version: '0.0.0', missions: [] });
        const c = await fetchJsonSafe(configUrl, defaultConfig());

        const normalized = {
          ...m,
          missions: (m.missions || []).map((x) =>
            x.type === 'quiz'
              ? {
                  ...x,
                  type: 'multiple_choice',
                  content: {
                    question: x.content?.question || '',
                    choices: x.content?.choices || [],
                    answer: x.content?.answer || '',
                  },
                }
              : x
          ),
        };

        setSuite(normalized);
        setConfig({
          ...defaultConfig(),
          ...c,
          powerups: Array.isArray(c.powerups) ? c.powerups : [],
          // make sure timer exists even for old configs
          timer: { ...(defaultConfig().timer), ...(c.timer || {}) },
        });
        setSelected(null);
        setEditing(null);
        setDirty(false);
        setStatus('');
      } catch (e) {
        setStatus('Load failed: ' + (e?.message || e));
      }
    })();
  }, [activeSlug]);

  function defaultConfig() {
    return {
      splash: { enabled: true, mode: 'single' },
      game: { title: 'Untitled Game', type: 'Mystery' },
      forms: { players: 1 },
      timer: { durationMinutes: 0, alertMinutes: 10 }, // <— NEW
      textRules: [],
      powerups: [],
    };
  }

  function defaultContentForType(t) {
    const baseGeo = { geofenceEnabled: false, lat: '', lng: '', radiusMeters: 25, cooldownSeconds: 30 };
    switch (t) {
      case 'multiple_choice':
        return { question: '', choices: [], correctIndex: undefined, mediaUrl: '', styleEnabled: false, ...baseGeo };
      case 'short_answer':
        return { question: '', answer: '', acceptable: '', mediaUrl: '', styleEnabled: false, ...baseGeo };
      case 'statement':
        return { text: '', mediaUrl: '', styleEnabled: false, ...baseGeo };
      case 'video':
        return { videoUrl: '', overlayText: '', styleEnabled: false, ...baseGeo };
      case 'geofence_image':
        return { lat: '', lng: '', radiusMeters: 25, cooldownSeconds: 30, imageUrl: '', overlayText: '' };
      case 'geofence_video':
        return { lat: '', lng: '', radiusMeters: 25, cooldownSeconds: 30, videoUrl: '', overlayText: '' };
      case 'ar_image':
        return { markerUrl: '', assetUrl: '', overlayText: '', ...baseGeo };
      case 'ar_video':
        return { markerUrl: '', assetUrl: '', overlayText: '', ...baseGeo };
      default:
        return { ...baseGeo };
    }
  }

  async function saveAll() {
    if (!suite || !config) return;
    setStatus('Saving…');
    const qs = activeSlug ? `?slug=${encodeURIComponent(activeSlug)}` : '';
    const [a, b] = await Promise.all([
      fetch('/api/save' + qs, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missions: suite }),
      }),
      fetch('/api/save-config' + qs, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      }),
    ]);
    const ok = a.ok && b.ok;
    if (!ok) {
      setStatus('❌ Save failed:\n' + (await a.text()) + '\n' + (await b.text()));
    } else {
      setStatus('✅ Saved (files committed)');
    }
  }

  async function handlePublish() {
    try {
      setStatus('Publishing…');
      const res = await fetch(`/api/game/${activeSlug || ''}?channel=published`, {
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

  // missions helpers
  function suggestId() {
    const base = 'm';
    let i = 1;
    const ids = new Set((suite?.missions || []).map((m) => m.id));
    while (ids.has(String(base + String(i).padStart(2, '0')))) i++;
    return base + String(i).padStart(2, '0');
  }
  function startNew() {
    const draft = {
      id: suggestId(),
      title: 'New Mission',
      type: 'multiple_choice',
      rewards: { points: 25 },
      content: defaultContentForType('multiple_choice'),
    };
    setEditing(draft);
    setSelected(null);
    setDirty(true);
  }

function startNewRole(role) {
  const t = 'statement';
  const draft = {
    id: suggestId(),
    title: role === 'intro' ? 'Intro' : 'Finale',
    type: t,
    role, // 'intro' | 'final'
    rewards: { points: 0 },
    content: { ...defaultContentForType(t), text: role === 'intro' ? 'Welcome to the game!' : 'Congratulations!', styleEnabled: false }
  };
  setEditing(draft);
}

  function editExisting(m) {
    setEditing(JSON.parse(JSON.stringify(m)));
    setSelected(m.id);
    setDirty(false);
  }
  function cancelEdit() {
    setEditing(null);
    setSelected(null);
    setDirty(false);
  }
  function bumpVersion(v) {
    const p = String(v || '0.0.0')
      .split('.')
      .map((n) => parseInt(n || '0', 10));
    while (p.length < 3) p.push(0);
    p[2] += 1;
    return p.join('.');
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
    const i = missions.findIndex((m) => m.id === editing.id);
    if (i >= 0) missions[i] = editing;
    else missions.push(editing);
    setSuite({ ...suite, missions, version: bumpVersion(suite.version || '0.0.0') });
    setSelected(editing.id);
    setEditing(null);
    setDirty(false);
    setStatus('✅ List updated (remember Save All)');
  }
  function removeMission(id) {
    if (!suite) return;
    setSuite({ ...suite, missions: (suite.missions || []).filter((m) => m.id !== id) });
    if (selected === id) {
      setSelected(null);
      setEditing(null);
    }
  }

  // text rules
  function addSmsRule() {
    if (!smsRule.missionId || !smsRule.message) return setStatus('❌ Pick mission and message');
    const maxPlayers = config?.forms?.players || 1;
    if (smsRule.phoneSlot < 1 || smsRule.phoneSlot > Math.max(1, maxPlayers)) return setStatus('❌ Phone slot out of range');
    const rules = [...(config?.textRules || []), { ...smsRule, delaySec: Number(smsRule.delaySec || 0) }];
    setConfig({ ...config, textRules: rules });
    setSmsRule({ missionId: '', phoneSlot: 1, message: '', delaySec: 30 });
    setStatus('✅ SMS rule added (remember Save All)');
  }
  function removeSmsRule(idx) {
    const rules = [...(config?.textRules || [])];
    rules.splice(idx, 1);
    setConfig({ ...config, textRules: rules });
  }

  if (!suite || !config) return <main style={S.wrap}><div style={S.card}>Loading…</div></main>;

  /* =====================================================================
     3) UI
     ===================================================================== */
  return (
    <div style={S.body}>
      <header style={S.header}>
        <div style={S.wrap}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {['settings', 'missions', 'text', 'powerups', 'map', 'test'].map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }}>
                {t.toUpperCase()}
              </button>
            ))}

            {/* Game selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
              <label style={{ color: '#9fb0bf', fontSize: 12 }}>Game:</label>
              <select value={activeSlug} onChange={(e) => setActiveSlug(e.target.value)} style={{ ...S.input, width: 280 }}>
                <option value="">(legacy root)</option>
                {games.map((g) => (
                  <option key={g.slug} value={g.slug}>
                    {g.title} — {g.slug} ({g.mode || 'single'})
                  </option>
                ))}
              </select>
              <button style={S.button} onClick={() => setShowNewGame(true)}>
                + New Game
              </button>
            </div>

            {/* Always show New Mission */}
            <button onClick={startNew} style={S.button}>
              + New Mission
            </button>

            <button onClick={() => startNewRole('intro')} style={{ ...S.button, background:'#0f1418' }}>
              + Intro Mission
            </button>
            <button onClick={() => startNewRole('final')} style={{ ...S.button, background:'#0f1418' }}>
              + Final Mission
            </button>

            {/* Save + quick links */}
            <button onClick={saveAll} style={{ ...S.button }}>💾 Save All</button>
            <button onClick={handlePublish} style={{ ...S.button, background:'#103217', border:'1px solid #1d5c2a' }}>Publish</button>
            <a
              href={activeSlug ? `/games/${encodeURIComponent(activeSlug)}/missions.json` : '/missions.json'}
              target="_blank"
              rel="noreferrer"
              style={{ ...S.button }}
            >
              View missions.json
            </a>
            <a
              href={activeSlug ? `/api/config?slug=${encodeURIComponent(activeSlug)}` : '/config.json'}
              target="_blank"
              rel="noreferrer"
              style={{ ...S.button }}
            >
              View config.json
            </a>
          </div>
          <div style={{ color: '#9fb0bf', marginTop: 6, whiteSpace: 'pre-wrap' }}>{status}</div>
        </div>
      </header>

      {/* MISSIONS */}
      {tab === 'missions' && (
        <main style={S.wrapGrid}>
          <aside style={S.sidebar}>
            <input
              placeholder="Search…"
              onChange={(e) => {
                const q = e.target.value.toLowerCase();
                document.querySelectorAll('[data-m-title]').forEach((it) => {
                  const t = (it.getAttribute('data-m-title') || '').toLowerCase();
                  it.style.display = t.includes(q) ? '' : 'none';
                });
              }}
              style={S.search}
            />
            <div>
              {(suite.missions || []).map((m) => (
                <div key={m.id} data-m-title={(m.title || '') + ' ' + m.id + ' ' + m.type} style={S.missionItem}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div onClick={() => editExisting(m)} style={{ cursor: 'pointer' }}>
                      <div style={{ fontWeight: 600 }}>{m.title || m.id}</div>
                      <div style={{ color: '#9fb0bf', fontSize: 12 }}>
                        {m.type} — id: {m.id}
                      </div>
                    </div>
                    <button style={{ ...S.button, padding: '6px 10px' }} onClick={() => removeMission(m.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <section style={S.editor}>
            {!editing ? (
              <div style={S.card}>
                <p style={{ marginTop: 0, color: '#9fb0bf' }}>
                  Select a mission or click <em>New Mission</em>.
                </p>
                <button style={S.button} onClick={startNew}>
                  + New Mission
                </button>
                <p style={{ color: '#9fb0bf' }}>
                  Version: <code>{suite.version || '0.0.0'}</code> • Total: <code>{suite.missions?.length || 0}</code>
                </p>
              </div>
            ) : (
              <div style={S.card}>
                <Field label="ID">
                  <input style={S.input} value={editing.id} onChange={(e) => { setEditing({ ...editing, id: e.target.value }); setDirty(true); }} />
                </Field>
                <Field label="Title">
                  <input style={S.input} value={editing.title} onChange={(e) => { setEditing({ ...editing, title: e.target.value }); setDirty(true); }} />
                </Field>
                <Field label="Type">
                  <select
                    style={S.input}
                    value={editing.type}
                    onChange={(e) => {
                      const t = e.target.value;
                      setEditing({ ...editing, type: t, content: defaultContentForType(t) });
                      setDirty(true);
                    }}
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <hr style={S.hr} />

                {/* MC custom editor */}
                {editing.type === 'multiple_choice' && (
                  <div style={{ marginBottom: 12 }}>
                    <MultipleChoiceEditor
                      value={Array.isArray(editing.content?.choices) ? editing.content.choices : []}
                      correctIndex={editing.content?.correctIndex}
                      onChange={({ choices, correctIndex }) => {
                        setEditing({ ...editing, content: { ...editing.content, choices, correctIndex } });
                        setDirty(true);
                      }}
                    />
                  </div>
                )}

                {/* geofence types always map */}
                {(editing.type === 'geofence_image' || editing.type === 'geofence_video') && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>Pick location & radius</div>
                    <MapPicker
                      lat={editing.content?.lat}
                      lng={editing.content?.lng}
                      radius={editing.content?.radiusMeters ?? 25}
                      onChange={(lat, lng, rad) => {
                        setEditing({ ...editing, content: { ...editing.content, lat, lng, radiusMeters: rad } });
                        setDirty(true);
                      }}
                    />
                  </div>
                )}

                {/* AR types geofence toggle + map */}
                {(editing.type === 'ar_image' || editing.type === 'ar_video') && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <input
                        type="checkbox"
                        checked={!!editing.content?.geofenceEnabled}
                        onChange={(e) => {
                          const on = e.target.checked;
                          const next = { ...editing.content, geofenceEnabled: on };
                          if (on && (!next.lat || !next.lng)) { next.lat = 44.9778; next.lng = -93.265; }
                          setEditing({ ...editing, content: next });
                          setDirty(true);
                        }}
                      />
                      Enable geofence for this AR mission
                    </label>
                    {editing.content?.geofenceEnabled && (
                      <>
                        <MapPicker
                          lat={editing.content?.lat}
                          lng={editing.content?.lng}
                          radius={editing.content?.radiusMeters ?? 25}
                          onChange={(lat, lng, rad) => {
                            setEditing({ ...editing, content: { ...editing.content, lat, lng, radiusMeters: rad } });
                            setDirty(true);
                          }}
                        />
                        <Field label="Cooldown (sec)">
                          <input
                            type="number"
                            min={0}
                            max={3600}
                            style={S.input}
                            value={editing.content?.cooldownSeconds ?? 30}
                            onChange={(e) => {
                              const v = Number(e.target.value || 0);
                              setEditing({ ...editing, content: { ...editing.content, cooldownSeconds: v } });
                              setDirty(true);
                            }}
                          />
                        </Field>
                      </>
                    )}
                  </div>
                )}

                {/* universal geofence toggle for MC / Short / Statement / Video */}
                {(editing.type === 'multiple_choice' || editing.type === 'short_answer' || editing.type === 'statement' || editing.type === 'video') && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <input
                        type="checkbox"
                        checked={!!editing.content?.geofenceEnabled}
                        onChange={(e) => {
                          const on = e.target.checked;
                          const next = { ...editing.content, geofenceEnabled: on };
                          if (on && (!next.lat || !next.lng)) { next.lat = 44.9778; next.lng = -93.265; }
                          setEditing({ ...editing, content: next });
                          setDirty(true);
                        }}
                      />
                      Enable geofence for this mission
                    </label>
                    {editing.content?.geofenceEnabled && (
                      <>
                        <MapPicker
                          lat={editing.content?.lat}
                          lng={editing.content?.lng}
                          radius={editing.content?.radiusMeters ?? 25}
                          onChange={(lat, lng, rad) => {
                            setEditing({ ...editing, content: { ...editing.content, lat, lng, radiusMeters: rad } });
                            setDirty(true);
                          }}
                        />
                        <Field label="Cooldown (sec)">
                          <input
                            type="number"
                            min={0}
                            max={3600}
                            style={S.input}
                            value={editing.content?.cooldownSeconds ?? 30}
                            onChange={(e) => {
                              const v = Number(e.target.value || 0);
                              setEditing({ ...editing, content: { ...editing.content, cooldownSeconds: v } });
                              setDirty(true);
                            }}
                          />
                        </Field>
                      </>
                    )}
                  </div>
                )}

                {/* generic field renderer + media previews */}
                {(TYPE_FIELDS[editing.type] || []).map((f) => (
                  <Field key={f.key} label={f.label}>
                    {f.type === 'text' && (
                      <>
                        <input
                          style={S.input}
                          value={editing.content?.[f.key] || ''}
                          onChange={(e) => {
                            setEditing({ ...editing, content: { ...editing.content, [f.key]: e.target.value } });
                            setDirty(true);
                          }}
                        />
                        {['mediaUrl', 'imageUrl', 'videoUrl', 'assetUrl', 'markerUrl'].includes(f.key) && (
                          <MediaPreview url={editing.content?.[f.key]} kind={f.key} />
                        )}
                      </>
                    )}
                    {f.type === 'number' && (
                      <input
                        type="number"
                        min={f.min}
                        max={f.max}
                        style={S.input}
                        value={editing.content?.[f.key] ?? ''}
                        onChange={(e) => {
                          const v = e.target.value === '' ? '' : Number(e.target.value);
                          setEditing({ ...editing, content: { ...editing.content, [f.key]: v } });
                          setDirty(true);
                        }}
                      />
                    )}
                    {f.type === 'multiline' && (
                      <textarea
                        style={{ ...S.input, height: 120, fontFamily: 'ui-monospace, Menlo' }}
                        value={editing.content?.[f.key] || ''}
                        onChange={(e) => {
                          setEditing({ ...editing, content: { ...editing.content, [f.key]: e.target.value } });
                          setDirty(true);
                        }}
                      />
                    )}
                  </Field>
                ))}

                <Field label="Points (Reward)">
                  <input
                    type="number"
                    style={S.input}
                    value={editing.rewards?.points ?? 0}
                    onChange={(e) => {
                      const v = e.target.value === '' ? 0 : Number(e.target.value);
                      setEditing({ ...editing, rewards: { ...(editing.rewards || {}), points: v } });
                      setDirty(true);
                    }}
                  />
                </Field>

{/* Appearance (per-mission) */}
<div style={{ border:'1px solid #1f262d', borderRadius: 10, padding: 12, marginBottom: 12 }}>
  <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>Appearance (optional)</div>
  <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom: 8 }}>
    <input type="checkbox"
      checked={!!editing.content?.styleEnabled}
      onChange={(e) => {
        const on = e.target.checked;
        const base = editing.content?.style || {};
        setEditing({ ...editing, content: { ...editing.content, styleEnabled: on, style: base } });
        setDirty(true);
      }}
    />
    Use custom appearance for this mission
  </label>
  {editing.content?.styleEnabled && (
    <div style={{ display:'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
      <Field label="Font Family">
        <input
          style={S.input}
          placeholder="system-ui, Arial, sans-serif"
          value={editing.content?.style?.fontFamily || ''}
          onChange={(e) => {
            setEditing({ ...editing, content: { ...editing.content, style: { ...(editing.content?.style||{}), fontFamily: e.target.value } } });
            setDirty(true);
          }}
        />
      </Field>
      <Field label="Font Size (px)">
        <input
          type="number"
          style={S.input}
          value={Number(editing.content?.style?.fontSize ?? 18)}
          onChange={(e) => {
            const v = e.target.value === '' ? 0 : Number(e.target.value);
            setEditing({ ...editing, content: { ...editing.content, style: { ...(editing.content?.style||{}), fontSize: v } } });
            setDirty(true);
          }}
        />
      </Field>
      <Field label="Text Color (#hex)">
        <input
          style={S.input}
          placeholder="#ffffff"
          value={editing.content?.style?.textColor || ''}
          onChange={(e) => {
            setEditing({ ...editing, content: { ...editing.content, style: { ...(editing.content?.style||{}), textColor: e.target.value } } });
            setDirty(true);
          }}
        />
      </Field>
      <Field label="Background Color (#hex)">
        <input
          style={S.input}
          placeholder="#000000"
          value={editing.content?.style?.backgroundColor || ''}
          onChange={(e) => {
            setEditing({ ...editing, content: { ...editing.content, style: { ...(editing.content?.style||{}), backgroundColor: e.target.value } } });
            setDirty(true);
          }}
        />
      </Field>
      <Field label="Background Image URL">
        <input
          style={S.input}
          placeholder="https://…"
          value={editing.content?.style?.backgroundImageUrl || ''}
          onChange={(e) => {
            setEditing({ ...editing, content: { ...editing.content, style: { ...(editing.content?.style||{}), backgroundImageUrl: e.target.value } } });
            setDirty(true);
          }}
        />
      </Field>
      <Field label="Background Size">
        <select
          style={S.input}
          value={editing.content?.style?.backgroundSize || 'cover'}
          onChange={(e) => {
            setEditing({ ...editing, content: { ...editing.content, style: { ...(editing.content?.style||{}), backgroundSize: e.target.value } } });
            setDirty(true);
          }}
        >
          <option value="cover">cover</option>
          <option value="contain">contain</option>
          <option value="auto">auto</option>
        </select>
      </Field>
    </div>
  )}
</div>


                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button style={S.button} onClick={saveToList}>Add/Update in List</button>
                  <button style={S.button} onClick={cancelEdit}>Cancel</button>
                </div>
                {dirty && <div style={{ marginTop: 6, color: '#ffd166' }}>Unsaved changes…</div>}
              </div>
            )}
          </section>
        </main>
      )}

      {/* SETTINGS (includes SECURITY moved here) */}
      {tab === 'settings' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <h3 style={{ marginTop: 0 }}>Game Settings</h3>
            <Field label="Game Title">
              <input
                style={S.input}
                value={config.game.title}
                onChange={(e) => setConfig({ ...config, game: { ...config.game, title: e.target.value } })}
              />
            </Field>
            <Field label="Game Type">
              <select
                style={S.input}
                value={config.game.type}
                onChange={(e) => setConfig({ ...config, game: { ...config.game, type: e.target.value } })}
              >
                {GAME_TYPES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </Field>
            <Field label="Stripe Splash Page">
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={config.splash.enabled}
                  onChange={(e) => setConfig({ ...config, splash: { ...config.splash, enabled: e.target.checked } })}
                />
                Enable Splash (game code & Stripe)
              </label>
            </Field>
            <Field label="Mode (affects how many players to collect on splash)">
              <select
                style={S.input}
                value={config.splash.mode}
                onChange={(e) => {
                  const mode = e.target.value;
                  const players = mode === 'head2head' ? 2 : mode === 'multi' ? 4 : 1;
                  setConfig({ ...config, splash: { ...config.splash, mode }, forms: { ...config.forms, players } });
                }}
              >
                <option value="single">Single Player</option>
                <option value="head2head">Head to Head (2)</option>
                <option value="multi">Multiple (4)</option>
              </select>
            </Field>

            {/* NEW — Timer settings */}
            <hr style={S.hr} />
            <h4>Game Timer</h4>
            <Field label="Duration (minutes — 0 = infinite; count UP)">
              <input
                type="number"
                min={0}
                max={24 * 60}
                style={S.input}
                value={config.timer?.durationMinutes ?? 0}
                onChange={(e) => {
                  const v = Math.max(0, Number(e.target.value || 0));
                  setConfig({ ...config, timer: { ...(config.timer || {}), durationMinutes: v } });
                }}
              />
            </Field>
            <Field label="Alert before end (minutes — chime + warning)">
              <input
                type="number"
                min={1}
                max={120}
                style={S.input}
                value={config.timer?.alertMinutes ?? 10}
                onChange={(e) => {
                  const v = Math.max(1, Number(e.target.value || 1));
                  setConfig({ ...config, timer: { ...(config.timer || {}), alertMinutes: v } });
                }}
              />
            </Field>
            <div style={{ color: '#9fb0bf' }}>
              The game client should show the clock at the top-right above the objective.
              If duration is 0 it counts up; otherwise it counts down, plays an alarm when{' '}
              {config.timer?.alertMinutes ?? 10} minutes remain, and shows <b>“TIME IS UP! GAME OVER. TRY AGAIN”</b> at 0.
            </div>
          </div>

          {/* Security moved here */}
          <div style={{ ...S.card, marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Security</h3>
            <p style={{ color: '#9fb0bf' }}>Change the Basic Auth login used for this admin. Requires current password.</p>
            <ChangeAuth />
            <hr style={S.hr} />
            <h4>Twilio Credentials</h4>
            <p style={{ color: '#ffd166' }}>
              Store <b>Twilio</b> and <b>Vercel</b> credentials only as environment variables. Never in code.
            </p>
            <ul>
              <li><code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code> (or API Key SID/SECRET)</li>
              <li><code>TWILIO_FROM</code> (phone or Messaging Service SID)</li>
            </ul>
          </div>
        </main>
      )}

      {/* TEXT */}
      {tab === 'text' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <h3 style={{ marginTop: 0 }}>Text Message Rules</h3>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
              <Field label="Mission (geofence)">
                <select style={S.input} value={smsRule.missionId} onChange={(e) => setSmsRule({ ...smsRule, missionId: e.target.value })}>
                  <option value="">— choose —</option>
                  {(suite.missions || []).map((m) => (
                    <option key={m.id} value={m.id}>{m.id} — {m.title}</option>
                  ))}
                </select>
              </Field>
              <Field label="Phone slot">
                <select style={S.input} value={smsRule.phoneSlot} onChange={(e) => setSmsRule({ ...smsRule, phoneSlot: Number(e.target.value) })}>
                  {[1,2,3,4].map((n) => <option key={n} value={n}>{'Player '+n}</option>)}
                </select>
              </Field>
              <Field label="Delay (sec)">
                <input type="number" min={0} max={3600} style={S.input} value={smsRule.delaySec} onChange={(e) => setSmsRule({ ...smsRule, delaySec: e.target.value })}/>
              </Field>
              <Field label="Message">
                <input style={S.input} value={smsRule.message} onChange={(e) => setSmsRule({ ...smsRule, message: e.target.value })}/>
              </Field>
            </div>
            <div style={{ marginTop: 12 }}><button style={S.button} onClick={addSmsRule}>+ Add Rule</button></div>
            <hr style={S.hr}/>
            <ul style={{ paddingLeft: 18 }}>
              {(config.textRules || []).map((r, i) => (
                <li key={i} style={{ marginBottom: 8 }}>
                  <code>{r.missionId}</code> → Player {r.phoneSlot} • delay {r.delaySec}s • “{r.message}”
                  <button style={{ ...S.button, marginLeft: 8, padding: '6px 10px' }} onClick={() => removeSmsRule(i)}>Remove</button>
                </li>
              ))}
            </ul>
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer' }}>Send a quick test SMS now</summary>
              <TestSMS />
            </details>
          </div>
        </main>
      )}

      {/* POWERUPS */}
      {tab === 'powerups' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <h3 style={{ marginTop: 0 }}>Power-Ups</h3>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
              <Field label="Title">
                <input style={S.input} value={pu.title} onChange={(e) => setPu({ ...pu, title: e.target.value })} />
              </Field>
              <Field label="Type">
                <select style={S.input} value={pu.type} onChange={(e) => setPu({ ...pu, type: e.target.value })}>
                  {POWERUP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Pickup radius (m)">
                <input type="number" min={1} max={2000} style={S.input} value={pu.pickupRadius} onChange={(e) => setPu({ ...pu, pickupRadius: Number(e.target.value||0) })}/>
              </Field>
              <Field label="Effect duration (sec)">
                <input type="number" min={5} max={3600} style={S.input} value={pu.effectSeconds} onChange={(e) => setPu({ ...pu, effectSeconds: Number(e.target.value||0) })}/>
              </Field>
            </div>

            <Field label="Pickup location">
              <div style={{ marginBottom: 8 }}>
                <MapPicker
                  lat={pu.lat}
                  lng={pu.lng}
                  radius={pu.pickupRadius}
                  onChange={(lat, lng, rad) => setPu({ ...pu, lat, lng, pickupRadius: rad })}
                />
              </div>
            </Field>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={S.button}
                onClick={() => {
                  const item = { ...pu, id: 'p' + String((config.powerups?.length || 0) + 1).padStart(2, '0') };
                  const list = Array.isArray(config.powerups) ? [...config.powerups, item] : [item];
                  setConfig({ ...config, powerups: list });
                  setStatus('✅ Power-up added (remember Save All)');
                }}
              >
                + Add Power-Up
              </button>
            </div>

            <hr style={S.hr} />
            <h4>Placed Power-Ups</h4>
            {(config.powerups || []).length === 0 && <div style={{ color: '#9fb0bf' }}>No power-ups yet.</div>}
            <ul style={{ paddingLeft: 18 }}>
              {(config.powerups || []).map((x, i) => (
                <li key={i} style={{ marginBottom: 8 }}>
                  <code>{x.id}</code> — {x.title||'(untitled)'} • {x.type} • radius {x.pickupRadius}m • effect {x.effectSeconds}s • lat {x.lat}, lng {x.lng}
                  <button
                    style={{ ...S.button, marginLeft: 8, padding: '6px 10px' }}
                    onClick={() => {
                      const next = [...(config.powerups || [])];
                      next.splice(i, 1);
                      setConfig({ ...config, powerups: next });
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
       
      {/* MAP */}
      {tab === 'map' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Game Map</h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={showRings} onChange={(e)=>setShowRings(e.target.checked)} />
                Show radius rings (admin only)
              </label>
            </div>
            <MapOverview missions={(suite?.missions)||[]} powerups={(config?.powerups)||[]} showRings={showRings} />
            <div style={{ color: '#9fb0bf', marginTop: 8 }}>Shows all geofenced missions and power-ups for the selected game.</div>
          </div>
        </main>
      )}

      {/* TEST */}
      {tab === 'test' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Play Test</h3>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <label>Channel:&nbsp;
                  <select value={testChannel} onChange={(e)=>setTestChannel(e.target.value)} style={S.input}>
                    <option value="draft">draft</option>
                    <option value="published">published</option>
                  </select>
                </label>
                <a href={(gameBase? `${gameBase}/?slug=${activeSlug || ''}&channel=${testChannel}` : '#')}
                   target="_blank" rel="noreferrer" style={{ ...S.button, textDecoration:'none' }}>Open full window</a>
              </div>
            </div>
            {!gameBase && <div style={{ color:'#9fb0bf', marginBottom:8 }}>Set NEXT_PUBLIC_GAME_ORIGIN (or config.gameOrigin) to enable embedded preview.</div>}
            {gameBase && (
              <iframe
                src={`${gameBase}/?slug=${activeSlug || ''}&channel=${testChannel}&preview=1`}
                style={{ width:'100%', height: '70vh', border:'1px solid #22303c', borderRadius: 12 }}
              />
            )}
          </div>
        </main>
      )}
     </ul>
          </div>
        </main>
      )}

      {/* New Game modal */}
      {showNewGame && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 1000 }}>
          <div style={{ ...S.card, width: 420 }}>
            <h3 style={{ marginTop: 0 }}>Create New Game</h3>
            <Field label="Game Title"><input style={S.input} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} /></Field>
            <Field label="Game Type">
              <select style={S.input} value={newType} onChange={(e) => setNewType(e.target.value)}>
                {GAME_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Mode">
              <select style={S.input} value={newMode} onChange={(e) => setNewMode(e.target.value)}>
                <option value="single">Single Player</option>
                <option value="head2head">Head to Head (2)</option>
                <option value="multi">Multiple (4)</option>
              </select>
            </Field>

            {/* NEW — Timer defaults for a fresh game */}
            <Field label="Duration (minutes — 0 = infinite; count UP)">
              <input type="number" min={0} max={24*60} style={S.input} value={newDurationMin} onChange={(e)=>setNewDurationMin(Math.max(0, Number(e.target.value||0)))} />
            </Field>
            <Field label="Alert before end (minutes)">
              <input type="number" min={1} max={120} style={S.input} value={newAlertMin} onChange={(e)=>setNewAlertMin(Math.max(1, Number(e.target.value||1)))} />
            </Field>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button style={S.button} onClick={() => setShowNewGame(false)}>Cancel</button>
              <button
                style={S.button}
                onClick={async () => {
                  if (!newTitle.trim()) return;
                  const r = await fetch('/api/games', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      title: newTitle.trim(),
                      type: newType,
                      mode: newMode,
                      timer: { durationMinutes: newDurationMin, alertMinutes: newAlertMin }, // server may ignore; admin will still have defaults via merge
                    }),
                  });
                  const j = await r.json();
                  if (!j.ok) { setStatus('❌ ' + (j.error || 'create failed')); return; }
                  const rr = await fetch('/api/games'); const jj = await rr.json();
                  if (jj.ok) setGames(jj.games || []);
                  setActiveSlug(j.slug);
                  setNewTitle('');
                  setShowNewGame(false);
                }}
              >Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   4) SMALL COMPONENTS
   ===================================================================== */
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function MultipleChoiceEditor({ value, correctIndex, onChange }) {
  const [local, setLocal] = useState(Array.isArray(value) ? value.slice(0, 5) : []);
  const [correct, setCorrect] = useState(Number.isInteger(correctIndex) ? correctIndex : undefined);

  useEffect(() => { setLocal(Array.isArray(value) ? value.slice(0, 5) : []); }, [value]);
  useEffect(() => { setCorrect(Number.isInteger(correctIndex) ? correctIndex : undefined); }, [correctIndex]);

  function sync(nextChoices, nextCorrect) {
    const trimmed = nextChoices.map((s) => (s || '').trim()).filter(Boolean).slice(0, 5);
    const ci = Number.isInteger(nextCorrect) && nextCorrect < trimmed.length ? nextCorrect : undefined;
    onChange({ choices: trimmed, correctIndex: ci });
  }

  return (
    <div style={{ border: '1px solid #2a323b', borderRadius: 10, padding: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Choices (A–E)</div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '24px 1fr', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <input type="radio" name="mcq-correct" checked={correct === i} onChange={() => { setCorrect(i); sync(local, i); }} title="Mark as correct" />
          <input
            placeholder={`Choice ${String.fromCharCode(65 + i)}`}
            style={S.input}
            value={local[i] || ''}
            onChange={(e) => { const next = [...local]; next[i] = e.target.value; setLocal(next); sync(next, correct); }}
          />
        </div>
      ))}
      <div style={{ color: '#9fb0bf', fontSize: 12 }}>Leave blanks for unused options. Exactly one radio can be marked correct.</div>
    </div>
  );
}

function MediaPreview({ url, kind }) {
  if (!url) return null;
  const u = toDirectMediaURL(String(url).trim());
  const lower = u.toLowerCase();
  const isVideo = /\.(mp4|webm|mov)(\?|#|$)/.test(lower);
  const isImage = /\.(png|jpg|jpeg|gif|webp)(\?|#|$)/.test(lower);

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ color: '#9fb0bf', fontSize: 12, marginBottom: 6 }}>Preview ({kind})</div>
      {isVideo ? (
        <video src={u} controls style={{ width: '100%', maxHeight: 260, borderRadius: 10, border: '1px solid #2a323b' }} />
      ) : isImage ? (
        <img src={u} alt="preview" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 10, border: '1px solid #2a323b' }} />
      ) : (
        <a href={u} target="_blank" rel="noreferrer" style={{ color: '#9fb0bf', textDecoration: 'underline' }}>Open media</a>
      )}
    </div>
  );
}

function MapPicker({ lat, lng, radius, onChange }) {
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const circleRef = useRef(null);
  const markerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [r, setR] = useState(radius || 25);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const defaultPos = [lat || 44.9778, lng || -93.265];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.L) { setReady(true); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.async = true;
    s.onload = () => setReady(true);
    document.body.appendChild(s);
  }, []);

  useEffect(() => {
    if (!ready || !divRef.current || typeof window === 'undefined') return;
    const L = window.L; if (!L) return;

    if (!mapRef.current) {
      mapRef.current = L.map(divRef.current).setView(defaultPos, lat && lng ? 16 : 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapRef.current);

      markerRef.current = L.marker(defaultPos, { draggable: true }).addTo(mapRef.current);
      circleRef.current = L.circle(markerRef.current.getLatLng(), { radius: r || 25, color: '#33a8ff' }).addTo(mapRef.current);

      const sync = () => {
        const p = markerRef.current.getLatLng();
        circleRef.current.setLatLng(p);
        circleRef.current.setRadius(Number(r || 25));
        onChange(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)), Number(r || 25));
      };
      markerRef.current.on('dragend', sync);
      mapRef.current.on('click', (e) => { markerRef.current.setLatLng(e.latlng); sync(); });
      sync();
    } else {
      const p = defaultPos;
      markerRef.current.setLatLng(p);
      circleRef.current.setLatLng(p);
      circleRef.current.setRadius(Number(r || 25));
    }
  }, [ready]);

  useEffect(() => {
    if (circleRef.current && markerRef.current) {
      circleRef.current.setRadius(Number(r || 25));
      const p = markerRef.current.getLatLng();
      onChange(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)), Number(r || 25));
    }
  }, [r]);

  async function doSearch(e) {
    e?.preventDefault();
    if (!q.trim()) return;
    setSearching(true); setResults([]);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function gotoResult(r) {
    if (!mapRef.current || !markerRef.current) return;
    const lat = Number(r.lat), lon = Number(r.lon);
    const p = [lat, lon];
    markerRef.current.setLatLng(p);
    circleRef.current.setLatLng(p);
    mapRef.current.setView(p, 16);
    onChange(Number(lat.toFixed(6)), Number(lon.toFixed(6)), Number(r || 25));
    setResults([]);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude, lon = pos.coords.longitude;
      gotoResult({ lat, lon });
    });
  }

  return (
    <div>
      <form onSubmit={doSearch} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, marginBottom: 8 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search address or place…" style={S.input} />
        <button type="button" onClick={useMyLocation} style={S.button}>📍 Use my location</button>
        <button disabled={searching} type="submit" style={S.button}>{searching ? 'Searching…' : 'Search'}</button>
      </form>
      {results.length > 0 && (
        <div style={{ background: '#0b0c10', border: '1px solid #2a323b', borderRadius: 10, padding: 8, marginBottom: 8, maxHeight: 160, overflow: 'auto' }}>
          {results.map((r, i) => (
            <div key={i} onClick={() => gotoResult(r)} style={{ padding: '6px 8px', cursor: 'pointer', borderBottom: '1px solid #1f262d' }}>
              <div style={{ fontWeight: 600 }}>{r.display_name}</div>
              <div style={{ color: '#9fb0bf', fontSize: 12 }}>lat {Number(r.lat).toFixed(6)}, lng {Number(r.lon).toFixed(6)}</div>
            </div>
          ))}
        </div>
      )}
      <div ref={divRef} style={{ width: '100%', height: 320, borderRadius: 12, overflow: 'hidden', border: '1px solid #2a323b', marginBottom: 8 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
        <input type="range" min={5} max={2000} step={5} value={r} onChange={(e) => setR(Number(e.target.value))} />
        <code style={{ color: '#9fb0bf' }}>{r} m</code>
      </div>
    </div>
  );
}

function TestSMS() {
  const [to, setTo] = useState('');
  const [msg, setMsg] = useState('Test message from admin');
  const [status, setStatus] = useState('');
  async function send() {
    setStatus('Sending…');
    const res = await fetch('/api/sms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, body: msg }) });
    const text = await res.text();
    setStatus(res.ok ? '✅ Sent' : '❌ ' + text);
  }
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 2fr auto', alignItems: 'center' }}>
        <input placeholder="+1..." style={S.input} value={to} onChange={(e) => setTo(e.target.value)} />
        <input placeholder="Message" style={S.input} value={msg} onChange={(e) => setMsg(e.target.value)} />
        <button style={S.button} onClick={send}>Send Test</button>
      </div>
      <div style={{ marginTop: 6, color: '#9fb0bf' }}>{status}</div>
    </div>
  );
}

function ChangeAuth() {
  const [curUser, setCurUser] = useState('');
  const [curPass, setCurPass] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [status, setStatus] = useState('');
  async function submit() {
    setStatus('Updating…');
    const res = await fetch('/api/change-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ curUser, curPass, newUser, newPass }),
    });
    const t = await res.text();
    setStatus(res.ok ? '✅ Updated. Redeploying… refresh soon.' : '❌ ' + t);
  }
  return (
    <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
      <div>
        <Field label="Current Username"><input style={S.input} value={curUser} onChange={(e) => setCurUser(e.target.value)} /></Field>
        <Field label="Current Password"><input type="password" style={S.input} value={curPass} onChange={(e) => setCurPass(e.target.value)} /></Field>
      </div>
      <div>
        <Field label="New Username"><input style={S.input} value={newUser} onChange={(e) => setNewUser(e.target.value)} /></Field>
        <Field label="New Password"><input type="password" style={S.input} value={newPass} onChange={(e) => setNewPass(e.target.value)} /></Field>
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <button style={S.button} onClick={submit}>Change Credentials</button>
        <div style={{ color: '#9fb0bf', marginTop: 6 }}>{status}</div>
      </div>
    </div>
  );
}

/* =====================================================================
   5) STYLES
   ===================================================================== */
const S = {
  body: { background: '#0b0c10', color: '#e9eef2', minHeight: '100vh', fontFamily: 'system-ui, Arial, sans-serif' },
  header: { padding: 16, background: '#11161a', borderBottom: '1px solid #1d2329' },
  wrap: { maxWidth: 1100, margin: '0 auto', padding: 16 },
  wrapGrid: { display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start', maxWidth: 1200, margin: '0 auto', padding: 16 },
  sidebar: { background: '#12181d', border: '1px solid #1f262d', borderRadius: 14, padding: 12, position: 'sticky', top: 12, height: 'calc(100vh - 120px)', overflow: 'auto' },
  editor: { minHeight: '60vh' },
  card: { background: '#12181d', border: '1px solid #1f262d', borderRadius: 14, padding: 16 },
  missionItem: { borderBottom: '1px solid #1f262d', padding: '10px 4px' },
  input: { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #2a323b', background: '#0b0c10', color: '#e9eef2' },
  button: { padding: '10px 14px', borderRadius: 10, border: '1px solid #2a323b', background: '#1a2027', color: '#e9eef2', cursor: 'pointer' },
  tab: { padding: '8px 12px', borderRadius: 10, border: '1px solid #2a323b', background: '#0f1418', color: '#e9eef2', cursor: 'pointer' },
  tabActive: { background: '#1a2027' },
  search: { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #2a323b', background: '#0b0c10', color: '#e9eef2', marginBottom: 10 },
  hr: { border: '1px solid #1f262d', borderBottom: 'none' },
};



/* =====================================================================
   MapOverview — Leaflet map overlaying all missions + power-ups (robust)
   ===================================================================== */
function MapOverview({ missions=[], powerups=[], showRings=true }) {
  const divRef = React.useRef(null);
  const [leafletReady, setLeafletReady] = React.useState(!!(typeof window !== 'undefined' && window.L));

  // helper: safely read lat/lng from various shapes
  function getLL(src) {
    if (!src) return null;
    const c = src.content || src;
    const lat = Number(c.lat ?? c.latitude ?? (c.center && c.center.lat));
    const lng = Number(c.lng ?? c.longitude ?? (c.center && c.center.lng));
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return [lat, lng];
  }

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.L) { setLeafletReady(true); return; }
    // add CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    // add JS
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.async = true;
    s.onload = () => setLeafletReady(true);
    document.body.appendChild(s);
  }, []);

  React.useEffect(() => {
    if (!leafletReady || !divRef.current || typeof window === 'undefined') return;
    const L = window.L; if (!L) return;

    // create or get map instance
    if (!divRef.current._leaflet_map) {
      const map = L.map(divRef.current, { center: [44.9778,-93.2650], zoom: 12 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
      divRef.current._leaflet_map = map;
    }
    const map = divRef.current._leaflet_map;

    // clear or create overlay layer
    if (!map._overviewLayer) {
      map._overviewLayer = L.layerGroup().addTo(map);
    } else {
      map._overviewLayer.clearLayers();
    }
    const layer = map._overviewLayer;
    const bounds = L.latLngBounds([]);

    const missionIcon = L.divIcon({ className: 'mission-icon', html: '<div style="width:18px;height:18px;border-radius:50%;background:#60a5fa;border:2px solid white;box-shadow:0 0 0 2px #1f2937"></div>' });
    const powerIcon   = L.divIcon({ className: 'power-icon', html: '<div style="width:18px;height:18px;border-radius:4px;background:#f59e0b;border:2px solid white;box-shadow:0 0 0 2px #1f2937"></div>' });

    (missions||[]).forEach((m) => {
      const pos = getLL(m);
      const c = (m && m.content) || {};
      const isFence = !!(c.geofenceEnabled || Number(c.radiusMeters) > 0);
      if (!pos || !isFence) return;
      const rad = Number(c.radiusMeters || 0);
      const mk = L.marker(pos, { icon: missionIcon }).addTo(layer);
      const title = m.title || m.id || 'Mission';
      const t = m.type || '';
      mk.bindPopup(`<b>${title}</b><br/>${t}${rad? `<br/>radius: ${rad}m` : ''}`);
      if (showRings && rad > 0) L.circle(pos, { radius: rad, color: '#60a5fa', fillOpacity: 0.08 }).addTo(layer);
      bounds.extend(pos);
    });

    (powerups||[]).forEach((p) => {
      const pos = getLL(p);
      if (!pos) return;
      const rad = Number(p.pickupRadius || p.radiusMeters || 0);
      const mk = L.marker(pos, { icon: powerIcon }).addTo(layer);
      const title = p.title || p.type || 'Power-up';
      mk.bindPopup(`<b>${title}</b>${rad? `<br/>pickup: ${rad}m` : ''}`);
      if (showRings && rad > 0) L.circle(pos, { radius: rad, color: '#f59e0b', fillOpacity: 0.08 }).addTo(layer);
      bounds.extend(pos);
    });

    if (bounds.isValid()) map.fitBounds(bounds.pad(0.2));
  }, [leafletReady, missions, powerups, showRings]);

  return (
    <div>
      {!leafletReady && <div style={{ color: '#9fb0bf', marginBottom: 8 }}>Loading map…</div>}
      <div ref={divRef} style={{ height: 520, borderRadius: 12, border: '1px solid #22303c', background: '#0b1116' }} />
      {((missions||[]).filter(m => (m.content?.geofenceEnabled || Number(m.content?.radiusMeters) > 0)).length === 0) &&
       ((powerups||[]).length === 0) && (
        <div style={{ color: '#9fb0bf', marginTop: 8 }}>
          No geofenced missions or power-ups found. Enable a mission’s geofence (lat/lng &amp; radius) or add power-ups with lat/lng.
        </div>
      )}
    </div>
  );
}
