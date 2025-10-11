import React, { useEffect, useMemo, useState } from 'react';
import PhotoCapture from '../components/PhotoCapture';
import OutcomeModal from '../components/OutcomeModal';
import BackpackButton from '../components/BackpackButton';
import BackpackDrawer from '../components/BackpackDrawer';
import {
  initBackpack, getBackpack, addPhoto, addReward, addUtility, addClue,
  addPoints, recordAnswer
} from '../lib/backpack';
import { appearanceBackgroundStyle, normalizeTone, surfaceStylesFromAppearance, clamp } from '../../lib/admin-shared';

function toDirect(u){ try{
  const url=new URL(u); const host=url.host.toLowerCase();
  if(host.endsWith('dropbox.com')){ url.host='dl.dropboxusercontent.com'; url.searchParams.delete('dl'); if(!url.searchParams.has('raw')) url.searchParams.set('raw','1'); return url.toString(); }
  if(host.endsWith('drive.google.com')){ let id=''; if(url.pathname.startsWith('/file/d/')){ id=url.pathname.split('/')[3]||''; } else if(url.pathname==='/open'){ id=url.searchParams.get('id')||''; } if(id) return `https://drive.google.com/uc?export=view&id=${id}`; }
  return u;
}catch{return u;}}

export default function Game() {
  const [suite, setSuite] = useState(null);
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState('Loading…');
  const [idx, setIdx] = useState(0);

  const [showPhoto, setShowPhoto] = useState(null); // { overlayUrl, title }
  const [outcome, setOutcome]   = useState(null);   // object from mission.onCorrect/onWrong
  const [backpackOpen, setBackpackOpen] = useState(false);

  const tone = normalizeTone(config?.appearanceTone);
  const appearance = config?.appearance || {};
  const palette = paletteForTone(tone);
  const surfaces = surfaceStylesFromAppearance(appearance, tone);
  const outerStyle = makeOuterStyle(appearance, tone);
  const cardStyle = makeCardStyle(palette, surfaces);
  const buttonStyle = makeButtonStyle(palette, appearance);
  const inputStyle = makeInputStyle(palette, appearance);
  const labelBase = makeLabelBase(palette, tone, appearance);
  const subtleColor = palette.subtle;

  const { slug, channel } = useMemo(() => {
    const u = new URL(window.location.href);
    return { slug: u.searchParams.get('slug') || '', channel: u.searchParams.get('channel') || 'published' };
  }, []);

  useEffect(() => { initBackpack(slug); }, [slug]);

  useEffect(() => {
    if (!config || typeof document === 'undefined') return undefined;
    const body = document.body;
    if (!body) return undefined;
    const previous = {
      tone: body.dataset.tone || '',
      backgroundColor: body.style.backgroundColor,
      backgroundImage: body.style.backgroundImage,
      backgroundSize: body.style.backgroundSize,
      backgroundRepeat: body.style.backgroundRepeat,
      backgroundPosition: body.style.backgroundPosition,
      backgroundBlendMode: body.style.backgroundBlendMode,
    };
    const bg = appearanceBackgroundStyle(appearance, tone);
    body.dataset.tone = tone;
    body.style.backgroundColor = bg.backgroundColor || '';
    body.style.backgroundImage = bg.backgroundImage || 'none';
    body.style.backgroundSize = bg.backgroundSize || '';
    body.style.backgroundRepeat = bg.backgroundRepeat || '';
    body.style.backgroundPosition = bg.backgroundPosition || '';
    body.style.backgroundBlendMode = bg.backgroundBlendMode || '';
    return () => {
      body.dataset.tone = previous.tone;
      body.style.backgroundColor = previous.backgroundColor;
      body.style.backgroundImage = previous.backgroundImage;
      body.style.backgroundSize = previous.backgroundSize;
      body.style.backgroundRepeat = previous.backgroundRepeat;
      body.style.backgroundPosition = previous.backgroundPosition;
      body.style.backgroundBlendMode = previous.backgroundBlendMode;
    };
  }, [
    config,
    appearance.screenBgImage,
    appearance.screenBgImageEnabled,
    appearance.screenBgOpacity,
    appearance.screenBgColor,
    tone,
  ]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const body = document.body;
    const root = document.documentElement;
    if (!body || !root) return undefined;

    const previous = {
      fontFamily: root.style.getPropertyValue('--appearance-font-family'),
      fontSize: root.style.getPropertyValue('--appearance-font-size'),
      fontColor: root.style.getPropertyValue('--appearance-font-color'),
      textBg: root.style.getPropertyValue('--appearance-text-bg'),
      panelBg: body.style.getPropertyValue('--appearance-panel-bg'),
      panelBorder: body.style.getPropertyValue('--appearance-panel-border'),
      panelShadow: body.style.getPropertyValue('--appearance-panel-shadow'),
      pipingOpacity: body.style.getPropertyValue('--appearance-piping-opacity'),
      pipingShadow: body.style.getPropertyValue('--appearance-piping-shadow'),
      panelSurface: body.style.getPropertyValue('--appearance-panel-surface'),
      screenOverlay: body.style.getPropertyValue('--appearance-screen-overlay'),
      panelDepth: body.dataset.panelDepth || '',
      bodyColor: body.style.getPropertyValue('--admin-body-color'),
      mutedColor: body.style.getPropertyValue('--admin-muted'),
      inputBg: body.style.getPropertyValue('--admin-input-bg'),
      inputBorder: body.style.getPropertyValue('--admin-input-border'),
      inputColor: body.style.getPropertyValue('--admin-input-color'),
      buttonColor: body.style.getPropertyValue('--admin-button-color'),
    };

    const fontSizePx = clamp(Number(appearance?.fontSizePx ?? 22), 10, 72);
    const overlay = clamp(Number(appearance?.screenBgOpacity ?? 0), 0, 1);
    const textColor = tone === 'dark' ? '#f4f7ff' : (appearance?.fontColor || '#1f2d3a');
    const textBg = `rgba(${hex(appearance?.textBgColor || '#000000')}, ${clamp(Number(appearance?.textBgOpacity ?? 0), 0, 1)})`;
    const surfacesLocal = surfaceStylesFromAppearance(appearance, tone);
    const mutedColor = tone === 'dark'
      ? 'rgba(198, 212, 236, 0.78)'
      : 'rgba(36, 52, 72, 0.68)';
    const inputBg = tone === 'dark'
      ? `rgba(12, 18, 28, ${clamp(0.78 + overlay * 0.12, 0.72, 0.92)})`
      : `rgba(255, 255, 255, ${clamp(0.88 - overlay * 0.28, 0.55, 0.97)})`;
    const inputBorder = tone === 'dark'
      ? '1px solid rgba(132, 176, 226, 0.42)'
      : '1px solid rgba(128, 156, 204, 0.42)';
    const buttonColor = tone === 'dark' ? '#f4f7ff' : '#0e1c2e';

    if (appearance?.fontFamily) root.style.setProperty('--appearance-font-family', appearance.fontFamily);
    else root.style.removeProperty('--appearance-font-family');
    root.style.setProperty('--appearance-font-size', `${fontSizePx}px`);
    root.style.setProperty('--appearance-font-color', textColor);
    root.style.setProperty('--appearance-text-bg', textBg);

    body.style.setProperty('--appearance-panel-bg', surfacesLocal.panelBg);
    body.style.setProperty('--appearance-panel-border', surfacesLocal.panelBorder);
    body.style.setProperty('--appearance-panel-shadow', surfacesLocal.panelShadow);
    body.style.setProperty('--appearance-piping-opacity', String(surfacesLocal.pipingOpacity));
    body.style.setProperty('--appearance-piping-shadow', surfacesLocal.pipingShadow);
    body.style.setProperty('--appearance-screen-overlay', String(overlay));
    body.style.setProperty('--admin-body-color', textColor);
    body.style.setProperty('--admin-muted', mutedColor);
    body.style.setProperty('--admin-input-bg', inputBg);
    body.style.setProperty('--admin-input-border', inputBorder);
    body.style.setProperty('--admin-input-color', textColor);
    body.style.setProperty('--admin-button-color', buttonColor);

    if (appearance?.screenBgImage && appearance?.screenBgImageEnabled !== false) {
      body.style.setProperty('--appearance-panel-surface', 'none');
    } else {
      body.style.removeProperty('--appearance-panel-surface');
    }
    body.dataset.panelDepth = appearance?.panelDepth === false ? 'flat' : 'deep';

    return () => {
      if (previous.fontFamily) root.style.setProperty('--appearance-font-family', previous.fontFamily);
      else root.style.removeProperty('--appearance-font-family');
      if (previous.fontSize) root.style.setProperty('--appearance-font-size', previous.fontSize);
      else root.style.removeProperty('--appearance-font-size');
      if (previous.fontColor) root.style.setProperty('--appearance-font-color', previous.fontColor);
      else root.style.removeProperty('--appearance-font-color');
      if (previous.textBg) root.style.setProperty('--appearance-text-bg', previous.textBg);
      else root.style.removeProperty('--appearance-text-bg');
      if (previous.panelBg) body.style.setProperty('--appearance-panel-bg', previous.panelBg);
      else body.style.removeProperty('--appearance-panel-bg');
      if (previous.panelBorder) body.style.setProperty('--appearance-panel-border', previous.panelBorder);
      else body.style.removeProperty('--appearance-panel-border');
      if (previous.panelShadow) body.style.setProperty('--appearance-panel-shadow', previous.panelShadow);
      else body.style.removeProperty('--appearance-panel-shadow');
      if (previous.pipingOpacity) body.style.setProperty('--appearance-piping-opacity', previous.pipingOpacity);
      else body.style.removeProperty('--appearance-piping-opacity');
      if (previous.pipingShadow) body.style.setProperty('--appearance-piping-shadow', previous.pipingShadow);
      else body.style.removeProperty('--appearance-piping-shadow');
      if (previous.panelSurface) body.style.setProperty('--appearance-panel-surface', previous.panelSurface);
      else body.style.removeProperty('--appearance-panel-surface');
      if (previous.screenOverlay) body.style.setProperty('--appearance-screen-overlay', previous.screenOverlay);
      else body.style.removeProperty('--appearance-screen-overlay');
      if (previous.panelDepth) body.dataset.panelDepth = previous.panelDepth;
      else body.removeAttribute('data-panel-depth');
      if (previous.bodyColor) body.style.setProperty('--admin-body-color', previous.bodyColor);
      else body.style.removeProperty('--admin-body-color');
      if (previous.mutedColor) body.style.setProperty('--admin-muted', previous.mutedColor);
      else body.style.removeProperty('--admin-muted');
      if (previous.inputBg) body.style.setProperty('--admin-input-bg', previous.inputBg);
      else body.style.removeProperty('--admin-input-bg');
      if (previous.inputBorder) body.style.setProperty('--admin-input-border', previous.inputBorder);
      else body.style.removeProperty('--admin-input-border');
      if (previous.inputColor) body.style.setProperty('--admin-input-color', previous.inputColor);
      else body.style.removeProperty('--admin-input-color');
      if (previous.buttonColor) body.style.setProperty('--admin-button-color', previous.buttonColor);
      else body.style.removeProperty('--admin-button-color');
    };
  }, [
    appearance.fontFamily,
    appearance.fontSizePx,
    appearance.fontColor,
    appearance.textBgColor,
    appearance.textBgOpacity,
    appearance.screenBgColor,
    appearance.screenBgOpacity,
    appearance.screenBgImage,
    appearance.screenBgImageEnabled,
    appearance.panelDepth,
    tone,
  ]);

  useEffect(() => { (async () => {
    try {
      const base = channel === 'published' ? 'published' : 'draft';
      const ms = await fetch(`/games/${encodeURIComponent(slug)}/${base}/missions.json`, { cache:'no-store' }).then(r=>r.json());
      const cfg = await fetch(`/games/${encodeURIComponent(slug)}/${base}/config.json`,   { cache:'no-store' }).then(r=>r.json()).catch(()=> ({}));
      setSuite(ms); setConfig(cfg); setStatus('');
    } catch (e) {
      setStatus('Failed to load game.');
    }
  })(); }, [slug, channel]);

  if (!suite || !config) {
    return <main style={outerStyle}><div style={cardStyle}>{status}</div></main>;
  }

  const missions = suite.missions || [];
  const m = missions[idx];

  function next() { setIdx(i => Math.min(i + 1, missions.length - 1)); }
  function prev() { setIdx(i => Math.max(i - 1, 0)); }

  function applyOutcome(o, wasCorrect) {
    if (!o || !o.enabled) return next();
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

    // Show visual outcome
    setOutcome({
      title: wasCorrect ? 'Correct!' : 'Try Again',
      message: o.message,
      mediaUrl: o.mediaUrl ? toDirect(o.mediaUrl) : '',
      audioUrl: o.audioUrl ? toDirect(o.audioUrl) : ''
    });
  }

  function handleMC(answerIdx) {
    const ci = Number(m.content?.correctIndex);
    const ok = Number(answerIdx) === ci;
    recordAnswer(slug, m.id, { correct: ok, value: answerIdx });
    applyOutcome(ok ? m.onCorrect : m.onWrong, ok);
  }
  function handleSA(text) {
    const ans = (m.content?.answer || '').trim().toLowerCase();
    const acceptable = (m.content?.acceptable || '').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
    const ok = [ans, ...acceptable].includes(String(text||'').trim().toLowerCase());
    recordAnswer(slug, m.id, { correct: ok, value: text });
    applyOutcome(ok ? m.onCorrect : m.onWrong, ok);
  }
  function handleStatementAck() {
    recordAnswer(slug, m.id, { correct: true, value: 'ack' });
    applyOutcome(m.onCorrect, true);
  }

  function renderMission() {
    if (!m) return <div>Game complete!</div>;
    const a = m.appearanceOverrideEnabled ? (m.appearance || {}) : (config.appearance || {});
    const bodyStyle = missionBodyStyle(a, tone);
    const labelBg = tone === 'dark'
      ? `rgba(8, 12, 20, ${Math.max(a.textBgOpacity ?? 0.6, 0.45)})`
      : `rgba(${hex(a.textBgColor||'#000')}, ${Math.max(a.textBgOpacity ?? 0.25, 0.1)})`;
    const label = (s) => (
      <div
        style={{
          ...labelBase,
          background: labelBg,
          color: tone === 'dark' ? '#f4f7ff' : (a.fontColor || palette.text),
          textAlign:a.textAlign,
        }}
      >
        {s}
      </div>
    );

    switch (m.type) {
      case 'multiple_choice': {
        const ch = (m.content?.choices || []);
        return (
          <div style={bodyStyle}>
            {label(m.content?.question || '')}
            <div style={{ display:'grid', gap:8 }}>
              {ch.map((c, i)=>(
                <button key={i} style={buttonStyle} onClick={()=>handleMC(i)}>{c}</button>
              ))}
            </div>
          </div>
        );
      }
      case 'short_answer': {
        let val='';
        return (
          <div style={bodyStyle}>
            {label(m.content?.question || '')}
            <input style={inputStyle} onChange={(e)=>{ val=e.target.value; }} placeholder="Type your answer…"/>
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button style={buttonStyle} onClick={()=>handleSA(val)}>Submit</button>
              <button style={buttonStyle} onClick={prev}>Back</button>
            </div>
          </div>
        );
      }
      case 'statement': {
        return (
          <div style={bodyStyle}>
            {label(m.content?.text || '')}
            <div style={{ textAlign:'right', marginTop:8 }}>
              <button style={buttonStyle} onClick={handleStatementAck}>✕ Acknowledge</button>
            </div>
          </div>
        );
      }
      case 'photo_opportunity': {
        const overlayUrl = resolveOverlayUrl(config, m.content?.overlayKey, m.content?.overlayUrl);
        return (
          <div style={bodyStyle}>
            {label(m.content?.text || 'Photo Opportunity')}
            <button style={buttonStyle} onClick={()=>setShowPhoto({ overlayUrl, title: 'Capture' })}>Open Camera</button>
          </div>
        );
      }
      default:
        return (
          <div style={bodyStyle}>
            {label('Unsupported mission type')}
            <div style={{ color:subtleColor }}>Type: {m.type}</div>
          </div>
        );
    }
  }

  return (
    <main style={outerStyle}>

      {/* Backpack */}
      <BackpackButton onClick={()=>setBackpackOpen(true)} />
      <BackpackDrawer slug={slug} open={backpackOpen} onClose={()=>setBackpackOpen(false)} />

      {/* Mission */}
      <div style={cardStyle}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <div><b>{config.game?.title || 'Game'}</b> — <span style={{ color:subtleColor }}>Mission {idx+1} / {missions.length}</span></div>
          <div style={{ color:subtleColor }}>Points: {getBackpack(slug).points || 0}</div>
        </div>
        {renderMission()}
      </div>

      {/* Photo overlay capture */}
      {showPhoto && (
        <PhotoCapture
          overlayUrl={showPhoto.overlayUrl}
          onCancel={()=>setShowPhoto(null)}
          onSave={(dataUrl)=>{
            addPhoto(slug, { dataUrl, title:'Captured' });
            setShowPhoto(null);
            recordAnswer(slug, m.id, { correct:true, value:'photo' });
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

function missionBodyStyle(a, tone) {
  const fontFamily = a.fontFamily || 'system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif';
  const fontSize   = (a.fontSizePx || 22) + 'px';
  const normalizedTone = normalizeTone(tone);
  const overlayBase = Number(a.screenBgOpacity ?? 0);
  const overlay = normalizedTone === 'dark'
    ? Math.min(0.85, Math.max(overlayBase, 0.55))
    : overlayBase;
  const gradientLayers = [];
  if (normalizedTone === 'dark') {
    gradientLayers.push('rgba(6, 10, 18, 0.65)');
  }
  if (overlay > 0) {
    gradientLayers.push(`rgba(0, 0, 0, ${overlay})`);
  }
  const imageEnabled = a.screenBgImage && a.screenBgImageEnabled !== false;
  const baseColor = normalizedTone === 'dark'
    ? (a.screenBgColor || '#050a14')
    : (a.screenBgColor || '#000');
  let screenBg;
  if (imageEnabled) {
    const url = toDirect(a.screenBgImage);
    const gradient = gradientLayers.length ? `linear-gradient(${gradientLayers.join(', ')})` : '';
    screenBg = gradient ? `${gradient}, url(${url}) center/cover no-repeat` : `url(${url}) center/cover no-repeat`;
  } else if (gradientLayers.length) {
    screenBg = `linear-gradient(${gradientLayers.join(', ')}), ${baseColor}`;
  } else {
    screenBg = baseColor;
  }

  const textColor = normalizedTone === 'dark' ? '#f4f7ff' : (a.fontColor || '#fff');

  return {
    background: screenBg,
    padding:12,
    minHeight:260,
    display:'grid',
    alignContent: a.textVertical === 'center' ? 'center' : 'start',
    color: textColor,
    fontFamily,
    fontSize,
    textShadow: normalizedTone === 'dark' ? '0 2px 12px rgba(0,0,0,0.45)' : 'none',
    borderRadius:12,
    backdropFilter: imageEnabled ? 'blur(1px)' : 'none',
    backgroundBlendMode: imageEnabled ? (normalizedTone === 'dark' ? 'normal,normal' : 'soft-light,normal') : 'normal',
  };
}
function hex(h){try{const s=h.replace('#','');const b=s.length===3?s.split('').map(c=>c+c).join(''):s;return `${parseInt(b.slice(0,2),16)}, ${parseInt(b.slice(2,4),16)}, ${parseInt(b.slice(4,6),16)}`;}catch{return'0,0,0';}}
const BASE_OUTER = {
  maxWidth: 960,
  margin:'0 auto',
  padding:12,
  minHeight:'100vh',
  fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif',
};

const TONE_PALETTES = {
  light: {
    text:'#1f2d3a',
    subtle:'#5f748c',
    cardBg:'rgba(255,255,255,0.9)',
    cardBorder:'1px solid rgba(34,48,74,0.14)',
    cardShadow:'0 22px 42px rgba(32,56,92,0.18)',
    buttonBg:'linear-gradient(135deg, rgba(246,249,255,0.95), rgba(222,232,250,0.92))',
    buttonBorder:'1px solid rgba(120,150,200,0.28)',
    buttonColor:'#1f2d3a',
    inputBg:'rgba(255,255,255,0.92)',
    inputBorder:'1px solid rgba(130,156,198,0.28)',
    inputColor:'#1f2d3a',
  },
  dark: {
    text:'#f4f7ff',
    subtle:'#96abc6',
    cardBg:'rgba(10,16,24,0.84)',
    cardBorder:'1px solid rgba(98,136,194,0.32)',
    cardShadow:'0 26px 52px rgba(0,0,0,0.58)',
    buttonBg:'linear-gradient(135deg, rgba(94,142,226,0.94), rgba(50,82,150,0.94))',
    buttonBorder:'1px solid rgba(114,154,216,0.5)',
    buttonColor:'#f4f8ff',
    inputBg:'rgba(12,18,28,0.82)',
    inputBorder:'1px solid rgba(118,158,220,0.32)',
    inputColor:'#f4f7ff',
  },
};

function paletteForTone(tone) {
  return TONE_PALETTES[tone] || TONE_PALETTES.light;
}

function makeOuterStyle(appearance, tone) {
  const layers = appearanceBackgroundStyle(appearance, tone);
  const palette = paletteForTone(tone);
  return {
    ...BASE_OUTER,
    color: tone === 'dark' ? '#f4f7ff' : (appearance.fontColor || palette.text),
    backgroundColor: layers.backgroundColor,
    backgroundImage: layers.backgroundImage || undefined,
    backgroundSize: layers.backgroundSize || undefined,
    backgroundRepeat: layers.backgroundRepeat || undefined,
    backgroundPosition: layers.backgroundPosition || undefined,
    backgroundBlendMode: layers.backgroundBlendMode || undefined,
    fontFamily: appearance.fontFamily || BASE_OUTER.fontFamily,
  };
}

function makeCardStyle(palette, surfaces) {
  return {
    background: surfaces.panelBg || palette.cardBg,
    border: surfaces.panelBorder || palette.cardBorder,
    borderRadius:18,
    padding:18,
    marginTop:16,
    boxShadow: surfaces.panelShadow || palette.cardShadow,
    backdropFilter:'blur(10px)',
  };
}

function makeButtonStyle(palette, appearance) {
  return {
    padding:'10px 14px',
    borderRadius:12,
    border: palette.buttonBorder,
    background: palette.buttonBg,
    color: palette.buttonColor,
    cursor:'pointer',
    fontWeight:600,
    fontFamily: appearance.fontFamily || 'inherit',
    boxShadow:'0 8px 18px rgba(0,0,0,0.2)',
    transition:'transform 0.15s ease, box-shadow 0.15s ease',
  };
}

function makeInputStyle(palette, appearance) {
  return {
    padding:'10px 12px',
    borderRadius:12,
    border: palette.inputBorder,
    background: palette.inputBg,
    color: palette.inputColor,
    fontFamily: appearance.fontFamily || 'inherit',
    width:'100%',
  };
}

function makeLabelBase(palette, tone, appearance) {
  return {
    borderRadius:10,
    padding:'8px 12px',
    marginBottom:8,
    fontWeight:600,
    fontFamily: appearance.fontFamily || 'inherit',
    boxShadow: tone === 'dark' ? '0 6px 24px rgba(0,0,0,0.55)' : '0 4px 18px rgba(32,48,72,0.16)',
  };
}

function resolveOverlayUrl(config, overlayKey, overlayUrl) {
  if (overlayUrl) return toDirect(overlayUrl);
  const list = config?.media?.overlays || [];
  const found = list.find(o => o.key === overlayKey || o.name === overlayKey);
  return found ? toDirect(found.url) : '';
}
