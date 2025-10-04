// game/pages/index.jsx
import React, { useEffect, useMemo, useState } from 'react';

/**
 * This Game page reads static JSON that Admin published into:
 *   game/public/games/<slug>/(config.json, missions.json)
 *   game/public/games/<slug>/draft/(config.json, missions.json)  // when channel=draft
 * URL params:
 *   ?slug=<slug>&channel=published|draft&preview=1
 */

function applyStyle(themeDefault = {}, mission = {}) {
  const c = mission?.content || {};
  const s = c.styleEnabled ? (c.style || {}) : {};
  const merged = {
    fontFamily: s.fontFamily || themeDefault.fontFamily,
    fontSize: s.fontSize || themeDefault.fontSize || 18,
    textColor: s.textColor || themeDefault.textColor,
    backgroundColor: s.backgroundColor || themeDefault.backgroundColor,
    backgroundImageUrl: s.backgroundImageUrl || '',
    backgroundSize: s.backgroundSize || 'cover',
  };
  return {
    fontFamily: merged.fontFamily || 'inherit',
    fontSize: merged.fontSize ? `${merged.fontSize}px` : undefined,
    color: merged.textColor || undefined,
    background: merged.backgroundColor || undefined,
    backgroundImage: merged.backgroundImageUrl ? `url("${merged.backgroundImageUrl}")` : undefined,
    backgroundSize: merged.backgroundSize,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center center',
    minHeight: '50vh',
    borderRadius: 12,
    padding: 16,
  };
}

export default function GamePage() {
  const [slug, setSlug] = useState('');
  const [channel, setChannel] = useState('published');
  const [preview, setPreview] = useState(false);
  const [config, setConfig] = useState(null);
  const [suite, setSuite] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // Read URL params on client
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const qp = new URLSearchParams(window.location.search);
    setSlug(qp.get('slug') || '');
    setChannel(qp.get('channel') || 'published');
    setPreview(qp.get('preview') === '1' || qp.get('preview') === 'true');
  }, []);

  // Fetch JSON from Game's own /public
  useEffect(() => {
    if (!slug) return;
    let didCancel = false;
    (async () => {
      try {
        setLoading(true);
        setErr('');
        const base = `/games/${encodeURIComponent(slug)}${channel === 'draft' ? '/draft' : ''}`;
        const [cfgRes, misRes] = await Promise.all([
          fetch(`${base}/config.json`, { cache: 'no-store' }),
          fetch(`${base}/missions.json`, { cache: 'no-store' }),
        ]);
        const cfg = cfgRes.ok ? await cfgRes.json() : null;
        const mis = misRes.ok ? await misRes.json() : null;
        if (!didCancel) {
          setConfig(cfg);
          setSuite(mis);
        }
      } catch (e) {
        if (!didCancel) setErr(String(e?.message || e));
      } finally {
        if (!didCancel) setLoading(false);
      }
    })();
    return () => { didCancel = true; };
  }, [slug, channel]);

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>{config?.game?.title || 'Game'}</h1>
          <div style={{ color: '#64748b', fontSize: 12 }}>
            {slug ? `slug: ${slug}` : 'no slug'} • channel: {channel}
          </div>
        </div>
        {preview && <div style={{ color: '#9fb0bf', fontSize: 12 }}>preview mode</div>}
      </header>

      {!slug && <Card>Missing <code>?slug=&lt;game-slug&gt;</code> in the URL.</Card>}
      {err && <Card>Failed to load content: {err}</Card>}
      {loading && slug && <Card>Loading…</Card>}

      {config && suite && <Runner config={config} suite={suite} preview={preview} />}

      {!loading && slug && (!config || !suite) && (
        <Card>No content found for this slug/channel.</Card>
      )}
    </div>
  );
}

function Runner({ config, suite, preview }) {
  // Order: intro first, final last
  const missions = (suite?.missions || []);
  const intro = missions.find(m => m.role === 'intro');
  const final = missions.find(m => m.role === 'final');
  const core = missions.filter(m => m !== intro && m !== final);
  const ordered = [...(intro ? [intro] : []), ...core, ...(final ? [final] : [])];

  const [idx, setIdx] = useState(0);
  const mission = ordered[idx];
  const themeDefault = config?.theme?.missionDefault || {};
  const [answers, setAnswers] = useState({});

  const next = () => setIdx(i => Math.min(i + 1, ordered.length - 1));
  const prev = () => setIdx(i => Math.max(i - 1, 0));
  const onAnswer = (id, value) => setAnswers(a => ({ ...a, [id]: value }));

  if (!mission) return <Card>No missions.</Card>;
  const style = applyStyle(themeDefault, mission);

  return (
    <div>
      <div style={{ border: '1px solid #22303c', borderRadius: 12, overflow: 'hidden', background: 'transparent' }}>
        <div style={style}>
          <h2 style={{ marginTop: 0 }}>{mission.title || mission.id}</h2>
          <MissionBody mission={mission} answer={answers[mission.id]} onAnswer={onAnswer} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <button onClick={prev} disabled={idx === 0} style={btn()}>Back</button>
        <div style={{ color: '#64748b', fontSize: 12 }}>{idx + 1} / {ordered.length}</div>
        <button onClick={next} disabled={idx === ordered.length - 1} style={btn(true)}>Next</button>
      </div>

      {preview && (
        <details style={{ marginTop: 12, border: '1px dashed #22303c', padding: 8, borderRadius: 8 }}>
          <summary>Preview data</summary>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify({ answers, missionId: mission.id }, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}

function MissionBody({ mission, answer, onAnswer }) {
  const t = mission.type || 'statement';
  if (t === 'statement') {
    const text = mission.content?.text || '';
    return <div style={{ marginTop: 12 }}>{text}</div>;
  }
  if (t === 'short_answer') {
    const prompt = mission.content?.prompt || 'Your answer:';
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ color: '#9fb0bf', fontSize: 12, marginBottom: 6 }}>{prompt}</div>
        <input
          value={answer || ''}
          onChange={e => onAnswer(mission.id, e.target.value)}
          style={input()}
        />
      </div>
    );
  }
  if (t === 'multiple_choice') {
    const prompt = mission.content?.prompt || 'Choose one:';
    const options = mission.content?.options || ['A','B','C'];
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ color: '#9fb0bf', fontSize: 12, marginBottom: 6 }}>{prompt}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {options.map(opt => (
            <label key={String(opt)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="radio" name={mission.id} checked={answer === opt} onChange={() => onAnswer(mission.id, opt)} />
              <span>{String(opt)}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }
  if (t === 'powerup') {
    const name = mission.content?.name || 'Power-up';
    const desc = mission.content?.description || '';
    return (
      <div style={{ marginTop: 12 }}>
        <div><b>{name}</b></div>
        <div style={{ color: '#9fb0bf' }}>{desc}</div>
      </div>
    );
  }
  return <div style={{ marginTop: 12 }}>Unsupported mission type: <code>{t}</code></div>;
}

// Small UI helpers
function Card({ children }) {
  return <div style={{ background: '#0f141b', border: '1px solid #22303c', borderRadius: 12, padding: 16, marginBottom: 12 }}>{children}</div>;
}
function btn(primary) {
  return { padding: '8px 12px', border: '1px solid #22303c', borderRadius: 8, background: primary ? '#0e191f' : '#0b0f15', color: '#e9eef2', cursor: 'pointer' };
}
function input() {
  return { padding: '8px', border: '1px solid #22303c', borderRadius: 8, background: '#0b0f15', color: '#e9eef2', width: '100%' };
}
