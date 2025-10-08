import React, { useEffect, useRef, useState } from 'react';

export default function InlineMissionResponses({ editing, setEditing, inventory = [] }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSide, setPickerSide] = useState(null);
  const [localInventory, setLocalInventory] = useState(Array.isArray(inventory) ? inventory.slice() : []);
  const fileRef = useRef(null);

  useEffect(() => {
    setLocalInventory(Array.isArray(inventory) ? inventory.slice() : []);
  }, [inventory]);

  if (!editing || typeof setEditing !== 'function') return null;

  const safeGet = (key) => {
    const base = editing[key] || {};
    return {
      enabled: !!base.enabled,
      isTrigger: !!base.isTrigger,
      mediaUrl: base.mediaUrl || '',
      audioUrl: base.audioUrl || '',
      statement: base.statement || '',
      durationSeconds: (typeof base.durationSeconds === 'number' ? base.durationSeconds : 3),
      buttonText: base.buttonText || 'OK',
      ...base
    };
  };

  const correct = safeGet('correct');
  const wrong = safeGet('wrong');

  function updateSide(side, changes) {
    const next = { ...(editing[side] || {}), ...changes };
    setEditing({ ...editing, [side]: next });
  }

  function openPicker(side) {
    setPickerSide(side);
    setPickerOpen(true);
  }

  function closePicker() {
    setPickerOpen(false);
    setPickerSide(null);
  }

  function pickMedia(item) {
    if (!pickerSide) return;
    updateSide(pickerSide, { mediaUrl: item.url || item.mediaUrl || '' });
    closePicker();
  }

  function onFileUpload(files) {
    if (!files || files.length === 0) return;
    const f = files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target.result;
      const id = `upload-${Date.now()}`;
      const item = { id, url, label: f.name, type: (f.type || '').split('/')[0] || 'file' };
      setLocalInventory(prev => [item, ...prev]);
      if (pickerSide) updateSide(pickerSide, { mediaUrl: url });
      closePicker();
    };
    reader.readAsDataURL(f);
  }

  function PreviewFromUrl({ url }) {
    if (!url) return <div style={{ color: '#6e848b' }}>No media chosen</div>;

    const isHttp = /^https?:\/\//i.test(url);
    const isData = url.startsWith('data:');

    if (isData || isHttp) {
      if (/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url) || url.startsWith('data:image')) {
        return <img src={url} alt="preview" style={{ maxWidth: '100%', maxHeight: 160 }} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = ''; }} />;
      }
      if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) {
        return <video src={url} controls style={{ maxWidth: '100%', maxHeight: 160 }} />;
      }
      if (/\.(mp3|wav|ogg|m4a|aiff)(\?|$)/i.test(url)) {
        return <audio src={url} controls style={{ width: '100%' }} />;
      }
      return <img src={url} alt="preview" style={{ maxWidth: '100%', maxHeight: 160 }} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = ''; }} />;
    }

    return <div style={{ color: '#cfe8ea' }}>{url}</div>;
  }

  function renderEditor(sideKey, sideLabel) {
    const resp = sideKey === 'correct' ? correct : wrong;

    return (
      <div key={sideKey} style={{ padding: 10, borderRadius: 8, background: '#0f1619', border: '1px solid rgba(255,255,255,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>{sideLabel}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={resp.enabled} onChange={(e) => updateSide(sideKey, { enabled: e.target.checked })} />
              <span style={{ fontSize: 12, color: '#9fb0bf' }}>{resp.enabled ? 'Enabled' : 'Disabled'}</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Mark this outcome as a trigger">
              <input type="checkbox" checked={resp.isTrigger} onChange={(e) => updateSide(sideKey, { isTrigger: e.target.checked })} />
              <span style={{ fontSize: 12, color: '#9fb0bf' }}>{resp.isTrigger ? 'Trigger' : 'Not a trigger'}</span>
            </label>
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>Statement</div>
          <textarea value={resp.statement || ''} rows={3} onChange={(e) => updateSide(sideKey, { statement: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6 }} />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>Media URL</div>
            <input value={resp.mediaUrl || ''} onChange={(e) => updateSide(sideKey, { mediaUrl: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6 }} placeholder="https://... or choose/upload" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button type="button" onClick={() => openPicker(sideKey)} style={{ padding: '8px 12px', borderRadius: 6 }}>Choose Media</button>
            <label style={{ display: 'inline-block' }}>
              <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={(e) => onFileUpload(e.target.files)} />
              <button type="button" onClick={() => fileRef.current && fileRef.current.click()} style={{ padding: '8px 12px', borderRadius: 6 }}>Upload</button>
            </label>
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, color: '#9fb0bf' }}>Preview</div>
          <div style={{ marginTop: 6, borderRadius: 6, padding: 8, background: '#0b0f11' }}>
            <PreviewFromUrl url={resp.mediaUrl} />
          </div>
        </div>

        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>Audio URL (optional)</div>
            <input value={resp.audioUrl || ''} onChange={(e) => updateSide(sideKey, { audioUrl: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 6 }} placeholder="https://...audio.mp3" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {renderEditor('correct', 'On Correct')}
        {renderEditor('wrong', 'On Wrong')}
      </div>

      {pickerOpen && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', left: 20, top: 80, width: 740, maxHeight: '70vh', overflow: 'auto', padding: 12, borderRadius: 8, background: '#071213', border: '1px solid rgba(255,255,255,0.06)', zIndex: 9000 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 800 }}>Media Pool — choose a media file</div>
            <div>
              <button onClick={closePicker} style={{ padding: 6, borderRadius: 6, marginRight: 8 }}>Close</button>
              <button onClick={() => fileRef.current && fileRef.current.click()} style={{ padding: 6, borderRadius: 6 }}>Upload file</button>
              <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={(e) => onFileUpload(e.target.files)} />
            </div>
          </div>

          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {localInventory.length === 0 ? <div style={{ gridColumn: '1 / -1', color: '#cfe8ea' }}>No media available</div> : null}
            {localInventory.map((m, i) => (
              <div key={m.id || i} onClick={() => pickMedia(m)} style={{ cursor: 'pointer', borderRadius: 6, overflow: 'hidden', background: '#0b0f11', padding: 6, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                {m.url ? ((m.url.startsWith('data:') || /\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(m.url)) ? <img src={m.url} alt={m.id || m.label} style={{ width: '100%', height: 90, objectFit: 'cover' }} /> : <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cfe8ea' }}>{m.type || 'FILE'}</div>) : <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6e848b' }}>No preview</div>}
                <div style={{ fontSize: 12, color: '#9fb0bf', marginTop: 6 }}>{m.label || m.id || m.url}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, color: '#9fb0bf', fontSize: 13 }}>
            You can upload a file or click any item to select it. Uploaded files are stored as data URLs in the local inventory (session-only).
          </div>
        </div>
      )}
    </div>
  );
}
