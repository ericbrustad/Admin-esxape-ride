import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';

async function fetchJsonSafe(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    const ct = r.headers.get('content-type') || '';
    if (r.ok && ct.includes('application/json')) return await r.json();
  } catch {}
  return null;
}

export default function Game() {
  const router = useRouter();
  const slug = router.query.slug || '';
  const channel = router.query.channel || 'published';
  const preview = !!router.query.preview;

  const [suite, setSuite] = useState(null);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    (async () => {
      const base = slug ? `/games/${encodeURIComponent(slug)}` : '';
      const m = slug ? await fetchJsonSafe(`${base}/missions.json`) : await fetchJsonSafe('/missions.json');
      const c = slug ? await fetchJsonSafe(`${base}/config.json`)   : await fetchJsonSafe('/config.json');
      setSuite(m || { missions: [] });
      setConfig(c || {});
    })();
  }, [slug, channel, preview]);

  const ordered = useMemo(() => {
    if (!suite) return [];
    const intro = suite.missions.filter(m => m.role === 'intro');
    const final = suite.missions.filter(m => m.role === 'final');
    const rest  = suite.missions.filter(m => !m.role);
    return [...intro, ...rest, ...final];
  }, [suite]);

  if (!suite) return <main style={{padding:20}}>Loading…</main>;

  return (
    <main style={{ minHeight:'100vh', background:'#0b0c10', color:'#e9eef2', fontFamily:'system-ui, Arial, sans-serif' }}>
      <div style={{ maxWidth: 900, margin:'0 auto', padding: 16 }}>
        <header style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h1 style={{ margin: 0 }}>{(config && config.game && config.game.title) || 'Game'}</h1>
          {preview && <span style={{ fontSize:12, padding:'4px 8px', border:'1px solid #334250', borderRadius:8 }}>Preview</span>}
        </header>

        {!slug ? <p style={{color:'#9fb0bf'}}>Tip: pass <code>?slug=&lt;game-slug&gt;</code> to load a game from <code>/games/&lt;slug&gt;</code>.</p> : null}

        <ol style={{ listStyle:'none', padding:0, margin:0 }}>
          {ordered.map((m) => {
            const useCustomStyle = m.content && m.content.styleEnabled && m.content.style;
            const themeDefault = (config && config.theme && config.theme.missionDefault) || {};
            const s = useCustomStyle ? m.content.style : themeDefault;
            const wrapStyle = {
              border: '1px solid #1f262d', borderRadius: 12, padding: 16, margin: '12px 0',
              background: s && s.backgroundImageUrl ? `url(${s.backgroundImageUrl})` : ((s && s.backgroundColor) || '#0b0c10'),
              backgroundSize: (s && s.backgroundSize) || 'cover',
              color: (s && s.textColor) || '#e9eef2'
            };
            const innerStyle = {
              fontFamily: (s && s.fontFamily) || 'inherit',
              fontSize: (s && typeof s.fontSize === 'number' ? s.fontSize : 18)
            };
            return (
              <li key={m.id} style={wrapStyle}>
                <div style={innerStyle}>
                  <div style={{fontSize:12, color:'#9fb0bf', marginBottom:4}}>{m.role ? m.role.toUpperCase() : m.type}</div>
                  <h3 style={{margin:'4px 0 8px 0'}}>{m.title || m.id}</h3>
                  {m.type === 'statement' && m.content && m.content.text && <p>{m.content.text}</p>}
                  {m.type === 'multiple_choice' && m.content && m.content.question && <p><strong>{m.content.question}</strong></p>}
                  {m.type === 'short_answer' && m.content && m.content.question && <p><strong>{m.content.question}</strong></p>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </main>
  );
}
