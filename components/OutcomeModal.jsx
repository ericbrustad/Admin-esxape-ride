import React from 'react';

export default function OutcomeModal({ open=false, title='Outcome', children=null, onClose=()=>{} }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'grid', placeItems: 'center',
      background: 'rgba(0,0,0,0.55)', zIndex: 4000, padding: 16
    }}>
      <div style={{
        width: 'min(720px, 96vw)', borderRadius: 12, background: '#0f1418',
        border: '1px solid #22303c', padding: 16, color: '#e9eef2'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <div>
            <button onClick={onClose} style={{
              padding: '6px 10px', borderRadius: 8, border: '1px solid #2a323b', background: '#1a2027', color: '#e9eef2'
            }}>Close</button>
          </div>
        </div>
        <div style={{ maxHeight: '60vh', overflow: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}
