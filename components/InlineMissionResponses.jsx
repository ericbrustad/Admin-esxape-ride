import React from 'react';

/**
 * InlineMissionResponses.jsx
 * Minimal, safe replacement component to avoid previous syntax issues.
 *
 * Props:
 *  - editing: object (mission being edited)
 *  - setEditing: function to update mission
 *  - inventory: array of media items { url, name? }
 *
 * This component intentionally keeps logic simple to ensure it compiles in Next.js.
 */

export default function InlineMissionResponses({ editing, setEditing, inventory = [] }) {
  if (!editing || typeof setEditing !== 'function') return null;

  const inv = Array.isArray(inventory) ? inventory : [];

  function update(side, patch) {
    setEditing({ ...editing, [side]: { ...(editing[side] || {}), ...patch } });
  }

  function clear(side) {
    update(side, { mediaUrl: '', audioUrl: '', isTrigger: false });
  }

  function toggleTrigger(side) {
    const cur = !!(editing?.[side]?.isTrigger);
    update(side, { isTrigger: !cur });
  }

  function chooseMedia(side, url) {
    update(side, { mediaUrl: url || '' });
  }

  function chooseAudio(side, url) {
    update(side, { audioUrl: url || '' });
  }

  const mediaItems = inv.filter(i => /\.(png|jpg|jpeg|webp|gif|mp4|webm|mov)(\?|#|$)/i.test(String(i.url||'')));
  const audioItems = inv.filter(i => /\.(mp3|wav|ogg|m4a|aiff|aif)(\?|#|$)/i.test(String(i.url||'')));

  function Panel({ side, title }) {
    const cur = editing[side] || {};
    const mediaUrl = cur.mediaUrl || '';
    const audioUrl = cur.audioUrl || '';

    return (
      <div style={{
        border: '1px solid #22303c',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
        background: '#071213'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <strong style={{ fontSize: 14 }}>{title}</strong>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ color:'#cfeee0', fontSize:13 }}>
              <input type="checkbox" checked={!!cur.isTrigger} onChange={()=>toggleTrigger(side)} /> Trigger
            </label>
            <button onClick={()=>clear(side)} style={{ padding:'6px 10px', borderRadius:8 }}>Clear</button>
          </div>
        </div>

        <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
          <div style={{ minWidth:84, minHeight:64, borderRadius:8, border:'1px dashed #1f2a2f', display:'grid', placeItems:'center', overflow:'hidden' }}>
            {mediaUrl ? (/\.(mp4|webm|mov)/i.test(mediaUrl) ? (
              <video src={mediaUrl} style={{ width:84, height:64, objectFit:'cover' }} />
            ) : (
              <img src={mediaUrl} alt="thumb" style={{ width:84, height:64, objectFit:'cover' }} />
            )) : <span style={{ color:'#9fb0bf', fontSize:12 }}>No media</span>}
          </div>

          <div style={{ flex:1 }}>
            <div style={{ color:'#9fb0bf', fontSize:13, marginBottom:6 }}>Pick media</div>
            <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:6 }}>
              {mediaItems.length === 0 && <div style={{ color:'#9fb0bf' }}>No media in pool</div>}
              {mediaItems.map((it, idx) => (
                <button key={idx} onClick={()=>chooseMedia(side, it.url)} title={it.name || it.url}
                  style={{
                    border: mediaUrl === it.url ? '2px solid #6ee7b7' : '2px solid transparent',
                    borderRadius:8, padding:0, background:'transparent', cursor:'pointer'
                  }}
                >
                  {/\.(mp4|webm|mov)/i.test(String(it.url)) ? (
                    <video src={it.url} style={{ width:120, height:72, objectFit:'cover', borderRadius:6 }} />
                  ) : (
                    <img src={it.url} style={{ width:120, height:72, objectFit:'cover', borderRadius:6 }} alt="" />
                  )}
                </button>
              ))}
            </div>

            <div style={{ marginTop:8, display:'flex', gap:8, alignItems:'center' }}>
              <input placeholder="Paste URL…" value={mediaUrl} onChange={(e)=>chooseMedia(side, e.target.value)}
                style={{ flex:1, padding:8, borderRadius:8, border:'1px solid #203238', background:'#071213', color:'#eaf7ef' }} />
            </div>

            <div style={{ marginTop:10 }}>
              <div style={{ color:'#9fb0bf', fontSize:13, marginBottom:6 }}>Pick audio (optional)</div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <select value={audioUrl || ''} onChange={(e)=>chooseAudio(side, e.target.value)}
                  style={{ flex:1, padding:8, borderRadius:8, border:'1px solid #203238', background:'#071213', color:'#eaf7ef' }}>
                  <option value="">(none)</option>
                  {audioItems.map((it, i)=>(<option key={i} value={it.url}>{it.name || it.url}</option>))}
                </select>
                {audioUrl ? <audio src={audioUrl} controls style={{ maxWidth:220 }} /> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop:12 }}>
      <Panel side="onCorrect" title="On Correct" />
      <Panel side="onWrong" title="On Wrong" />
    </div>
  );
}
