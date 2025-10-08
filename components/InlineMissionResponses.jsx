// components/InlineMissionResponses.jsx
import React, { useEffect, useState } from 'react';

/**
 * InlineMissionResponses
 *
 * Simplified, balanced JSX version to avoid syntax errors.
 *
 * Props:
 *  - value: { onCorrect, onWrong }
 *  - onChange(updated)
 */
export default function InlineMissionResponses({ value = {}, onChange = () => {} }) {
  const blank = { type: 'statement', statement: '', mediaUrl: '', audioUrl: '', durationSeconds: 3, buttonText: 'OK', isTrigger: false };
  const [state, setState] = useState({
    onCorrect: { ...(value.onCorrect || blank) },
    onWrong: { ...(value.onWrong || blank) },
  });

  useEffect(() => {
    onChange(state);
  }, [state, onChange]);

  function update(side, key, val) {
    setState((s) => ({ ...s, [side]: { ...s[side], [key]: val } }));
  }

  function ResponseEditor({ side, title }) {
    const resp = state[side] || blank;
    return (
      <div style={{ marginBottom: 18, border: '1px solid #2b3238', borderRadius: 8, padding: 12, background: '#0f1619' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: 12, color: '#9fb0bf' }}>{resp.isTrigger ? 'Trigger Response' : 'Standard Response'}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12 }}>
          <div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>Type</div>
              <select
                value={resp.type}
                onChange={(e) => update(side, 'type', e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, background: '#0b0f11', color: '#e6f2f4', border: '1px solid #22303a' }}
              >
                <option value="statement">Statement (text)</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="gif">GIF</option>
                <option value="audio">Audio only</option>
              </select>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>Statement</div>
              <textarea
                value={resp.statement || ''}
                onChange={(e) => update(side, 'statement', e.target.value)}
                rows={4}
                style={{ width: '100%', padding: 8, borderRadius: 6, background: '#071012', color: '#e6f2f4', border: '1px solid #22303a' }}
                placeholder="Short message to show the player (optional)"
              />
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>Media URL</div>
              <input
                type="text"
                value={resp.mediaUrl || ''}
                onChange={(e) => update(side, 'mediaUrl', e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, background: '#071012', color: '#e6f2f4', border: '1px solid #22303a' }}
                placeholder="https://... (image/video/gif)"
              />
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>Button Text</div>
                <input
                  type="text"
                  value={resp.buttonText || ''}
                  onChange={(e) => update(side, 'buttonText', e.target.value)}
                  style={{ width: '100%', padding: 8, borderRadius: 6, background: '#071012', color: '#e6f2f4', border: '1px solid #22303a' }}
                />
              </div>

              <div style={{ width: 120 }}>
                <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>Duration (s)</div>
                <input
                  type="number"
                  min={0}
                  value={resp.durationSeconds || 0}
                  onChange={(e) => update(side, 'durationSeconds', Number(e.target.value))}
                  style={{ width: '100%', padding: 8, borderRadius: 6, background: '#071012', color: '#e6f2f4', border: '1px solid #22303a' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>Audio URL (optional)</div>
              <input
                type="text"
                value={resp.audioUrl || ''}
                onChange={(e) => update(side, 'audioUrl', e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, background: '#071012', color: '#e6f2f4', border: '1px solid #22303a' }}
                placeholder="https://... (mp3 / ogg)"
              />
            </div>

            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 12, color: '#9fb0bf' }}>Mark as Trigger</label>
              <input type="checkbox" checked={!!resp.isTrigger} onChange={(e) => update(side, 'isTrigger', e.target.checked)} />
              <div style={{ fontSize: 12, color: '#6e848b' }}>{resp.isTrigger ? 'This response will act as a trigger.' : 'Standard response'}</div>
            </div>

            <div style={{ marginTop: 6 }}>
              {resp.audioUrl ? (
                <audio controls src={resp.audioUrl} style={{ width: '100%' }}>
                  Your browser does not support the audio element.
                </audio>
              ) : null}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>Preview</div>
            <div style={{ borderRadius: 8, padding: 8, background: '#071213', minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #22303a' }}>
              {resp.mediaUrl ? (
                <>
                  {(resp.type === 'image' || resp.type === 'gif') && <img src={resp.mediaUrl} alt="preview" style={{ maxWidth: '100%', maxHeight: 140, borderRadius: 6 }} />}
                  {resp.type === 'video' && <video src={resp.mediaUrl} controls style={{ maxWidth: '100%', maxHeight: 140, borderRadius: 6 }} />}
                  {resp.type === 'audio' && resp.audioUrl && <div style={{ width: '100%' }}><audio controls src={resp.audioUrl} style={{ width: '100%' }} /></div>}
                  {!['image', 'gif', 'video', 'audio'].includes(resp.type) && resp.mediaUrl && <div style={{ color: '#cfe8ea', fontSize: 12 }}>{resp.mediaUrl}</div>}
                </>
              ) : (
                <div style={{ color: '#6e848b', fontSize: 13, textAlign: 'center' }}>No media selected</div>
              )}
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: '#9fb0bf' }}>
              <div><strong>Statement:</strong></div>
              <div style={{ marginTop: 6, color: '#cfe8ea' }}>{resp.statement || '(none)'}</div>
            </div>

            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={() => {
                  update(side, 'type', 'statement');
                  update(side, 'statement', '');
                  update(side, 'mediaUrl', '');
                  update(side, 'audioUrl', '');
                  update(side, 'durationSeconds', 3);
                  update(side, 'buttonText', 'OK');
                  update(side, 'isTrigger', false);
                }}
                style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: '#14242a', color: '#e6f2f4', border: '1px solid #22303a', cursor: 'pointer' }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      );
  }

  return (
    <div>
      <ResponseEditor side="onCorrect" title="On Correct" />
      <ResponseEditor side="onWrong" title="On Wrong" />
    </div>
  );
}
