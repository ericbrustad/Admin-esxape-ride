import React, { useEffect, useState } from 'react';

/**
 * InlineMissionResponses
 * - value: { onCorrect, onWrong }
 * - mediaPool: array of {id,url,type,tags}
 * - onChange(updated)
 *
 * Each side (onCorrect/onWrong) has:
 * { enabled, isTrigger, mediaType, mediaUrl, statement, durationSeconds, buttonText }
 */
export default function InlineMissionResponses({ value = {}, mediaPool = [], onChange = () => {} }) {
  const blank = { enabled: false, isTrigger: false, mediaType: '', mediaUrl: '', statement: '', durationSeconds: 3, buttonText: 'OK' };
  const [state, setState] = useState({
    onCorrect: value.onCorrect ? { ...blank, ...value.onCorrect } : { ...blank },
    onWrong: value.onWrong ? { ...blank, ...value.onWrong } : { ...blank },
  });

  useEffect(() => { onChange(state); }, [state, onChange]);

  function update(side, key, val) {
    setState(s => ({ ...s, [side]: { ...s[side], [key]: val } }));
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {['onCorrect','onWrong'].map(side => {
        const resp = state[side];
        return (
          <div key={side} style={{ padding: 10, borderRadius: 8, background: '#0f1619', border: '1px solid rgba(255,255,255,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>{side === 'onCorrect' ? 'On Correct' : 'On Wrong'}</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={!!resp.enabled} onChange={(e) => update(side, 'enabled', e.target.checked)} />
                <span style={{ fontSize: 12, color: '#9fb0bf' }}>{resp.enabled ? 'Enabled' : 'Disabled'}</span>
              </label>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>Media Type</div>
              <select value={resp.mediaType || ''} onChange={(e) => update(side, 'mediaType', e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6 }}>
                <option value=''>-- none --</option>
                <option value='image'>Image</option>
                <option value='video'>Video</option>
                <option value='gif'>GIF</option>
                <option value='audio'>Audio</option>
              </select>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>Statement</div>
              <textarea value={resp.statement || ''} rows={3} onChange={(e) => update(side, 'statement', e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6 }} />
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>Media URL</div>
                <input value={resp.mediaUrl || ''} onChange={(e) => update(side, 'mediaUrl', e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6 }} placeholder="https://..." />
              </div>
              <div>
                <button type="button" onClick={() => { /* Ideally open media picker */ }} style={{ padding: 8, borderRadius: 6 }}>Choose</button>
              </div>
            </div>

            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={!!resp.isTrigger} onChange={(e) => update(side, 'isTrigger', e.target.checked)} />
                <span style={{ fontSize: 12, color: '#9fb0bf' }}>Mark as Trigger</span>
              </label>
              <div style={{ fontSize: 12, color: '#6e848b' }}>{resp.isTrigger ? 'This response will act as a trigger.' : ''}</div>
            </div>

            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: '#9fb0bf' }}>Preview</div>
              <div style={{ marginTop: 6, borderRadius: 6, padding: 8, background: '#0b0f11' }}>
                {resp.mediaUrl ? (
                  resp.mediaType === 'image' ? <img src={resp.mediaUrl} alt={side} style={{ maxWidth: '100%', maxHeight: 120 }} /> :
                  resp.mediaType === 'video' ? <video src={resp.mediaUrl} controls style={{ maxWidth: '100%', maxHeight: 120 }} /> :
                  resp.mediaType === 'audio' ? <audio src={resp.mediaUrl} controls style={{ width: '100%' }} /> :
                  <div style={{ color: '#cfe8ea' }}>{resp.mediaUrl}</div>
                ) : <div style={{ color: '#6e848b' }}>No media chosen</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
