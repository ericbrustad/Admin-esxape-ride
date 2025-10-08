// components/InlineMissionResponses.jsx
import React, { useEffect, useState } from 'react';

/**
 * InlineMissionResponses
 *
 * Controlled component for editing mission response content for correct/wrong answers.
 *
 * Props:
 * - value: optional initial object e.g.
 *   {
 *     onCorrect: { type: 'statement', statement: '', mediaUrl: '', audioUrl: '', durationSeconds: 3, buttonText: 'OK' },
 *     onWrong:   { ... }
 *   }
 * - onChange(updatedValue) - called when anything changes
 */
export default function InlineMissionResponses({ value = {}, onChange = () => {} }) {
  const blankResponse = { type: 'statement', statement: '', mediaUrl: '', audioUrl: '', durationSeconds: 3, buttonText: 'OK' };
  const [editing, setEditing] = useState({
    onCorrect: { ...(value.onCorrect || blankResponse) },
    onWrong: { ...(value.onWrong || blankResponse) },
  });

  // Keep parent informed
  useEffect(() => {
    onChange(editing);
  }, [editing, onChange]);

  // helper to update nested field
  function update(side, key, val) {
    setEditing((prev) => {
      const updated = { ...prev, [side]: { ...prev[side], [key]: val } };
      return updated;
    });
  }

  // Render a single response editor (for onCorrect / onWrong)
  function ResponseEditor({ sideKey, title }) {
    const resp = editing[sideKey];

    return (
      <div style={{ marginBottom: 18, border: '1px solid #2b3238', borderRadius: 8, padding: 12, background: '#0f1619' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: 12, color: '#9fb0bf' }}>Preview / Response settings</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12, alignItems: 'start' }}>
          {/* Left column - fields */}
          <div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>Type</div>
              <select
                value={resp.type}
                onChange={(e) => update(sideKey, 'type', e.target.value)}
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
                value={resp.statement}
                onChange={(e) => update(sideKey, 'statement', e.target.value)}
                rows={4}
                style={{ width: '100%', padding: 8, borderRadius: 6, background: '#071012', color: '#e6f2f4', border: '1px solid #22303a' }}
                placeholder="Short message to show the player (optional)"
              />
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>Media URL</div>
              <input
                type="text"
                value={resp.mediaUrl}
                onChange={(e) => update(sideKey, 'mediaUrl', e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, background: '#071012', color: '#e6f2f4', border: '1px solid #22303a' }}
                placeholder="https://... (image/video/gif)"
              />
            </div>

            <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>Button Text</div>
                <input
                  type="text"
                  value={resp.buttonText}
                  onChange={(e) => update(sideKey, 'buttonText', e.target.value)}
                  style={{ width: '100%', padding: 8, borderRadius: 6, background: '#071012', color: '#e6f2f4', border: '1px solid #22303a' }}
                />
              </div>

              <div style={{ width: 120 }}>
                <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>Duration (s)</div>
                <input
                  type="number"
                  min={0}
                  value={resp.durationSeconds}
                  onChange={(e) => update(sideKey, 'durationSeconds', Number(e.target.value))}
                  style={{ width: '100%', padding: 8, borderRadius: 6, background: '#071012', color: '#e6f2f4', border: '1px solid #22303a' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>Audio URL (optional)</div>
              <input
                type="text"
                value={resp.audioUrl}
                onChange={(e) => update(sideKey, 'audioUrl', e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, background: '#071012', color: '#e6f2f4', border: '1px solid #22303a' }}
                placeholder="https://... (mp3 / ogg)"
              />
            </div>

            {/* Audio preview */}
            <div style={{ marginTop: 6 }}>
              {resp.audioUrl ? (
                <audio controls src={resp.audioUrl} style={{ width: '100%' }}>
                  Your browser does not support the audio element.
                </audio>
              ) : null}
            </div>
          </div>

          {/* Right column - preview / thumbnail */}
          <div>
            <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>Preview</div>
            <div style={{ borderRadius: 8, padding: 8, background: '#071213', minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #22303a' }}>
              {resp.mediaUrl ? (
                <>
                  {(resp.type === 'image' || resp.type === 'gif') && (
                    <img src={resp.mediaUrl} alt="preview" style={{ maxWidth: '100%', maxHeight: 140, borderRadius: 6 }} />
                  )}
                  {resp.type === 'video' && (
                    <video src={resp.mediaUrl} controls style={{ maxWidth: '100%', maxHeight: 140, borderRadius: 6 }} />
                  )}
                  {resp.type === 'audio' && resp.audioUrl && (
                    <div style={{ width: '100%' }}>
                      <audio controls src={resp.audioUrl} style={{ width: '100%' }} />
                    </div>
                  )}
                  {!['image', 'gif', 'video', 'audio'].includes(resp.type) && resp.mediaUrl && (
                    <div style={{ color: '#cfe8ea', fontSize: 12 }}>{resp.mediaUrl}</div>
                  )}
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
                  // reset this side
                  update(sideKey, 'type', 'statement');
                  update(sideKey, 'statement', '');
                  update(sideKey, 'mediaUrl', '');
                  update(sideKey, 'audioUrl', '');
                  update(sideKey, 'durationSeconds', 3);
                  update(sideKey, 'buttonText', 'OK');
                }}
                style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: '#14242a', color: '#e6f2f4', border: '1px solid #22303a', cursor: 'pointer' }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ResponseEditor sideKey="onCorrect" title="On Correct" />
      <ResponseEditor sideKey="onWrong" title="On Wrong" />
    </div>
  );
}
