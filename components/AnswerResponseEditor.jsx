import React from 'react';
import { ADMIN_THEME } from '../lib/admin-shared';

/* ───────────────── AnswerResponseEditor (Admin: Missions) ─────────────────
   Lets authors define mission.onCorrect / mission.onWrong:
   { statement, mediaUrl, audioUrl, durationSeconds, buttonText }
   - durationSeconds: 0 = require button
   - buttonText default: "OK"
   - Uses your /api/list-media inventory (uploads, bundles, icons)
----------------------------------------------------------------------------*/
const theme = ADMIN_THEME;

export default function AnswerResponseEditor({ editing, setEditing, inventory }) {
  const inv = Array.isArray(inventory) ? inventory : [];
  const imagesVideos = inv.filter(it => /^(image|gif|video)$/i.test(it.type||'') || /\.(png|jpg|jpeg|gif|webp|avif|mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(it.url||''));
  const audios = inv.filter(it => /^audio$/i.test(it.type||'') || /\.(mp3|wav|ogg|m4a|aiff|aif)(\?|#|$)/i.test((it.url||'')));

  const oC = editing?.onCorrect || {};
  const oW = editing?.onWrong   || {};

  function setOC(next) { setEditing(prev => ({ ...prev, onCorrect: { buttonText:'OK', ...(prev?.onCorrect||{}), ...next } })); }
  function setOW(next) { setEditing(prev => ({ ...prev, onWrong:   { buttonText:'OK', ...(prev?.onWrong  ||{}), ...next } })); }

  const row = { display:'grid', gridTemplateColumns:'160px 1fr', gap:8, alignItems:'center', margin:'6px 0' };
  const lab = { fontSize:12, color:theme.textMuted };
  const inputStyle = {
    width:'100%',
    padding:'10px 12px',
    borderRadius:12,
    border:theme.inputBorder,
    background:theme.inputBg,
    color:theme.inputColor,
  };
  const containerCard = {
    border: theme.panelBorder,
    borderRadius: 16,
    padding: 16,
    margin: '12px 0',
    background: theme.surfaceRaised,
    boxShadow: theme.panelShadow,
    color: theme.textPrimary,
  };
  const responseCard = (tone) => ({
    border: tone === 'neutral' ? theme.borderSoft : theme.panelBorder,
    borderRadius: 14,
    padding: 14,
    marginTop: tone === 'correct' ? 0 : 10,
    background: tone === 'correct'
      ? theme.successSurface
      : tone === 'wrong'
        ? theme.dangerSurface
        : theme.surfaceGlass,
    boxShadow: theme.panelShadow,
    color: theme.textPrimary,
  });

  const MediaPicker = ({ value, onChange, list }) => (
    <select value={value||''} onChange={e=>onChange(e.target.value||'')} style={inputStyle}>
      <option value="">(none)</option>
      {list.map((m,i)=>(<option key={i} value={m.url}>{m.name || m.url.replace(/^.*\//,'')}</option>))}
    </select>
  );

  return (
    <div style={containerCard}>
      <h4 style={{ margin:'4px 0 10px 0' }}>Answer Responses (Correct / Wrong)</h4>

      <div style={responseCard('correct')}>
        <div style={{ fontWeight:600, marginBottom:8 }}>On Correct Answer</div>
        <div style={row}><div style={lab}>Statement</div>
          <textarea style={{...inputStyle, height:72}} value={oC.statement||''} onChange={e=>setOC({ statement:e.target.value })}/>
        </div>
        <div style={row}><div style={lab}>Media (image/video)</div>
          <MediaPicker value={oC.mediaUrl} onChange={v=>setOC({ mediaUrl:v })} list={imagesVideos}/>
        </div>
        <div style={row}><div style={lab}>Audio (optional)</div>
          <MediaPicker value={oC.audioUrl} onChange={v=>setOC({ audioUrl:v })} list={audios}/>
        </div>
        <div style={row}><div style={lab}>Auto-close after (seconds)</div>
          <input type="number" min={0} max={1200} style={inputStyle} value={Number(oC.durationSeconds||0)}
                 onChange={e=>setOC({ durationSeconds: Math.max(0, Number(e.target.value||0)) })}/>
        </div>
        <div style={row}><div style={lab}>Button label</div>
          <input style={inputStyle} value={oC.buttonText || 'OK'} onChange={e=>setOC({ buttonText: e.target.value || 'OK' })}/>
        </div>
      </div>

      <div style={responseCard('wrong')}>
        <div style={{ fontWeight:600, marginBottom:8 }}>On Wrong Answer</div>
        <div style={row}><div style={lab}>Statement</div>
          <textarea style={{...inputStyle, height:72}} value={oW.statement||''} onChange={e=>setOW({ statement:e.target.value })}/>
        </div>
        <div style={row}><div style={lab}>Media (image/video)</div>
          <MediaPicker value={oW.mediaUrl} onChange={v=>setOW({ mediaUrl:v })} list={imagesVideos}/>
        </div>
        <div style={row}><div style={lab}>Audio (optional)</div>
          <MediaPicker value={oW.audioUrl} onChange={v=>setOW({ audioUrl:v })} list={audios}/>
        </div>
        <div style={row}><div style={lab}>Auto-close after (seconds)</div>
          <input type="number" min={0} max={1200} style={inputStyle} value={Number(oW.durationSeconds||0)}
                 onChange={e=>setOW({ durationSeconds: Math.max(0, Number(e.target.value||0)) })}/>
        </div>
        <div style={row}><div style={lab}>Button label</div>
          <input style={inputStyle} value={oW.buttonText || 'OK'} onChange={e=>setOW({ buttonText: e.target.value || 'OK' })}/>
        </div>
      </div>

      <div style={{ fontSize:12, color:theme.textMuted, marginTop:8 }}>
        Tip: leave <b>Auto‑close</b> at 0 to require a button click. Button label defaults to “OK”.
      </div>
    </div>
  );
}
