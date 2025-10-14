import React from 'react';

export default function MediaPool({ media = [], onSelect = () => {} }) {
  const responseTriggersCount = media.filter(m => (m.tags || []).includes('response-trigger')).length;
  const geoTriggerCount = media.filter(m => (m.tags || []).includes('geotrigger-device')).length;

  return (
    <div
      style={{
        border: 'var(--appearance-panel-border, var(--admin-panel-border))',
        padding: 12,
        borderRadius: 12,
        background: 'var(--appearance-panel-bg, var(--admin-panel-bg))',
        boxShadow: 'var(--appearance-panel-shadow, var(--admin-panel-shadow))',
        color: 'var(--appearance-font-color, var(--admin-body-color))',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontWeight: 800 }}>Media Pool</div>
        <div style={{ fontSize: 12, color: 'var(--admin-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span>Response Triggers: <strong>{responseTriggersCount}</strong></span>
          <span>GeoTrigger Devices: <strong>{geoTriggerCount}</strong></span>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
        {media.map(m => (
          <div
            key={m.id}
            onClick={() => onSelect(m)}
            style={{
              borderRadius: 12,
              overflow: 'hidden',
              background: 'var(--appearance-subpanel-bg, var(--admin-tab-bg))',
              padding: 8,
              cursor: 'pointer',
              border: '1px solid var(--admin-border-soft)',
              display: 'grid',
              gap: 6,
            }}
          >
            {m.type === 'image' ? (
              <img src={m.url} alt={m.id} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8 }} />
            ) : (
              <div
                style={{
                  color: 'var(--admin-muted)',
                  height: 120,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  background: 'var(--admin-input-bg)',
                  border: '1px dashed var(--admin-border-soft)',
                  fontWeight: 600,
                  letterSpacing: 1,
                }}
              >
                {String(m.type || 'media').toUpperCase()}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--appearance-font-color, var(--admin-body-color))', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.id}
            </div>
            <div style={{ fontSize: 11, color: 'var(--admin-muted)', minHeight: 14 }}>
              {(m.tags || []).join(', ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
