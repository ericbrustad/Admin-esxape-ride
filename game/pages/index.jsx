import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import PhotoCapture from '../components/PhotoCapture';
import OutcomeModal from '../components/OutcomeModal';
import BackpackButton from '../components/BackpackButton';
import BackpackDrawer from '../components/BackpackDrawer';
import {
  initBackpack, getBackpack, addPhoto, addReward, addUtility, addClue,
  addPoints, recordAnswer
} from '../lib/backpack';

function toDirect(u){ try{
  const url=new URL(u); const host=url.host.toLowerCase();
  if(host.endsWith('dropbox.com')){ url.host='dl.dropboxusercontent.com'; url.searchParams.delete('dl'); if(!url.searchParams.has('raw')) url.searchParams.set('raw','1'); return url.toString(); }
  if(host.endsWith('drive.google.com')){ let id=''; if(url.pathname.startsWith('/file/d/')){ id=url.pathname.split('/')[3]||''; } else if(url.pathname==='/open'){ id=url.searchParams.get('id')||''; } if(id) return `https://drive.google.com/uc?export=view&id=${id}`; }
  return u;
}catch{return u;}}

export default function Game() {
  const router = useRouter();
  const [suite, setSuite] = useState(null);
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState('Loading…');
  const [idx, setIdx] = useState(0);

  const [showPhoto, setShowPhoto] = useState(null); // { overlayUrl, title }
  const [outcome, setOutcome]   = useState(null);   // object from mission.onCorrect/onWrong
  const [backpackOpen, setBackpackOpen] = useState(false);

  const [route, setRoute] = useState({ slug: '', channel: 'published' });
  const { slug, channel } = route;
  const routeReady = !!slug;

  const [backpackVersion, setBackpackVersion] = useState(0);
  const refreshBackpack = useCallback(() => setBackpackVersion((v) => v + 1), []);
  const [answerDraft, setAnswerDraft] = useState('');

  useEffect(() => {
    if (!router.isReady) return;

    const search = router.asPath.includes('?') ? router.asPath.split('?')[1] : '';
    const params = new URLSearchParams(search);

    const rawSlug = router.query.slug ?? params.get('slug') ?? '';
    const nextSlug = Array.isArray(rawSlug) ? (rawSlug[0] || '') : rawSlug;

    const rawChannel = router.query.channel ?? params.get('channel') ?? 'published';
    const nextChannel = Array.isArray(rawChannel) ? (rawChannel[0] || 'published') : rawChannel || 'published';

    setRoute((prev) => (
      prev.slug === nextSlug && prev.channel === nextChannel
        ? prev
        : { slug: nextSlug, channel: nextChannel }
    ));
  }, [router.isReady, router.query.slug, router.query.channel, router.asPath]);

  useEffect(() => {
    if (!routeReady) return;
    initBackpack(slug);
    refreshBackpack();
  }, [routeReady, slug, refreshBackpack]);

  useEffect(() => {
    if (!routeReady) return;
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        setStatus('Loading…');
        setSuite(null);
        setConfig(null);
        const base = channel === 'published' ? 'published' : 'draft';
        const prefix = `/games/${encodeURIComponent(slug)}/${base}`;

        const missionsRes = await fetch(`${prefix}/missions.json`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!missionsRes.ok) throw new Error(`Unable to load missions (${missionsRes.status})`);
        const ms = await missionsRes.json();

        let cfg = {};
        try {
          const configRes = await fetch(`${prefix}/config.json`, {
            cache: 'no-store',
            signal: controller.signal,
          });
          if (configRes.ok) {
            cfg = await configRes.json();
          }
        } catch (err) {
          if (err?.name === 'AbortError') return;
          cfg = {};
        }

        if (cancelled) return;
        setSuite(ms);
        setConfig(cfg || {});
        setStatus('');
      } catch (e) {
        if (e?.name === 'AbortError') return;
        setStatus('Failed to load game.');
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [routeReady, slug, channel]);

  useEffect(() => {
    setIdx(0);
  }, [slug]);

  useEffect(() => {
    setAnswerDraft('');
  }, [idx, slug]);

  if (!routeReady) {
    return <main style={outer}><div style={card}>{status || 'Loading game…'}</div></main>;
  }

  if (!suite || !config) {
    return <main style={outer}><div style={card}>{status}</div></main>;
  }

  const missions = Array.isArray(suite.missions) ? suite.missions : [];
  const m = missions[idx];

  const points = useMemo(() => {
    if (typeof window === 'undefined' || !slug) return 0;
    try {
      return getBackpack(slug).points || 0;
    } catch {
      return 0;
    }
  }, [slug, backpackVersion]);

  function next() { setIdx(i => Math.min(i + 1, Math.max(missions.length - 1, 0))); }
  function prev() { setIdx(i => Math.max(i - 1, 0)); }

  function applyOutcome(o, wasCorrect) {
    if (!o || !o.enabled) return next();
    if (!slug) return next();
    // Apply points?
    if (wasCorrect && typeof m?.rewards?.points === 'number') addPoints(slug, m.rewards.points);

    // Map rewards/punishments to backpack when configured
    if (o.rewardKey) {
      const row = (config.media?.rewards||[]).find(r => r.key === o.rewardKey);
      if (row) addReward(slug, { key: row.key, name: row.name || 'Reward', thumbUrl: row.thumbUrl || '' });
    }
    if (o.punishmentKey || o.deviceKey) {
      const key = o.punishmentKey || o.deviceKey;
      const all = [...(config.media?.punishments||[]), ...(config.devices||[])];
      const row = all.find(r => r.key === key || r.id === key || r.type === key);
      addUtility(slug, { key, name: row?.name || row?.title || 'Utility', thumbUrl: row?.thumbUrl || '' });
    }
    if (o.clueText) addClue(slug, o.clueText);

    refreshBackpack();

    // Show visual outcome
    setOutcome({
      title: wasCorrect ? 'Correct!' : 'Try Again',
      message: o.message,
      mediaUrl: o.mediaUrl ? toDirect(o.mediaUrl) : '',
      audioUrl: o.audioUrl ? toDirect(o.audioUrl) : ''
    });
  }

  function handleMC(answerIdx) {
    if (!m) return;
    const ci = Number(m.content?.correctIndex);
    const ok = Number(answerIdx) === ci;
    if (slug && m?.id) recordAnswer(slug, m.id, { correct: ok, value: answerIdx });
    applyOutcome(ok ? m.onCorrect : m.onWrong, ok);
  }
  function handleSA(text) {
    if (!m) return;
    const ans = (m.content?.answer || '').trim().toLowerCase();
    const acceptable = (m.content?.acceptable || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
    const ok = [ans, ...acceptable].includes(String(text||'').trim().toLowerCase());
    if (slug && m?.id) recordAnswer(slug, m.id, { correct: ok, value: text });
    applyOutcome(ok ? m.onCorrect : m.onWrong, ok);
  }
  function handleStatementAck() {
    if (!m) return;
    if (slug && m?.id) recordAnswer(slug, m.id, { correct: true, value: 'ack' });
    applyOutcome(m.onCorrect, true);
  }

  function renderMission() {
    if (!m) return <div>Game complete!</div>;
    const a = m.appearanceOverrideEnabled ? (m.appearance || {}) : (config.appearance || {});
    const bodyStyle = missionBodyStyle(a);
    const label = (s) => <div style={{ ...labelStyle, textAlign:a.textAlign }}>{s}</div>;

    switch (m.type) {
      case 'multiple_choice': {
        const ch = (m.content?.choices || []);
        return (
          <div style={bodyStyle}>
            {label(m.content?.question || '')}
            <div style={{ display:'grid', gap:8 }}>
              {ch.map((c, i)=>(
                <button key={i} style={btn} onClick={()=>handleMC(i)}>{c}</button>
              ))}
            </div>
          </div>
        );
      }
      case 'short_answer': {
        return (
          <div style={bodyStyle}>
            {label(m.content?.question || '')}
            <input
              style={input}
              value={answerDraft}
              onChange={(e)=>setAnswerDraft(e.target.value)}
              onKeyDown={(e)=>{
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSA(answerDraft);
                }
              }}
              placeholder="Type your answer…"
            />
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button style={btn} onClick={()=>handleSA(answerDraft)}>Submit</button>
              <button style={btn} onClick={prev}>Back</button>
            </div>
          </div>
        );
      }
      case 'statement': {
        return (
          <div style={bodyStyle}>
            {label(m.content?.text || '')}
            <div style={{ textAlign:'right', marginTop:8 }}>
              <button style={btn} onClick={handleStatementAck}>✕ Acknowledge</button>
            </div>
          </div>
        );
      }
      case 'photo_opportunity': {
        const overlayUrl = resolveOverlayUrl(config, m.content?.overlayKey, m.content?.overlayUrl);
        return (
          <div style={bodyStyle}>
            {label(m.content?.text || 'Photo Opportunity')}
            <button style={btn} onClick={()=>setShowPhoto({ overlayUrl, title: 'Capture' })}>Open Camera</button>
          </div>
        );
      }
      default:
        return (
          <div style={bodyStyle}>
            {label('Unsupported mission type')}
            <div style={{ color:'#9fb0bf' }}>Type: {m.type}</div>
          </div>
        );
    }
  }

  return (
    <main style={outer}>

      {/* Backpack */}
      <BackpackButton onClick={()=>setBackpackOpen(true)} />
      <BackpackDrawer slug={slug} open={backpackOpen} onClose={()=>setBackpackOpen(false)} onMutate={refreshBackpack} />

      {/* Mission */}
      <div style={card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <div><b>{config.game?.title || 'Game'}</b> — <span style={{ color:'#9fb0bf' }}>Mission {idx+1} / {missions.length}</span></div>
          <div style={{ color:'#9fb0bf' }}>Points: {points}</div>
        </div>
        {missions.length ? renderMission() : (
          <div style={{ color:'#9fb0bf' }}>No missions available yet.</div>
        )}
      </div>

      {/* Photo overlay capture */}
      {showPhoto && (
        <PhotoCapture
          overlayUrl={showPhoto.overlayUrl}
          onCancel={()=>setShowPhoto(null)}
          onSave={(dataUrl)=>{
            if (slug) {
              addPhoto(slug, { dataUrl, title:'Captured' });
              if (m?.id) {
                recordAnswer(slug, m.id, { correct:true, value:'photo' });
              }
              refreshBackpack();
            }
            setShowPhoto(null);
            applyOutcome(m.onCorrect, true);
          }}
        />
      )}

      {/* Outcome modal */}
      <OutcomeModal open={!!outcome} outcome={outcome} onClose={()=>{ setOutcome(null); next(); }} />
    </main>
  );
}

/* helpers */

function missionBodyStyle(a) {
  const fontFamily = a.fontFamily || 'system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif';
  const fontSize   = (a.fontSizePx || 22) + 'px';
  const textBg     = `rgba(${hex(a.textBgColor||'#000')}, ${a.textBgOpacity ?? 0})`;
  const screenBg   = a.screenBgImage
    ? `linear-gradient(rgba(0,0,0,${a.screenBgOpacity??0}), rgba(0,0,0,${a.screenBgOpacity??0})), url(${toDirect(a.screenBgImage)}) center/cover no-repeat`
    : `linear-gradient(rgba(0,0,0,${a.screenBgOpacity??0}), rgba(0,0,0,${a.screenBgOpacity??0})), ${a.screenBgColor||'#000'}`;

  return {
    background: screenBg, padding:12, minHeight:260, display:'grid',
    alignContent: a.textVertical === 'center' ? 'center' : 'start',
    color: a.fontColor || '#fff', fontFamily, fontSize
  };
}
function hex(h){try{const s=h.replace('#','');const b=s.length===3?s.split('').map(c=>c+c).join(''):s;return `${parseInt(b.slice(0,2),16)}, ${parseInt(b.slice(2,4),16)}, ${parseInt(b.slice(4,6),16)}`;}catch{return'0,0,0';}}
const outer = { maxWidth: 960, margin:'0 auto', padding:12, minHeight:'100vh', background:'#0b0c10', color:'#e9eef2', fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif' };
const card  = { background:'#12181d', border:'1px solid #1f262d', borderRadius:12, padding:12, marginTop:12 };
const labelStyle = { background:'rgba(0,0,0,.25)', padding:'6px 10px', borderRadius:8, marginBottom:8 };
const btn   = { padding:'10px 12px', borderRadius:10, border:'1px solid #2a323b', background:'#1a2027', color:'#e9eef2', cursor:'pointer' };
const input = { padding:'10px 12px', borderRadius:10, border:'1px solid #2a323b', background:'#0b0c10', color:'#e9eef2', width:'100%' };

function resolveOverlayUrl(config, overlayKey, overlayUrl) {
  if (overlayUrl) return toDirect(overlayUrl);
  const list = config?.media?.overlays || [];
  const found = list.find(o => o.key === overlayKey || o.name === overlayKey);
  return found ? toDirect(found.url) : '';
}
