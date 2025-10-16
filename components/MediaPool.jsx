import React from 'react';

export default function MediaPool({ media = [], onSelect = () => {} }) {
  const responseTriggersCount = media.filter(m => (m.tags || []).includes('response-trigger')).length;
  const geoTriggerCount = media.filter(m => (m.tags || []).includes('geotrigger-device')).length;

  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.04)', padding: 12, borderRadius: 8, background: '#071213' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 800 }}>Media Pool</div>
        <div style={{ fontSize: 12, color: '#9fb0bf' }}>
          <span style={{ marginRight: 12 }}>Response Triggers: <strong>{responseTriggersCount}</strong></span>
          <span>GeoTrigger Devices: <strong>{geoTriggerCount}</strong></span>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        {media.map(m => (
          <div key={m.id} onClick={() => onSelect(m)} style={{ borderRadius: 6, overflow: 'hidden', background: '#0b0f11', padding: 6, cursor: 'pointer' }}>
            {m.type === 'image' ? <img src={m.url} alt={m.id} style={{ width: '100%', height: 90, objectFit: 'cover' }} /> : <div style={{ color: '#cfe8ea', height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{m.type.toUpperCase()}</div>}
            <div style={{ fontSize: 12, color: '#9fb0bf', marginTop: 6 }}>{m.id}</div>
            <div style={{ fontSize: 11, color: '#6e848b' }}>{(m.tags || []).join(', ')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
