// components/MissionListItem.jsx
import React from 'react';

/**
 * MissionListItem - small visual item to represent a mission in lists
 * Props:
 * - mission: { id, title, thumbnailUrl, hasResponses, responseThumb }
 * - onClick
 */
export default function MissionListItem({ mission = {}, onClick = () => {} }) {
  return (
    <div onClick={() => onClick(mission)} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 8, borderRadius: 8, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.03)' }}>
      <div style={{ width: 46, height: 46, borderRadius: 6, overflow: 'hidden', background: '#0b0f11', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {mission.thumbnailUrl ? <img src={mission.thumbnailUrl} alt={mission.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ color: '#6e848b', fontSize: 12 }}>No<br/>Img</div>}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700 }}>{mission.title}</div>
        <div style={{ fontSize: 12, color: '#9fb0bf' }}>ID: {mission.id}</div>
      </div>

      <div style={{ width: 40, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {mission.hasResponses ? (
          <div style={{ width: 12, height: 12, borderRadius: 3, background: '#2bc36b' }} title="Has Responses" />
        ) : null}
      </div>
    </div>
  );
}
