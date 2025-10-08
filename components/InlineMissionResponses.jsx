
import React from 'react';
import { MediaPreview } from './ui-kit';

/**
 * InlineMissionResponses.jsx
 * Simple, inline-only fields to live at the BOTTOM of the mission form.
 * No floating modals. Binds directly to editing.onCorrect / editing.onWrong.
 *
 * Usage (place near bottom of Edit Mission form, above Points and Save):
 *   <InlineMissionResponses editing={editing} setEditing={setEditing} inventory={inventory} />
 *
 * Requires: `inventory` array (from /api/list-media) if you want populated dropdowns.
 * If you already have inventory elsewhere, pass it in. Otherwise fetch it in parent.
 */
export default function InlineMissionResponses({ editing, setEditing, inventory = [] }) {
  if (!editing || !setEditing) return null;

  const imagesVideos = Array.isArray(inventory)
    ? inventory.filter(m =>
        /^(image|gif|video)$/i.test(m.type||'') ||
        /\.(png|jpg|jpeg|gif|webp|avif|mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(m.url||'')
      )
    : [];
  const audios = Array.isArray(inventory)
    ? inventory.filter(m =>
        /^audio$/i.test(m.type||'') ||
        /\.(mp3|wav|ogg|m4a|aiff|aif)(\?|#|$)/i.test(m.url||'')
      )
    : [];

  const S = {
    box: { border:'1px solid #2a323b', borderRadius:10, padding:12, margin:'12px 0', background:'#0c0f12' },
    hdr: { fontWeight:700, marginBottom:10, color:'#e9eef2' },
    sec: (bg) => ({ border:'1px solid #2a323b', borderRadius:8, padding:10, marginBottom:12, background:bg }),
    row: { display:'grid', gridTemplateColumns:'160px 1fr', gap:8, alignItems:'center', margin:'6px 0' },
    lab: { fontSize:12, color:'#9fb0bf' },
    inp: { padding:'10px 12px', borderRadius:10, border:'1px solid #2a323b', background:'#0b0c10', color:'#e9eef2', width:'100%' },
    btn: { padding:'6px 10px', borderRadius:8, border:'1px solid #2a323b', background:'#0b1115', color:'#e9eef2', cursor:'pointer' },
  };

  function toggle(kind, on) {
    if (kind==='correct') {
      if (on) setEditing(prev => ({ ...prev, onCorrect: prev.onCorrect || { statement:'', mediaUrl:'', audioUrl:'', durationSeconds:0, buttonText:'OK' } }));
      else   { const next = { ...editing }; delete next.onCorrect; setEditing(next); }
    } else {
      if (on) setEditing(prev => ({ ...prev, onWrong: prev.onWrong || { statement:'', mediaUrl:'', audioUrl:'', durationSeconds:0, buttonText:'OK' } }));
      else   { const next = { ...editing }; delete next.onWrong; setEditing(next); }
    }
  }

  function field(kind, key, value, onChange) {
    return (
      <div style={S.row}>
        <div style={S.lab}>{key}</div>
        {onChange}
      </div>
    );
  }

  return (
    <div style={S.box}>
      <div style={S.hdr}>Mission Responses</div>

      {/* Correct */}
      <div style={S.sec('#0b1115')}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <div style={{ fontWeight:600, color:'#e9eef2' }}>On Correct Answer</div>
          <label style={{ color:'#9fb0bf', fontSize:13 }}>
            <input
              type="checkbox"
              checked={!!editing.onCorrect}
              onChange={(e)=>{ toggle('correct', e.target.checked); }}
            /> Enable
          </label>
        </div>

        {editing.onCorrect ? (
          <>
            <div style={S.row}>
              <div style={S.lab}>Statement</div>
              <textarea
                style={{ ...S.inp, height:72 }}
                value={editing.onCorrect?.statement || ''}
                onChange={(e)=>setEditing({ ...editing, onCorrect:{ ...(editing.onCorrect||{}), statement:e.target.value } })}
              />
            </div>

            <div style={S.row}>
              <div style={S.lab}>Media (image/video)</div>
              <select
                style={S.inp}
                value={editing.onCorrect?.mediaUrl || ''}
                onChange={(e)=>setEditing({ ...editing, onCorrect:{ ...(editing.onCorrect||{}), mediaUrl:e.target.value } })}
              >
                <option value="">(none)</option>
                {imagesVideos.map((m,i)=>(
                  <option key={i} value={m.url}>{m.name || (m.url||'').split('/').pop()}</option>
                ))}
              </select>
            {/* Thumbnail preview */}
            <div style={{ gridColumn:'1 / span 2' }}>
              <MediaPreview url={editing.onCorrect?.mediaUrl} />
            </div>
            </div>

            <div style={S.row}>
              <div style={S.lab}>Audio (optional)</div>
              <select
                style={S.inp}
                value={editing.onCorrect?.audioUrl || ''}
                onChange={(e)=>setEditing({ ...editing, onCorrect:{ ...(editing.onCorrect||{}), audioUrl:e.target.value } })}
              >
                <option value="">(none)</option>
                {audios.map((m,i)=>(
                  <option key={i} value={m.url}>{m.name || (m.url||'').split('/').pop()}</option>
                ))}
              </select>
            {/* Audio preview */}
            <div style={{ gridColumn:'1 / span 2' }}>
              {editing.onCorrect?.audioUrl ? (<audio controls src={editing.onCorrect?.audioUrl} style={ width:'100%' } />) : null}
            </div>
            </div>

            <div style={S.row}>
              <div style={S.lab}>Auto-close after (seconds)</div>
              <input
                type="number" min={0} max={1200} style={S.inp}
                value={Number(editing.onCorrect?.durationSeconds||0)}
                onChange={(e)=>{
                  const v = Math.max(0, Number(e.target.value||0));
                  setEditing({ ...editing, onCorrect:{ ...(editing.onCorrect||{}), durationSeconds:v } });
                }}
              />
            </div>

            <div style={S.row}>
              <div style={S.lab}>Button label</div>
              <input
                style={S.inp}
                value={editing.onCorrect?.buttonText || 'OK'}
                onChange={(e)=>setEditing({ ...editing, onCorrect:{ ...(editing.onCorrect||{}), buttonText:e.target.value || 'OK' } })}
              />
            </div>
          </>
        ) : null}
      </div>

      {/* Wrong */

}
      <div style={S.sec('#110b0b')}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <div style={{ fontWeight:600, color:'#e9eef2' }}>On Wrong Answer</div>
          <label style={{ color:'#9fb0bf', fontSize:13 }}>
            <input
              type="checkbox"
              checked={!!editing.onWrong}
              onChange={(e)=>{ toggle('wrong', e.target.checked); }}
            /> Enable
          </label>
        </div>

        {editing.onWrong ? (
          <>
            <div style={S.row}>
              <div style={S.lab}>Statement</div>
              <textarea
                style={{ ...S.inp, height:72 }}
                value={editing.onWrong?.statement || ''}
                onChange={(e)=>setEditing({ ...editing, onWrong:{ ...(editing.onWrong||{}), statement:e.target.value } })}
              />
            </div>

            <div style={S.row}>
              <div style={S.lab}>Media (image/video)</div>
              <select
                style={S.inp}
                value={editing.onWrong?.mediaUrl || ''}
                onChange={(e)=>setEditing({ ...editing, onWrong:{ ...(editing.onWrong||{}), mediaUrl:e.target.value } })}
              >
                <option value="">(none)</option>
                {imagesVideos.map((m,i)=>(
                  <option key={i} value={m.url}>{m.name || (m.url||'').split('/').pop()}</option>
                ))}
              </select>
            {/* Thumbnail preview */}
            <div style={{ gridColumn:'1 / span 2' }}>
              <MediaPreview url={editing.onWrong?.mediaUrl} />
            </div>
            </div>

            <div style={S.row}>
              <div style={S.lab}>Audio (optional)</div>
              <select
                style={S.inp}
                value={editing.onWrong?.audioUrl || ''}
                onChange={(e)=>setEditing({ ...editing, onWrong:{ ...(editing.onWrong||{}), audioUrl:e.target.value } })}
              >
                <option value="">(none)</option>
                {audios.map((m,i)=>(
                  <option key={i} value={m.url}>{m.name || (m.url||'').split('/').pop()}</option>
                ))}
              </select>
            {/* Audio preview */}
            <div style={{ gridColumn:'1 / span 2' }}>
              {editing.onWrong?.audioUrl ? (<audio controls src={editing.onWrong?.audioUrl} style={ width:'100%' } />) : null}
            </div>
            </div>

            <div style={S.row}>
              <div style={S.lab}>Auto-close after (seconds)</div>
              <input
                type="number" min={0} max={1200} style={S.inp}
                value={Number(editing.onWrong?.durationSeconds||0)}
                onChange={(e)=>{
                  const v = Math.max(0, Number(e.target.value||0));
                  setEditing({ ...editing, onWrong:{ ...(editing.onWrong||{}), durationSeconds:v } });
                }}
              />
            </div>

            <div style={S.row}>
              <div style={S.lab}>Button label</div>
              <input
                style={S.inp}
                value={editing.onWrong?.buttonText || 'OK'}
                onChange={(e)=>setEditing({ ...editing, onWrong:{ ...(editing.onWrong||{}), buttonText:e.target.value || 'OK' } })}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}