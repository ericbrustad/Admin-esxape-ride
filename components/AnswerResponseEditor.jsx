import React, { useEffect, useState } from 'react';

/**
 * AnswerResponseEditor.jsx
 *
 * - Two independent overlays: Correct and Wrong.
 * - Overlays open ONLY when user clicks the corresponding "Edit" button.
 * - Inline "Open Correct" and "Open Wrong" buttons rendered at the bottom of the component
 *   (so when the component is placed near the modal's bottom they appear on the mission window).
 * - Enable checkbox toggles whether the response exists on the editing object.
 * - Overlays are fixed, high z-index, and disable background scrolling while open.
 * - Thumbnail preview in overlay for image/video; audio player for audio.
 * - Save / Cancel / Disable actions. Save writes into editing.onCorrect / editing.onWrong.
 *
 * Usage:
 *   <AnswerResponseEditor editing={editing} setEditing={setEditing} inventory={inventory} />
 */
export default function AnswerResponseEditor({ editing, setEditing, inventory }) {
  if (!editing || !setEditing) return null;

  const inv = Array.isArray(inventory) ? inventory : [];
  const imagesVideos = inv.filter(it =>
    /^(image|gif|video)$/i.test(it.type || '') ||
    /\.(png|jpg|jpeg|gif|webp|avif|mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(it.url || '')
  );
  const audios = inv.filter(it =>
    /^audio$/i.test(it.type || '') ||
    /\.(mp3|wav|ogg|m4a|aiff|aif)(\?|#|$)/i.test((it.url || ''))
  );

  // Overlay open states (always closed initially)
  const [openCorrect, setOpenCorrect] = useState(false);
  const [openWrong, setOpenWrong] = useState(false);

  // Local copies for editing to allow cancel
  const [localCorrect, setLocalCorrect] = useState(normalizeResponse(editing.onCorrect));
  const [localWrong, setLocalWrong] = useState(normalizeResponse(editing.onWrong));

  useEffect(() => { setLocalCorrect(normalizeResponse(editing.onCorrect)); }, [editing.onCorrect]);
  useEffect(() => { setLocalWrong(normalizeResponse(editing.onWrong)); }, [editing.onWrong]);

  // Prevent background scroll while any overlay is open
  useEffect(() => {
    const opened = openCorrect || openWrong;
    const prev = document.body.style.overflow;
    if (opened) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [openCorrect, openWrong]);

  const row = { display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8, alignItems: 'center', margin: '6px 0' };
  const lab = { fontSize: 13, color: '#9fb0bf' };
  const inp = { padding: '10px 12px', borderRadius: 8, border: '1px solid #2a323b', background: '#0b0c10', color: '#e9eef2', width: '100%' };
  const box = { border: '1px solid #2a323b', borderRadius: 10, padding: 10, margin: '8px 0', background: '#0c0f12' };
  const smallBtn = { padding: '6px 10px', borderRadius: 8, border: '1px solid #2a323b', background: '#0b1115', color: '#e9eef2', cursor: 'pointer' };
  const dangerBtn = { ...smallBtn, background: '#3a1b1b' };

  function normalizeResponse(obj) {
    return {
      statement: (obj && obj.statement) || '',
      mediaUrl: (obj && obj.mediaUrl) || '',
      audioUrl: (obj && obj.audioUrl) || '',
      durationSeconds: (obj && Number(obj.durationSeconds)) || 0,
      buttonText: (obj && obj.buttonText) || 'OK'
    };
  }

  function enableCorrect(enabled) {
    if (enabled) {
      setEditing(prev => ({ ...prev, onCorrect: prev.onCorrect ? prev.onCorrect : { statement:'', mediaUrl:'', audioUrl:'', durationSeconds:0, buttonText:'OK' } }));
    } else {
      setEditing(prev => { const copy = { ...prev }; delete copy.onCorrect; return copy; });
    }
  }
  function enableWrong(enabled) {
    if (enabled) {
      setEditing(prev => ({ ...prev, onWrong: prev.onWrong ? prev.onWrong : { statement:'', mediaUrl:'', audioUrl:'', durationSeconds:0, buttonText:'OK' } }));
    } else {
      setEditing(prev => { const copy = { ...prev }; delete copy.onWrong; return copy; });
    }
  }

  // Save/cancel for correct
  function saveCorrect() {
    const payload = {
      statement: String(localCorrect.statement || ''),
      mediaUrl: localCorrect.mediaUrl || '',
      audioUrl: localCorrect.audioUrl || '',
      durationSeconds: Number(localCorrect.durationSeconds || 0),
      buttonText: localCorrect.buttonText || 'OK'
    };
    setEditing(prev => ({ ...prev, onCorrect: payload }));
    setOpenCorrect(false);
  }
  function cancelCorrect() {
    setLocalCorrect(normalizeResponse(editing.onCorrect));
    setOpenCorrect(false);
  }
  function disableCorrectAndClose() {
    enableCorrect(false);
    setOpenCorrect(false);
  }

  // Save/cancel for wrong
  function saveWrong() {
    const payload = {
      statement: String(localWrong.statement || ''),
      mediaUrl: localWrong.mediaUrl || '',
      audioUrl: localWrong.audioUrl || '',
      durationSeconds: Number(localWrong.durationSeconds || 0),
      buttonText: localWrong.buttonText || 'OK'
    };
    setEditing(prev => ({ ...prev, onWrong: payload }));
    setOpenWrong(false);
  }
  function cancelWrong() {
    setLocalWrong(normalizeResponse(editing.onWrong));
    setOpenWrong(false);
  }
  function disableWrongAndClose() {
    enableWrong(false);
    setOpenWrong(false);
  }

  // Small thumbnail component
  function Thumb({ url }) {
    if (!url) return null;
    if (/\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(url)) {
      return <video src={url} style={{ maxWidth:120, maxHeight:80, borderRadius:6 }} />;
    }
    if (/\.(mp3|wav|ogg|m4a|aiff|aif)(\?|#|$)/i.test(url)) {
      return <div style={{ color:'#9fb0bf', fontSize:12 }}>Audio selected</div>;
    }
    return <img src={url} alt="thumb" style={{ maxWidth:120, maxHeight:80, objectFit:'cover', borderRadius:6 }} />;
  }

  // Modal overlay renderer
  function ResponseModal({ title, local, setLocal, onSave, onCancel, onDisable, mediaList, audioList, open }) {
    if (!open) return null;
    return (
      <div role="dialog" aria-modal="true" style={{
        position:'fixed', left:0, top:0, right:0, bottom:0,
        background:'rgba(0,0,0,0.65)', zIndex:2147483647,
        display:'flex', alignItems:'center', justifyContent:'center', padding:20
      }}>
        <div style={{ width: '880px', maxWidth:'100%', maxHeight:'92vh', overflow:'auto', background:'#0b0f12', border:'1px solid #2a323b', borderRadius:12, padding:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ color:'#e9eef2', fontWeight:700, fontSize:16 }}>{title}</div>
            <div style={{ display:'flex', gap:8 }}>
              <button style={smallBtn} onClick={() => { onCancel(); }}>Cancel</button>
              <button style={smallBtn} onClick={() => { onSave(); }}>Save</button>
              <button style={dangerBtn} onClick={() => { if (confirm('Disable this response?')) onDisable(); }}>Disable</button>
            </div>
          </div>

          <div style={{ ...box, marginBottom:8 }}>
            <div style={{ fontWeight:600, marginBottom:8 }}>Statement</div>
            <textarea value={local.statement} onChange={e=>setLocal({...local, statement:e.target.value})}
              style={{ ...inp, height:96 }} />
          </div>

          <div style={{ ...box, marginBottom:8 }}>
            <div style={{ display:'grid', gridTemplateColumns:'160px 1fr', gap:8, alignItems:'center' }}>
              <div style={lab}>Media (image/video)</div>
              <div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <select value={local.mediaUrl||''} onChange={e=>setLocal({...local, mediaUrl: e.target.value})} style={inp}>
                    <option value="">(none)</option>
                    {mediaList.map((m,i)=>(
                      <option key={i} value={m.url}>{m.name || m.url.replace(/^.*\//,'')}</option>
                    ))}
                  </select>
                  {local.mediaUrl ? <button style={smallBtn} onClick={()=>window.open(local.mediaUrl, '_blank')}>Open</button> : null}
                </div>
                <div style={{ marginTop:8 }}>
                  <Thumb url={local.mediaUrl} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ ...box, marginBottom:8 }}>
            <div style={{ display:'grid', gridTemplateColumns:'160px 1fr', gap:8, alignItems:'center' }}>
              <div style={lab}>Audio (optional)</div>
              <div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <select value={local.audioUrl||''} onChange={e=>setLocal({...local, audioUrl: e.target.value})} style={inp}>
                    <option value="">(none)</option>
                    {audioList.map((m,i)=>(
                      <option key={i} value={m.url}>{m.name || m.url.replace(/^.*\//,'')}</option>
                    ))}
                  </select>
                  {local.audioUrl ? <audio controls src={local.audioUrl} style={{ marginLeft:8 }} /> : null}
                </div>
              </div>
            </div>
          </div>

          <div style={{ ...box, marginBottom:8 }}>
            <div style={row}><div style={lab}>Auto-close after (seconds)</div>
              <input type="number" min={0} max={1200} value={local.durationSeconds||0}
                onChange={e=>setLocal({...local, durationSeconds: Math.max(0, Number(e.target.value||0))})}
                style={inp} />
            </div>
            <div style={row}><div style={lab}>Button label</div>
              <input value={local.buttonText||'OK'} onChange={e=>setLocal({...local, buttonText: e.target.value||'OK'})} style={inp} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Inline open handlers - ensure response exists before opening
  function openCorrectInline() {
    if (!editing.onCorrect) {
      enableCorrect(true);
    }
    // sync local copy immediately from editing (use effect will also pick up)
    setLocalCorrect(normalizeResponse(editing.onCorrect));
    setOpenCorrect(true);
  }
  function openWrongInline() {
    if (!editing.onWrong) {
      enableWrong(true);
    }
    setLocalWrong(normalizeResponse(editing.onWrong));
    setOpenWrong(true);
  }

  return (
    <div style={{ ...box }}>
      <div style={{ fontWeight:700, marginBottom:10, color:'#e9eef2' }}>Answer Responses (Correct / Wrong)</div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div style={{ padding:10, border:'1px solid #2a323b', borderRadius:8, background:'#0b1115' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <div style={{ fontWeight:600, color:'#e9eef2' }}>On Correct Answer</div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <label style={{ color:'#9fb0bf', fontSize:13 }}>
                <input type="checkbox" checked={!!editing.onCorrect} onChange={e=>enableCorrect(e.target.checked)} /> Enable
              </label>
              <button style={smallBtn} onClick={()=>{ if (editing.onCorrect) setOpenCorrect(true); else { enableCorrect(true); setOpenCorrect(true); } }}>
                Edit
              </button>
            </div>
          </div>

          <div style={{ color:'#9fb0bf', fontSize:13 }}>
            {editing.onCorrect ? (
              <div>
                <div style={{ marginBottom:6 }}>{editing.onCorrect.statement ? editing.onCorrect.statement.substring(0,120) : <i style={{color:'#7b8b95'}}>No statement</i>}</div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <Thumb url={editing.onCorrect.mediaUrl} />
                  {editing.onCorrect.audioUrl ? <div style={{ color:'#9fb0bf' }}>Audio selected</div> : null}
                </div>
              </div>
            ) : <div style={{ color:'#7b8b95' }}>Disabled</div>}
          </div>
        </div>

        <div style={{ padding:10, border:'1px solid #2a323b', borderRadius:8, background:'#110b0b' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <div style={{ fontWeight:600, color:'#e9eef2' }}>On Wrong Answer</div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <label style={{ color:'#9fb0bf', fontSize:13 }}>
                <input type="checkbox" checked={!!editing.onWrong} onChange={e=>enableWrong(e.target.checked)} /> Enable
              </label>
              <button style={smallBtn} onClick={()=>{ if (editing.onWrong) setOpenWrong(true); else { enableWrong(true); setOpenWrong(true); } }}>
                Edit
              </button>
            </div>
          </div>

          <div style={{ color:'#9fb0bf', fontSize:13 }}>
            {editing.onWrong ? (
              <div>
                <div style={{ marginBottom:6 }}>{editing.onWrong.statement ? editing.onWrong.statement.substring(0,120) : <i style={{color:'#7b8b95'}}>No statement</i>}</div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <Thumb url={editing.onWrong.mediaUrl} />
                  {editing.onWrong.audioUrl ? <div style={{ color:'#9fb0bf' }}>Audio selected</div> : null}
                </div>
              </div>
            ) : <div style={{ color:'#7b8b95' }}>Disabled</div>}
          </div>
        </div>
      </div>

      {/* Inline bottom buttons (non-floating) - place near modal bottom by inserting this component near bottom */}
      <div style={{ display:'flex', gap:8, marginTop:12 }}>
        <button style={smallBtn} onClick={openCorrectInline}>Open Correct Response</button>
        <button style={smallBtn} onClick={openWrongInline}>Open Wrong Response</button>
      </div>

      {/* Modals */}
      <ResponseModal
        title="Edit Correct Response"
        local={localCorrect}
        setLocal={setLocalCorrect}
        onSave={saveCorrect}
        onCancel={cancelCorrect}
        onDisable={disableCorrectAndClose}
        mediaList={imagesVideos}
        audioList={audios}
        open={openCorrect}
      />

      <ResponseModal
        title="Edit Wrong Response"
        local={localWrong}
        setLocal={setLocalWrong}
        onSave={saveWrong}
        onCancel={cancelWrong}
        onDisable={disableWrongAndClose}
        mediaList={imagesVideos}
        audioList={audios}
        open={openWrong}
      />
    </div>
  );
}
