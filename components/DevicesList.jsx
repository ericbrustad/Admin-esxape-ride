// components/DevicesList.jsx
import React, { useState } from 'react';

/**
 * DevicesList
 *
 * Props:
 * - devices: array of { id, name, lat, lng, thumbnailUrl, hasResponses }
 * - triggerDevices: array of { id, name } available to attach as triggers (optional)
 * - onReorder(id, direction) - 'up' | 'down'
 * - onSelect(device) - called when a device row is clicked (for editing)
 * - onUpdate(device) - called when device edited/saved
 */
export default function DevicesList({ devices = [], triggerDevices = [], onReorder = () => {}, onSelect = () => {}, onUpdate = () => {} }) {
  const [editing, setEditing] = useState(null); // device being edited
  const [local, setLocal] = useState({});

  function startEdit(device) {
    setEditing(device);
    setLocal({ ...device, triggeredTicker: device.triggeredTicker || '', triggerTargetId: device.triggerTargetId || '' });
  }

  function applyUpdate() {
    const updated = { ...editing, ...local };
    onUpdate(updated);
    setEditing(null);
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {devices.map((d, idx) => {
          const isSelected = editing && editing.id === d.id;
          return (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 8, background: isSelected ? 'rgba(150,220,150,0.12)' : 'transparent', border: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }} onClick={() => startEdit(d)}>
              {/* Thumbnail */}
              <div style={{ width: 48, height: 48, borderRadius: 6, overflow: 'hidden', background: '#0b0f11', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {d.thumbnailUrl ? (
                  <img src={d.thumbnailUrl} alt={d.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ fontSize: 12, color: '#6e848b', padding: 6, textAlign: 'center' }}>No<br/>Thumb</div>
                )}
              </div>

              {/* Main label area - clickable to open edit */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{d.name}</div>
                <div style={{ fontSize: 12, color: '#9fb0bf' }}>{typeof d.lat === 'number' ? d.lat.toFixed(4) : d.lat}, {typeof d.lng === 'number' ? d.lng.toFixed(4) : d.lng}</div>
                {/* Bottom edge marker for responses */}
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {d.hasResponses ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: '#2bc36b' }} />
                      <div style={{ fontSize: 11, color: '#cfe8ea' }}>Has Response</div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Up / Down arrows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button type="button" onClick={(e) => { e.stopPropagation(); onReorder(d.id, 'up'); }} style={{ padding: 6, borderRadius: 6 }}>▲</button>
                <button type="button" onClick={(e) => { e.stopPropagation(); onReorder(d.id, 'down'); }} style={{ padding: 6, borderRadius: 6 }}>▼</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Inline editor for new/edited device */}
      {editing ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)', background: '#071213' }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Edit Device — {editing.name}</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#9fb0bf' }}>Name</label>
              <input value={local.name || ''} onChange={(e) => setLocal((s) => ({ ...s, name: e.target.value }))} style={{ width: '100%', padding: 8, borderRadius: 6, marginTop: 6 }} />

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: '#9fb0bf' }}>Latitude</label>
                  <input value={local.lat || ''} onChange={(e) => setLocal((s) => ({ ...s, lat: e.target.value }))} style={{ width: '100%', padding: 8, borderRadius: 6, marginTop: 6 }} />
                </div>
                <div style={{ width: 160 }}>
                  <label style={{ fontSize: 12, color: '#9fb0bf' }}>Longitude</label>
                  <input value={local.lng || ''} onChange={(e) => setLocal((s) => ({ ...s, lng: e.target.value }))} style={{ width: '100%', padding: 8, borderRadius: 6, marginTop: 6 }} />
                </div>
              </div>

              {/* Trigger ticker field */}
              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: 12, color: '#9fb0bf' }}>Triggered Device (ticker)</label>
                <input value={local.triggeredTicker || ''} onChange={(e) => setLocal((s) => ({ ...s, triggeredTicker: e.target.value }))} placeholder="e.g., D2" style={{ width: '100%', padding: 8, borderRadius: 6, marginTop: 6 }} />
                <div style={{ fontSize: 12, color: '#6e848b', marginTop: 6 }}>This short ticker is a quick label to show when this device triggers something.</div>
              </div>

              {/* Dropdown for trigger devices */}
              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: 12, color: '#9fb0bf' }}>Trigger Target</label>
                {Array.isArray(triggerDevices) && triggerDevices.length > 0 ? (
                  <select value={local.triggerTargetId || ''} onChange={(e) => setLocal((s) => ({ ...s, triggerTargetId: e.target.value }))} style={{ width: '100%', padding: 8, borderRadius: 6, marginTop: 6 }}>
                    <option value=''>-- select target --</option>
                    {triggerDevices.map(td => (<option key={td.id} value={td.id}>{td.name}</option>))}
                  </select>
                ) : (
                  <div style={{ marginTop: 6, color: '#cfe8ea' }}>None available</div>
                )}
              </div>

            </div>

            <div>
              <div style={{ fontSize: 12, color: '#9fb0bf', marginBottom: 6 }}>Thumbnail</div>
              <div style={{ width: '100%', height: 140, borderRadius: 8, overflow: 'hidden', background: '#0b0f11', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {local.thumbnailUrl ? <img src={local.thumbnailUrl} alt="thumb" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ color: '#6e848b' }}>No thumbnail</div>}
              </div>

              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: 12, color: '#9fb0bf' }}>Thumbnail URL</label>
                <input value={local.thumbnailUrl || ''} onChange={(e) => setLocal((s) => ({ ...s, thumbnailUrl: e.target.value }))} style={{ width: '100%', padding: 8, borderRadius: 6, marginTop: 6 }} placeholder="https://..." />
              </div>

              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <button onClick={applyUpdate} style={{ padding: 8, borderRadius: 6 }}>Save</button>
                <button onClick={() => setEditing(null)} style={{ padding: 8, borderRadius: 6, background: '#122027', color: '#cfe8ea' }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
