import React, { useState, useEffect } from 'react';

/**
 * Minimal, safe InlineMissionResponses component
 * Props:
 *  - editing: current mission object (may be mutated via setEditing)
 *  - setEditing: function to update the mission object
 *  - inventory: array of media items { url, label, ... } (optional)
 *
 * This file is intentionally conservative and uses simple inputs to avoid
 * bundler/JSX parsing errors that were occurring in your build.
 */

function smallPreview({ url }) {
  if (!url) return null;
  const u = String(url || '').trim();
  const isImage = /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(u) || u.includes('drive.google.com/uc?export=view');
  const isVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(u);
  const isAudio = /\.(mp3|wav|ogg|m4a|aiff|aif)(\?.*)?$/i.test(u);

  if (isVideo) return (<video src={u} controls style={{ width: '100%', maxHeight: 180, borderRadius: 8 }} />);
  if (isImage) return (<img src={u} alt="preview" style={{ width: '100%', maxHeight: 180, objectFit:'contain', borderRadius:8 }} />);
  if (isAudio) return (<audio src={u} controls style={{ width: '100%' }} />);
  return (<a href={u} target="_blank" rel="noreferrer" style={{ color:'#9fb0bf' }}>Open media</a>);
}

export default function InlineMissionResponses({ editing, setEditing, inventory = [] }) {
  // local convenience to avoid errors when editing is nullish
  const edit = editing || {};
  const safeSet = (patch) => {
    setEditing({ ...(editing || {}), ...patch });
  };

  // ensure onCorrect/onWrong objects exist
  useEffect(()=>{
    if (!editing) return;
    if (!editing.onCorrect) setEditing({ ...editing, onCorrect: { mode: 'none' } });
    if (!editing.onWrong)   setEditing({ ...editing, onWrong:   { mode: 'none' } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  if (!editing) return null;

  const mediaPoolOptions = inventory.map((it, i) => ({ value: it.url, label: it.label || it.url || `media-${i}` }));

  function updateSide(side, patch) {
    const nextSide = { ...(editing[side]||{}), ...patch };
    setEditing({ ...editing, [side]: nextSide });
  }

  return (
    <div style={{ border:'1px solid #1f262d', borderRadius:8, padding:12, marginTop:8, background:'#0b0f12' }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        {/* Correct response */}
        <div>
          <div style={{ fontWeight:700, marginBottom:8 }}>On Correct</div>
          <label style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
            <input
              type="checkbox"
              checked={!!(editing.onCorrect && editing.onCorrect.enabled)}
              onChange={(e)=> updateSide('onCorrect', { enabled: e.target.checked })}
            />
            Enabled
          </label>

          <div style={{ marginBottom:8 }}>
            <label style={{ display:'block', fontSize:12, color:'#9fb0bf' }}>Media (choose from Media Pool)</label>
            <select
              value={editing.onCorrect?.mediaUrl || ''}
              onChange={(e)=> updateSide('onCorrect', { mediaUrl: e.target.value })}
              style={{ width:'100%', padding:8, borderRadius:8, background:'#0b0c10', color:'#e9eef2', border:'1px solid #2a323b' }}
            >
              <option value="">(none)</option>
              {mediaPoolOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
            <div style={{ marginTop:8 }}>{smallPreview({ url: editing.onCorrect?.mediaUrl })}</div>
          </div>

          <div style={{ marginBottom:8 }}>
            <label style={{ display:'block', fontSize:12, color:'#9fb0bf' }}>Audio (optional)</label>
            <input
              type="text" placeholder="audio URL"
              value={editing.onCorrect?.audioUrl || ''}
              onChange={(e)=> updateSide('onCorrect', { audioUrl: e.target.value })}
              style={{ width:'100%', padding:8, borderRadius:8, background:'#0b0c10', color:'#e9eef2', border:'1px solid #2a323b' }}
            />
            <div style={{ marginTop:8 }}>{smallPreview({ url: editing.onCorrect?.audioUrl })}</div>
          </div>

          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <label style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input
                type="checkbox"
                checked={!!editing.onCorrect?.isTrigger}
                onChange={(e)=> updateSide('onCorrect', { isTrigger: e.target.checked })}
              />
              Mark as Trigger
            </label>
          </div>
        </div>

        {/* Wrong response */}
        <div>
          <div style={{ fontWeight:700, marginBottom:8 }}>On Wrong</div>
          <label style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
            <input
              type="checkbox"
              checked={!!(editing.onWrong && editing.onWrong.enabled)}
              onChange={(e)=> updateSide('onWrong', { enabled: e.target.checked })}
            />
            Enabled
          </label>

          <div style={{ marginBottom:8 }}>
            <label style={{ display:'block', fontSize:12, color:'#9fb0bf' }}>Media (choose from Media Pool)</label>
            <select
              value={editing.onWrong?.mediaUrl || ''}
              onChange={(e)=> updateSide('onWrong', { mediaUrl: e.target.value })}
              style={{ width:'100%', padding:8, borderRadius:8, background:'#0b0c10', color:'#e9eef2', border:'1px solid #2a323b' }}
            >
              <option value="">(none)</option>
              {mediaPoolOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
            <div style={{ marginTop:8 }}>{smallPreview({ url: editing.onWrong?.mediaUrl })}</div>
          </div>

          <div style={{ marginBottom:8 }}>
            <label style={{ display:'block', fontSize:12, color:'#9fb0bf' }}>Audio (optional)</label>
            <input
              type="text" placeholder="audio URL"
              value={editing.onWrong?.audioUrl || ''}
              onChange={(e)=> updateSide('onWrong', { audioUrl: e.target.value })}
              style={{ width:'100%', padding:8, borderRadius:8, background:'#0b0c10', color:'#e9eef2', border:'1px solid #2a323b' }}
            />
            <div style={{ marginTop:8 }}>{smallPreview({ url: editing.onWrong?.audioUrl })}</div>
          </div>

          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <label style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input
                type="checkbox"
                checked={!!editing.onWrong?.isTrigger}
                onChange={(e)=> updateSide('onWrong', { isTrigger: e.target.checked })}
              />
              Mark as Trigger
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
