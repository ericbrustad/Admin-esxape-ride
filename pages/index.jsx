import { useEffect, useMemo, useRef, useState } from 'react';

/* =========================================================
   S0) Helpers (top-level, safe to reuse)
   ========================================================= */

/** Fetch JSON with a fallback (prevents HTML error pages from crashing .json()). */
async function fetchJsonSafe(url, fallback) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    if (r.ok && ct.includes('application/json')) {
      return await r.json();
    }
  } catch {}
  return fallback;
}

/** Try the first JSON that returns OK. */
async function fetchFirstJson(urls, fallback) {
  for (const u of urls) {
    const j = await fetchJsonSafe(u, undefined);
    if (j !== undefined) return j;
  }
  return fallback;
}

/** Dropbox normalizer: share → direct. Also appends ?raw=1 if needed. */
function normalizeDropbox(u) {
  try {
    const url = new URL(u);
    const isDropbox = /dropbox\.com$/i.test(url.hostname);
    if (!isDropbox) return u;
    // Convert to raw host
    url.hostname = 'dl.dropboxusercontent.com';
    // If no query, enforce raw=1
    if (!url.search) url.search = '?raw=1';
    return url.toString();
  } catch {
    return u;
  }
}

function looksLikeDropbox(u) {
  try { return /dropbox\.com/i.test(new URL(u).hostname); } catch { return false; }
}

function hasImageExt(u) {
  return /\.(png|jpg|jpeg|gif|webp|avif)(\?|#|$)/i.test(u);
}
function hasVideoExt(u) {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u);
}

/* =========================================================
   S1) TYPE / FORM DEFINITIONS
   - TYPE_FIELDS feeds the generic renderer.
   - Some types get custom UI blocks (MC, geofence types, AR types).
   ========================================================= */
const TYPE_FIELDS = {
  multiple_choice: [
    { key: 'question', label: 'Question', type: 'text' },
    { key: 'mediaUrl', label: 'Image or Video URL (optional)', type: 'text' }, // preview below
    // geofence handled by common toggle block
  ],
  short_answer: [
    { key: 'question', label: 'Question', type: 'text' },
    { key: 'answer', label: 'Correct Answer', type: 'text' },
    { key: 'acceptable', label: 'Also Accept (comma-separated)', type: 'text' },
    { key: 'mediaUrl', label: 'Image or Video URL (optional)', type: 'text' },
    // geofence handled by common toggle block
  ],
  statement: [
    { key: 'text', label: 'Statement Text', type: 'multiline' },
    { key: 'mediaUrl', label: 'Image or Video URL (optional)', type: 'text' },
    // geofence handled by common toggle block
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
    // geofence via toggle block
  ],
  ar_video: [
    { key: 'markerUrl', label: 'AR Marker Image URL (png/jpg)', type: 'text' },
    { key: 'assetUrl', label: 'AR Video URL (mp4)', type: 'text' },
    { key: 'overlayText', label: 'Overlay Text (optional)', type: 'text' },
    // geofence via toggle block
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

/* =========================================================
   S2) ROOT COMPONENT
   ========================================================= */
export default function Admin() {
  const [tab, setTab] = useState('missions');

  // Games
  const [games, setGames] = useState([]);
  const [activeSlug, setActiveSlug] = useState(''); // '' = legacy root

  // New game modal
  const [showNewGame, setShowNewGame] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('Mystery');
  const [newMode, setNewMode] = useState('single');

  // Data
  const [suite, setSuite] = useState(null); // {id, version, missions:[]}
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState('');

  // Editor state
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [dirty, setDirty] = useState(false);

  // SMS rules
  const [smsRule, setSmsRule] = useState({ missionId: '', phoneSlot: 1, message: '', delaySec: 30 });

  // Load games (catalog)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/games');
        const j = await r.json();
        if (j?.ok) setGames(j.games || []);
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  // Load missions/config (slug-aware)
  useEffect(() => {
    (async () => {
      try {
        setStatus('Loading…');

        // Missions fetch list (prefer per-game, fallback to root)
        const mUrls = activeSlug
          ? [`/games/${encodeURIComponent(activeSlug)}/missions.json`, `/missions.json`]
          : [`/missions.json`];

        const cUrl = activeSlug ? `/api/config?slug=${encodeURIComponent(activeSlug)}` : `/api/config`;

        const m = await fetchFirstJson(mUrls, { id: 'msuite', version: '0.0.0', missions: [] });
        const c = await fetchJsonSafe(cUrl, defaultConfig());

        // Legacy normalization for 'quiz'
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
        setConfig({ ...defaultConfig(), ...c });
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
      textRules: [],
      // keep any existing config.powerUps; we won’t overwrite
    };
  }

  function defaultContentForType(t) {
    switch (t) {
      case 'multiple_choice':
        return {
          question: '',
          choices: [],
          correctIndex: undefined,
          mediaUrl: '',
          geofenceEnabled: false,
          lat: '',
          lng: '',
          radiusMeters: 25,
          cooldownSeconds: 30,
        };
      case 'short_answer':
        return {
          question: '',
          answer: '',
          acceptable: '',
          mediaUrl: '',
          geofenceEnabled: false,
          lat: '',
          lng: '',
          radiusMeters: 25,
          cooldownSeconds: 30,
        };
      case 'statement':
        return {
          text: '',
          mediaUrl: '',
          geofenceEnabled: false,
          lat: '',
          lng: '',
          radiusMeters: 25,
          cooldownSeconds: 30,
        };
      case 'video':
        return { videoUrl: '', overlayText: '' };
      case 'geofence_image':
        return { lat: '', lng: '', radiusMeters: 25, cooldownSeconds: 30, imageUrl: '', overlayText: '' };
      case 'geofence_video':
        return { lat: '', lng: '', radiusMeters: 25, cooldownSeconds: 30, videoUrl: '', overlayText: '' };
      case 'ar_image':
        return { markerUrl: '', assetUrl: '', overlayText: '', geofenceEnabled: false, lat: '', lng: '', radiusMeters: 25, cooldownSeconds: 30 };
      case 'ar_video':
        return { markerUrl: '', assetUrl: '', overlayText: '', geofenceEnabled: false, lat: '', lng: '', radiusMeters: 25, cooldownSeconds: 30 };
      default:
        return {};
    }
  }

  // Save (slug-aware)
  async function saveAll() {
    if (!suite || !config) return;
    setStatus('Saving…');
    const qs = activeSlug ? `?slug=${encodeURIComponent(activeSlug)}` : '';
    const [a, b] = await Promise.all([
      fetch('/api/save' + qs, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ missions: suite }) }),
      fetch('/api/save-config' + qs, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config }) }),
    ]);
    const ok = a.ok && b.ok;
    if (!ok) {
      setStatus('❌ Save failed:\n' + (await a.text()) + '\n' + (await b.text()));
    } else {
      setStatus('✅ Saved (files committed)');
    }
  }

  // Missions list helpers
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

    // Basic presence check based on schema (ignore mediaUrl optional)
    const fields = TYPE_FIELDS[editing.type] || [];
    for (const f of fields) {
      if (f.type === 'number') continue;
      const v = editing.content?.[f.key];
      if (f.key !== 'mediaUrl' && (v === undefined || v === null || v === '')) {
        return setStatus('❌ Missing: ' + f.label);
      }
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

  // SMS
  function addSmsRule() {
    if (!smsRule.missionId || !smsRule.message) {
      setStatus('❌ Pick mission and message');
      return;
    }
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

  const current = useMemo(() => (suite?.missions || []).find((m) => m.id === selected) || null, [suite, selected]);

  if (!suite || !config) return <main style={S.wrap}><div style={S.card}>Loading…</div></main>;

  /* =========================================================
     S3) RENDER
     ========================================================= */
  return (
    <div style={S.body}>
      <header style={S.header}>
        <div style={S.wrap}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {['settings', 'missions', 'text', 'security', 'powerups'].map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }}>
                {t.toUpperCase()}
              </button>
            ))}

            {/* Game selector + New Game */}
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
              <button style={S.button} onClick={() => setShowNewGame(true)}>+ New Game</button>
            </div>

            {/* Always-visible New Mission */}
            <button onClick={startNew} style={{ ...S.button }}>+ New Mission</button>

            {/* Save + quick views (slug-aware config link) */}
            <button onClick={saveAll} style={{ ...S.button, marginLeft: 'auto' }}>💾 Save All</button>
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

      {tab === 'missions' && (
        <main style={S.wrapGrid}>
          {/* LEFT: mission list */}
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
                      <div style={{ color: '#9fb0bf', fontSize: 12 }}>{m.type} — id: {m.id}</div>
                    </div>
                    <button style={{ ...S.button, padding: '6px 10px' }} onClick={() => removeMission(m.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* RIGHT: editor */}
          <section style={S.editor}>
            {!editing ? (
              <div style={S.card}>
                <p style={{ marginTop: 0, color: '#9fb0bf' }}>Select a mission or click <em>New Mission</em>.</p>
                <p style={{ color: '#9fb0bf' }}>
                  Version: <code>{suite.version || '0.0.0'}</code> • Total: <code>{suite.missions?.length || 0}</code>
                </p>
              </div>
            ) : (
              <div style={S.card}>
                <Field label="ID"><input style={S.input} value={editing.id} onChange={(e) => { setEditing({ ...editing, id: e.target.value }); setDirty(true); }} /></Field>
                <Field label="Title"><input style={S.input} value={editing.title} onChange={(e) => { setEditing({ ...editing, title: e.target.value }); setDirty(true); }} /></Field>
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
                    {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <hr style={S.hr} />

                {/* Multiple Choice custom editor (A–E + radio) */}
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

                {/* Geofence always-on for geofence_* types */}
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

                {/* Geofence toggle for AR + MC + Short + Statement */}
                {(editing.type === 'ar_image' ||
                  editing.type === 'ar_video' ||
                  editing.type === 'multiple_choice' ||
                  editing.type === 'short_answer' ||
                  editing.type === 'statement') && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <input
                        type="checkbox"
                        checked={!!editing.content?.geofenceEnabled}
                        onChange={(e) => {
                          const on = e.target.checked;
                          const next = { ...editing.content, geofenceEnabled: on };
                          if (on && (!next.lat || !next.lng)) { next.lat = 44.9778; next.lng = -93.2650; }
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
                            type="number" min={0} max={3600} style={S.input}
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

                {/* Generic renderer + previews */}
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
                        type="number" min={f.min} max={f.max} style={S.input}
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
                    type="number" style={S.input}
                    value={editing.rewards?.points ?? 0}
                    onChange={(e) => {
                      const v = e.target.value === '' ? 0 : Number(e.target.value);
                      setEditing({ ...editing, rewards: { ...(editing.rewards || {}), points: v } });
                      setDirty(true);
                    }}
                  />
                </Field>

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

      {tab === 'settings' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <h3 style={{ marginTop: 0 }}>Game Settings</h3>
            <Field label="Game Title">
              <input style={S.input} value={config.game.title} onChange={(e) => setConfig({ ...config, game: { ...config.game, title: e.target.value } })} />
            </Field>
            <Field label="Game Type">
              <select style={S.input} value={config.game.type} onChange={(e) => setConfig({ ...config, game: { ...config.game, type: e.target.value } })}>
                {GAME_TYPES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Stripe Splash Page">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={config.splash.enabled}
                    onChange={(e) => setConfig({ ...config, splash: { ...config.splash, enabled: e.target.checked } })}
                  />
                  Enable Splash (game code & Stripe)
                </label>
              </div>
            </Field>
            <Field label="Mode (players collected on splash)">
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
            <div style={{ color: '#9fb0bf' }}>Splash should render {config.forms.players} player info blocks (first name, email, phone).</div>
          </div>
        </main>
      )}

      {tab === 'text' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <h3 style={{ marginTop: 0 }}>Text Message Rules</h3>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
              <Field label="Mission (geofence)">
                <select style={S.input} value={smsRule.missionId} onChange={(e) => setSmsRule({ ...smsRule, missionId: e.target.value })}>
                  <option value="">— choose —</option>
                  {(suite.missions || []).map((m) => <option key={m.id} value={m.id}>{m.id} — {m.title}</option>)}
                </select>
              </Field>
              <Field label="Phone slot">
                <select style={S.input} value={smsRule.phoneSlot} onChange={(e) => setSmsRule({ ...smsRule, phoneSlot: Number(e.target.value) })}>
                  {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{'Player ' + n}</option>)}
                </select>
              </Field>
              <Field label="Delay (sec)"><input type="number" min={0} max={3600} style={S.input} value={smsRule.delaySec} onChange={(e) => setSmsRule({ ...smsRule, delaySec: e.target.value })} /></Field>
              <Field label="Message"><input style={S.input} value={smsRule.message} onChange={(e) => setSmsRule({ ...smsRule, message: e.target.value })} /></Field>
            </div>
            <div style={{ marginTop: 12 }}><button style={S.button} onClick={addSmsRule}>+ Add Rule</button></div>
            <hr style={S.hr} />
            <ul style={{ paddingLeft: 18 }}>
              {(config.textRules || []).map((r, i) => (
                <li key={i} style={{ marginBottom: 8 }}>
                  <code>{r.missionId}</code> → Player {r.phoneSlot} • delay {r.delaySec}s • “{r.message}”
                  <button style={{ ...S.button, marginLeft: 8, padding: '6px 10px' }} onClick={() => removeSmsRule(i)}>Remove</button>
                </li>
              ))}
            </ul>
            <p style={{ color: '#9fb0bf' }}>Note: Your game should trigger SMS when the mission/geofence completes.</p>
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer' }}>Send a quick test SMS now</summary>
              <TestSMS />
            </details>
          </div>
        </main>
      )}

      {tab === 'security' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <h3 style={{ marginTop: 0 }}>Admin Credentials</h3>
            <p style={{ color: '#9fb0bf' }}>Change the Basic Auth login used for this admin. Requires current password.</p>
            <ChangeAuth />
            <hr style={S.hr} />
            <h3>Twilio Credentials</h3>
            <p style={{ color: '#ffd166' }}>Store <b>Twilio</b> and <b>Vercel</b> credentials only as environment variables. Never in code.</p>
            <ul>
              <li><code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code> (or API Key SID/SECRET)</li>
              <li><code>TWILIO_FROM</code> (phone or Messaging Service SID)</li>
            </ul>
          </div>
        </main>
      )}

      {tab === 'powerups' && (
        <main style={S.wrap}>
          <PowerUpsEditor config={config} setConfig={setConfig} />
        </main>
      )}

      {/* New Game modal */}
      {showNewGame && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 1000 }}>
          <div style={{ ...S.card, width: 420 }}>
            <h3 style={{ marginTop: 0 }}>Create New Game</h3>
            <Field label="Game Title">
              <input style={S.input} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            </Field>
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
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button style={S.button} onClick={() => setShowNewGame(false)}>Cancel</button>
              <button
                style={S.button}
                onClick={async () => {
                  if (!newTitle.trim()) return;
                  const r = await fetch('/api/games', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: newTitle.trim(), type: newType, mode: newMode })
                  });
                  const j = await r.json();
                  if (!j?.ok) { setStatus('❌ ' + (j.error || 'create failed')); return; }
                  // Refresh list and jump
                  const rr = await fetch('/api/games'); const jj = await rr.json();
                  if (jj?.ok) setGames(jj.games || []);
                  setActiveSlug(j.slug);
                  setNewTitle(''); setShowNewGame(false);
                }}
              >Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   S4) SMALL UI HELPERS & WIDGETS
   ========================================================= */

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

/** Multiple Choice Editor (A–E) with radio correct */
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
          <input
            type="radio"
            name="mcq-correct"
            checked={correct === i}
            onChange={() => { setCorrect(i); sync(local, i); }}
            title="Mark as correct"
          />
          <input
            placeholder={`Choice ${String.fromCharCode(65 + i)}`}
            style={S.input}
            value={local[i] || ''}
            onChange={(e) => {
              const next = [...local];
              next[i] = e.target.value;
              setLocal(next);
              sync(next, correct);
            }}
          />
        </div>
      ))}
      <div style={{ color: '#9fb0bf', fontSize: 12 }}>
        Leave blanks for unused options. Exactly one radio can be marked correct.
      </div>
    </div>
  );
}

/** Dropbox-aware media preview (img/video). Gracefully falls back to a link. */
function MediaPreview({ url, kind }) {
  const [failed, setFailed] = useState(false);
  if (!url) return null;

  let u = String(url || '').trim();
  const isDb = looksLikeDropbox(u);
  const byExtImg = hasImageExt(u);
  const byExtVid = hasVideoExt(u);

  // Prefer direct link for Dropbox
  if (isDb) u = normalizeDropbox(u);

  // Decide display strategy
  const showVideo = byExtVid;
  const showImg = byExtImg || (isDb && !byExtVid);

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ color: '#9fb0bf', fontSize: 12, marginBottom: 6 }}>Preview ({kind})</div>
      {!failed && showVideo && (
        <video
          src={u}
          controls
          style={{ width: '100%', maxHeight: 260, borderRadius: 10, border: '1px solid #2a323b' }}
          onError={() => setFailed(true)}
        />
      )}
      {!failed && showImg && (
        <img
          src={u}
          alt="preview"
          style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 10, border: '1px solid #2a323b' }}
          onError={() => setFailed(true)}
        />
      )}
      {(failed || (!showImg && !showVideo)) && (
        <a href={u} target="_blank" rel="noreferrer" style={{ color: '#9fb0bf', textDecoration: 'underline' }}>
          Open media
        </a>
      )}
    </div>
  );
}

/** Leaflet Map Picker (CDN) + Address search (Nominatim) + Use my location */
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
  const defaultPos = [lat || 44.9778, lng || -93.2650];

  // Load Leaflet (CSS+JS via CDN)
  useEffect(() => {
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
    if (!ready || !divRef.current) return;
    const L = window.L;
    if (!mapRef.current) {
      mapRef.current = L.map(divRef.current).setView(defaultPos, (lat && lng) ? 16 : 12);
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
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (err) {
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
    const res = await fetch('/api/change-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ curUser, curPass, newUser, newPass }) });
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

/* =========================================================
   S5) POWER-UPS EDITOR (adds "signal_jammer")
   - Non-breaking: preserves existing config.powerUps.
   - Each power-up has: id, title, type, lat/lng (pickup), pickupRadius,
     and payload { durationSec, effectRadiusMeters? } depending on type.
   - Types: 'smoke', 'clone', 'signal_jammer'
   ========================================================= */
function PowerUpsEditor({ config, setConfig }) {
  const powerUps = (config.powerUps || []);
  const [draft, setDraft] = useState({
    title: '',
    type: 'smoke',            // smoke | clone | signal_jammer
    lat: 44.9778,
    lng: -93.2650,
    pickupRadius: 15,
    durationSec: 60,
    effectRadiusMeters: 80,   // for signal_jammer
  });

  function add() {
    if (!draft.title.trim()) return;
    const id = 'pu_' + Math.random().toString(36).slice(2, 8);
    const item = {
      id,
      title: draft.title.trim(),
      type: draft.type,
      lat: Number(draft.lat),
      lng: Number(draft.lng),
      pickupRadius: Number(draft.pickupRadius || 15),
      payload: {
        durationSec: Number(draft.durationSec || 0),
        ...(draft.type === 'signal_jammer' ? { effectRadiusMeters: Number(draft.effectRadiusMeters || 80) } : {}),
      },
    };
    setConfig({ ...config, powerUps: [...powerUps, item] });
    setDraft({ ...draft, title: '' });
  }

  function remove(idx) {
    const next = [...powerUps];
    next.splice(idx, 1);
    setConfig({ ...config, powerUps: next });
  }

  return (
    <div style={S.card}>
      <h3 style={{ marginTop: 0 }}>Power-Ups</h3>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <Field label="Title"><input style={S.input} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
        <Field label="Type">
          <select style={S.input} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
            <option value="smoke">Smoke (hide on GPS)</option>
            <option value="clone">Clone (decoy)</option>
            <option value="signal_jammer">Signal Jammer (blackout zone)</option>
          </select>
        </Field>
        <Field label="Pickup radius (m)">
          <input type="number" min={1} max={500} style={S.input} value={draft.pickupRadius} onChange={(e) => setDraft({ ...draft, pickupRadius: e.target.value })} />
        </Field>
        <Field label="Effect duration (sec)">
          <input type="number" min={1} max={3600} style={S.input} value={draft.durationSec} onChange={(e) => setDraft({ ...draft, durationSec: e.target.value })} />
        </Field>
        {draft.type === 'signal_jammer' && (
          <Field label="Blackout radius (m)">
            <input type="number" min={10} max={1000} style={S.input} value={draft.effectRadiusMeters} onChange={(e) => setDraft({ ...draft, effectRadiusMeters: e.target.value })} />
          </Field>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>Pickup location</div>
        <MapPicker
          lat={draft.lat}
          lng={draft.lng}
          radius={draft.pickupRadius}
          onChange={(lat, lng, rad) => setDraft({ ...draft, lat, lng, pickupRadius: rad })}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button style={S.button} onClick={add}>+ Add Power-Up</button>
      </div>

      <hr style={S.hr} />
      <ul style={{ paddingLeft: 18 }}>
        {powerUps.map((p, i) => (
          <li key={p.id || i} style={{ marginBottom: 8 }}>
            <code>{p.type}</code> — {p.title} @ ({p.lat},{p.lng}) • pickup {p.pickupRadius}m
            {p.payload?.durationSec ? ` • ${p.payload.durationSec}s` : ''}
            {p.type === 'signal_jammer' && p.payload?.effectRadiusMeters ? ` • blackout ${p.payload.effectRadiusMeters}m` : ''}
            <button style={{ ...S.button, marginLeft: 8, padding: '6px 10px' }} onClick={() => remove(i)}>Remove</button>
          </li>
        ))}
      </ul>

      <p style={{ color: '#9fb0bf', marginTop: 8 }}>
        <b>Game-side behavior suggestion:</b> on pickup, apply effect to the opponent in H2H:
        <br />• <code>smoke</code>: hide opponent GPS for <code>durationSec</code>.
        <br />• <code>clone</code>: spawn a decoy marker for <code>durationSec</code>.
        <br />• <code>signal_jammer</code>: render a blackout circle of <code>effectRadiusMeters</code> centered on the opponent, masking their exact location for <code>durationSec</code>.
      </p>
    </div>
  );
}

/* =========================================================
   S6) STYLES
   ========================================================= */
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
  hr: { border: '1px solid #1f262d', borderBottom: 'none' }
};
