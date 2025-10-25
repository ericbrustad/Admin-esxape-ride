import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import PhotoCapture from '../components/PhotoCapture';
import OutcomeModal from '../components/OutcomeModal';
import BackpackButton from '../components/BackpackButton';
import BackpackDrawer from '../components/BackpackDrawer';
import {
  initBackpack,
  addPhoto,
  addReward,
  addUtility,
  addClue,
  addPoints,
  recordAnswer,
  onBackpackChange,
  getBackpackMap,
} from '../lib/backpack';
import { fetchGameBundle } from '../lib/supabase/client.js';
import { createMediaIndex, createMissionMap } from '../lib/mmaps';

const DEFAULT_SLUG = process.env.NEXT_PUBLIC_DEFAULT_GAME_SLUG || 'default';
const DEFAULT_CHANNEL = process.env.NEXT_PUBLIC_DEFAULT_CHANNEL || 'published';

function firstString(value) {
  if (Array.isArray(value)) return value[0] || '';
  return typeof value === 'string' ? value : '';
}

const SUPABASE_ENABLED = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function toDirect(u){ try{
  const url=new URL(u); const host=url.host.toLowerCase();
  if(host.endsWith('dropbox.com')){ url.host='dl.dropboxusercontent.com'; url.searchParams.delete('dl'); if(!url.searchParams.has('raw')) url.searchParams.set('raw','1'); return url.toString(); }
  if(host.endsWith('drive.google.com')){ let id=''; if(url.pathname.startsWith('/file/d/')){ id=url.pathname.split('/')[3]||''; } else if(url.pathname==='/open'){ id=url.searchParams.get('id')||''; } if(id) return `https://drive.google.com/uc?export=view&id=${id}`; }
  return u;
}catch{return u;}}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <pre style={{ maxWidth: 560, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </main>
      );
    }

    return this.props.children;
  }
}

function GameApp() {
  const router = useRouter();
  const [suite, setSuite] = useState(null);
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState('Loading…');
  const [idx, setIdx] = useState(0);
  const [showPhoto, setShowPhoto] = useState(null); // { overlayUrl, title }
  const [outcome, setOutcome] = useState(null);   // outcome config snapshot
  const [backpackOpen, setBackpackOpen] = useState(false);
  const [points, setPoints] = useState(0);

  const slugParam = firstString(router?.query?.slug);
  const gameParam = firstString(router?.query?.game);
  const channelParam = firstString(router?.query?.channel);

  const slug = slugParam || gameParam || (router?.isReady ? DEFAULT_SLUG : '');
  const channel = channelParam || DEFAULT_CHANNEL;

  useEffect(() => {
    if (!router?.isReady) return;

    const canonicalSlug = slugParam || gameParam;
    const canonicalChannel = channelParam || DEFAULT_CHANNEL;

    const nextQuery = { ...router.query };
    let changed = false;

    if (!canonicalSlug) {
      nextQuery.slug = DEFAULT_SLUG;
      if (nextQuery.game) {
        delete nextQuery.game;
      }
      changed = true;
    } else {
      if (firstString(nextQuery.slug) !== canonicalSlug) {
        nextQuery.slug = canonicalSlug;
        changed = true;
      }
      if (nextQuery.game) {
        delete nextQuery.game;
        changed = true;
      }
    }

    if (firstString(nextQuery.channel) !== canonicalChannel) {
      nextQuery.channel = canonicalChannel;
      changed = true;
    }

    if (changed) {
      router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
    }
  }, [router, slugParam, gameParam, channelParam]);

  useEffect(() => {
    if (!slug) return;
    initBackpack(slug);
  }, [slug]);

  useEffect(() => {
    if (!slug) return undefined;
    const update = () => {
      const map = getBackpackMap(slug);
      setPoints(Number(map.get('points')) || 0);
    };
    update();
    return onBackpackChange(slug, update);
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    setSuite(null);
    setConfig(null);
    setStatus('Loading…');
    setIdx(0);

    (async () => {
      if (!slug) {
        setStatus('Loading default game…');
        return;
      }

      try {
        if (SUPABASE_ENABLED) {
          const bundle = await fetchGameBundle({ slug, channel });
          if (cancelled) return;
          const missions = Array.isArray(bundle?.missions) ? bundle.missions : [];
          const devices = Array.isArray(bundle?.devices) ? bundle.devices : [];
          const configFromSupabase = bundle?.config && typeof bundle.config === 'object'
            ? { ...bundle.config }
            : {};
          if (!Array.isArray(configFromSupabase.devices)) {
            configFromSupabase.devices = devices;
          }
          if (!Array.isArray(configFromSupabase.powerups) && Array.isArray(devices)) {
            configFromSupabase.powerups = configFromSupabase.powerups || [];
          }
          setSuite({ missions });
          setConfig(configFromSupabase);
          setStatus('');
          return;
        }

        const base = channel === 'published' ? 'published' : 'draft';
        const missionsRes = await fetch(`/games/${encodeURIComponent(slug)}/${base}/missions.json`, { cache: 'no-store' });
        if (!missionsRes.ok) throw new Error(`missions ${missionsRes.status}`);
        const ms = await missionsRes.json();
        const cfg = await fetch(`/games/${encodeURIComponent(slug)}/${base}/config.json`, { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({}));
        if (cancelled) return;
        setSuite(ms);
        setConfig(cfg);
        setStatus('');
      } catch (e) {
        if (cancelled) return;
        console.error('Failed to load game bundle', e);
        setStatus('Failed to load game.');
      }
    })();

    return () => { cancelled = true; };
  }, [slug, channel]);

  const missionMemo = useMemo(() => {
    const map = createMissionMap(suite?.missions || []);
    return { map, order: Array.from(map.keys()) };
  }, [suite?.missions]);

  const missionMap = missionMemo.map;
  const missionOrder = missionMemo.order;
  const missionCount = missionOrder.length;
  const missionId = missionOrder[idx] || null;
  const mission = missionId ? missionMap.get(missionId) : null;

  useEffect(() => {
    if (!missionCount) {
      setIdx(0);
      return;
    }
    setIdx((current) => Math.min(current, missionCount - 1));
  }, [missionCount]);

  const rewardIndex = useMemo(
    () => createMediaIndex(config?.media?.rewards || []),
    [config],
  );
  const punishmentIndex = useMemo(
    () => createMediaIndex(config?.media?.punishments || []),
    [config],
  );
  const deviceIndex = useMemo(
    () => createMediaIndex(config?.devices || [], [
      (item) => item.key,
      (item) => item.id,
      (item) => item.type,
    ]),
    [config],
  );
  const overlayIndex = useMemo(
    () => createMediaIndex(config?.media?.overlays || [], [
      (item) => item.key,
      (item) => item.name,
    ]),
    [config],
  );

  if (!suite || !config) {
    return <main style={outer}><div style={card}>{status}</div></main>;
  }

  function next() { setIdx((i) => Math.min(i + 1, Math.max(missionOrder.length - 1, 0))); }
  function prev() { setIdx((i) => Math.max(i - 1, 0)); }

  function resolveOverlayUrl(overlayKey, overlayUrl) {
    if (overlayUrl) return toDirect(overlayUrl);
    if (!overlayKey) return '';
    const found = overlayIndex.get(String(overlayKey));
    return found && found.url ? toDirect(found.url) : '';
  }

  function applyOutcome(o, wasCorrect) {
    if (!o || !o.enabled) return next();
    if (wasCorrect && typeof mission?.rewards?.points === 'number') addPoints(slug, mission.rewards.points);

    if (o.rewardKey) {
      const rewardRow = rewardIndex.get(String(o.rewardKey));
      if (rewardRow) addReward(slug, { key: rewardRow.key || o.rewardKey, name: rewardRow.name || 'Reward', thumbUrl: rewardRow.thumbUrl || '' });
    }

    const utilKey = o.punishmentKey || o.deviceKey;
    if (utilKey) {
      const source = punishmentIndex.get(String(utilKey)) || deviceIndex.get(String(utilKey));
      addUtility(slug, {
        key: utilKey,
        name: source?.name || source?.title || 'Utility',
        thumbUrl: source?.thumbUrl || '',
      });
    }

    if (o.clueText) addClue(slug, o.clueText);

    setOutcome({
      title: wasCorrect ? 'Correct!' : 'Try Again',
      message: o.message,
      mediaUrl: o.mediaUrl ? toDirect(o.mediaUrl) : '',
      audioUrl: o.audioUrl ? toDirect(o.audioUrl) : '',
    });
  }

  function handleMC(answerIdx) {
    const ci = Number(mission?.content?.correctIndex);
    const ok = Number(answerIdx) === ci;
    recordAnswer(slug, mission?.id, { correct: ok, value: answerIdx });
    applyOutcome(ok ? mission?.onCorrect : mission?.onWrong, ok);
  }

  function handleSA(text) {
    const ans = (mission?.content?.answer || '').trim().toLowerCase();
    const acceptable = (mission?.content?.acceptable || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const normalized = String(text || '').trim().toLowerCase();
    const ok = [ans, ...acceptable].includes(normalized);
    recordAnswer(slug, mission?.id, { correct: ok, value: text });
    applyOutcome(ok ? mission?.onCorrect : mission?.onWrong, ok);
  }

  function handleStatementAck() {
    recordAnswer(slug, mission?.id, { correct: true, value: 'ack' });
    applyOutcome(mission?.onCorrect, true);
  }

  function renderMission() {
    if (!mission) return <div>Game complete!</div>;
    const appearance = mission.appearanceOverrideEnabled ? (mission.appearance || {}) : (config.appearance || {});
    const bodyStyle = missionBodyStyle(appearance);
    const label = (s) => <div style={{ ...labelStyle, textAlign:appearance.textAlign }}>{s}</div>;

    switch (mission.type) {
      case 'multiple_choice': {
        const ch = mission.content?.choices || [];
        return (
          <div style={bodyStyle}>
            {label(mission.content?.question || '')}
            <div style={{ display:'grid', gap:8 }}>
              {ch.map((c, i)=>(
                <button key={i} style={btn} onClick={()=>handleMC(i)}>{c}</button>
              ))}
            </div>
          </div>
        );
      }
      case 'short_answer': {
        let val='';
        return (
          <div style={bodyStyle}>
            {label(mission.content?.question || '')}
            <input style={input} onChange={(e)=>{ val=e.target.value; }} placeholder="Type your answer…"/>
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button style={btn} onClick={()=>handleSA(val)}>Submit</button>
              <button style={btn} onClick={prev}>Back</button>
            </div>
          </div>
        );
      }
      case 'statement': {
        return (
          <div style={bodyStyle}>
            {label(mission.content?.text || '')}
            <div style={{ textAlign:'right', marginTop:8 }}>
              <button style={btn} onClick={handleStatementAck}>✕ Acknowledge</button>
            </div>
          </div>
        );
      }
      case 'photo_opportunity': {
        const overlayUrl = resolveOverlayUrl(mission.content?.overlayKey, mission.content?.overlayUrl);
        return (
          <div style={bodyStyle}>
            {label(mission.content?.text || 'Photo Opportunity')}
            <button style={btn} onClick={()=>setShowPhoto({ overlayUrl, title: 'Capture' })}>Open Camera</button>
          </div>
        );
      }
      default:
        return (
          <div style={bodyStyle}>
            {label('Unsupported mission type')}
            <div style={{ color:'#9fb0bf' }}>Type: {mission.type}</div>
          </div>
        );
    }
  }

  return (
    <main style={outer}>

      <BackpackButton onClick={()=>setBackpackOpen(true)} />
      <BackpackDrawer slug={slug} open={backpackOpen} onClose={()=>setBackpackOpen(false)} />

      <div style={card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <div><b>{config.game?.title || 'Game'}</b> — <span style={{ color:'#9fb0bf' }}>Mission {missionCount ? idx+1 : 0} / {missionCount}</span></div>
          <div style={{ color:'#9fb0bf' }}>Points: {points}</div>
        </div>
        {renderMission()}
      </div>

      {showPhoto && (
        <PhotoCapture
          overlayUrl={showPhoto.overlayUrl}
          onCancel={()=>setShowPhoto(null)}
          onSave={(dataUrl)=>{
            addPhoto(slug, { dataUrl, title:'Captured' });
            setShowPhoto(null);
            recordAnswer(slug, mission?.id, { correct:true, value:'photo' });
            applyOutcome(mission?.onCorrect, true);
          }}
        />
      )}

      <OutcomeModal open={!!outcome} outcome={outcome} onClose={()=>{ setOutcome(null); next(); }} />
    </main>
  );
}

export default function Home() {
  return (
    <ErrorBoundary>
      <GameApp />
    </ErrorBoundary>
  );
}

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
    color: a.fontColor || '#fff', fontFamily, fontSize,
    backdropFilter: textBg.includes('rgba') ? 'blur(1px)' : undefined,
  };
}

function hex(h){try{const s=h.replace('#','');const b=s.length===3?s.split('').map(c=>c+c).join(''):s;return `${parseInt(b.slice(0,2),16)}, ${parseInt(b.slice(2,4),16)}, ${parseInt(b.slice(4,6),16)}`;}catch{return'0,0,0';}}

const outer = { maxWidth: 960, margin:'0 auto', padding:12, minHeight:'100vh', background:'#0b0c10', color:'#e9eef2', fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif' };
const card  = { background:'#12181d', border:'1px solid #1f262d', borderRadius:12, padding:12, marginTop:12 };
const labelStyle = { background:'rgba(0,0,0,.25)', padding:'6px 10px', borderRadius:8, marginBottom:8 };
const btn   = { padding:'10px 12px', borderRadius:10, border:'1px solid #2a323b', background:'#1a2027', color:'#e9eef2', cursor:'pointer' };
const input = { padding:'10px 12px', borderRadius:10, border:'1px solid #2a323b', background:'#0b0c10', color:'#e9eef2', width:'100%' };
