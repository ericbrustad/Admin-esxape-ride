import React from 'react';

function statusBadge(status) {
  const palette = {
    complete: { bg: '#3dd68c', fg: '#05281a', label: 'Complete' },
    attempted: { bg: '#f5a623', fg: '#231b04', label: 'Attempted' },
    pending: { bg: '#334155', fg: '#d7e1f2', label: 'Pending' },
  };
  return palette[status] || palette.pending;
}

export default function MissionMap({ missions, currentId, answers, onSelect, points, backpackSummary }) {
  const total = missions.length;
  const completed = missions.filter((mission) => {
    const entry = answers?.get?.(mission.id);
    return entry?.correct;
  }).length;

  const summaryEntries = Object.entries(backpackSummary || {}).filter(([, count]) => Number(count) > 0);

  return (
    <aside style={panel}>
      <header style={headerRow}>
        <div>
          <div style={title}>Mission Map</div>
          <div style={subtitle}>
            {completed} / {total} complete
          </div>
        </div>
        <div style={pointsBadge} aria-label={`Points earned ${points}`}>
          <span style={{ color: '#9fb0bf', fontSize: 12 }}>Points</span>
          <span style={{ fontSize: 20, fontWeight: 700 }}>{points}</span>
        </div>
      </header>

      {summaryEntries.length > 0 && (
        <div style={summaryRow}>
          {summaryEntries.map(([key, count]) => (
            <span key={key} style={summaryBadge}>
              <strong>{count}</strong>
              <span style={{ opacity: 0.75, marginLeft: 4 }}>{key}</span>
            </span>
          ))}
        </div>
      )}

      <ol style={list}>
        {missions.map((mission) => {
          const entry = answers?.get?.(mission.id);
          const status = entry ? (entry.correct ? 'complete' : 'attempted') : 'pending';
          const badge = statusBadge(status);
          const isCurrent = mission.id === currentId;
          return (
            <li key={mission.id} style={{ ...listItem, ...(isCurrent ? currentItem : null) }}>
              <button
                type="button"
                style={{ ...listButton, ...(isCurrent ? currentButton : null) }}
                onClick={() => onSelect && onSelect(mission.id)}
              >
                <span style={indexPill}>{mission.indexLabel}</span>
                <span style={missionCopy}>
                  <span style={missionTitle}>{mission.title}</span>
                  <span style={missionMeta}>{mission.subtitle}</span>
                </span>
                <span style={{ ...statusPill, background: badge.bg, color: badge.fg }}>{badge.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

const panel = {
  background: '#11161a',
  border: '1px solid #1f262d',
  borderRadius: 12,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const headerRow = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
};

const title = {
  fontSize: 20,
  fontWeight: 700,
};

const subtitle = {
  fontSize: 13,
  color: '#9fb0bf',
};

const pointsBadge = {
  minWidth: 96,
  padding: '8px 12px',
  borderRadius: 12,
  border: '1px solid #22303a',
  background: 'rgba(61, 214, 140, 0.08)',
  display: 'flex',
  flexDirection: 'column',
  textAlign: 'right',
};

const summaryRow = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
};

const summaryBadge = {
  display: 'inline-flex',
  alignItems: 'baseline',
  gap: 4,
  padding: '4px 10px',
  borderRadius: 999,
  background: 'rgba(79, 209, 197, 0.15)',
  color: '#d7f6f2',
  fontSize: 12,
};

const list = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const listItem = {};

const listButton = {
  width: '100%',
  border: '1px solid rgba(32, 44, 54, 0.9)',
  background: '#0c1116',
  color: '#f1f5f9',
  borderRadius: 12,
  padding: '10px 12px',
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto',
  alignItems: 'center',
  gap: 12,
  cursor: 'pointer',
  textAlign: 'left',
};

const currentItem = {
  transform: 'translateX(4px)',
};

const currentButton = {
  borderColor: '#3dd68c',
  background: 'rgba(61, 214, 140, 0.1)',
};

const indexPill = {
  minWidth: 32,
  height: 32,
  borderRadius: 999,
  border: '1px solid rgba(148, 163, 184, 0.35)',
  background: 'rgba(15, 22, 28, 0.7)',
  display: 'grid',
  placeItems: 'center',
  fontSize: 13,
  fontWeight: 600,
};

const missionCopy = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const missionTitle = {
  fontWeight: 600,
};

const missionMeta = {
  fontSize: 12,
  color: '#9fb0bf',
};

const statusPill = {
  padding: '4px 8px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

