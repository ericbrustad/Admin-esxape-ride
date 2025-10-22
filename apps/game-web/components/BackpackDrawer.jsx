import React from 'react';

function toLocal(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '';
  }
}

export default function BackpackDrawer({
  open,
  onZip,
  backpack,
  onDrop,
  onDiscard,
  currentLocation,
  drops = [],
  theme = {},
}) {
  if (!open) return null;
  const pockets = backpack?.pockets || {};
  const finds = pockets.finds || [];
  const photos = pockets.photos || [];
  const rewards = pockets.rewards || [];
  const utilities = pockets.utilities || [];
  const clues = pockets.clues || [];

  const surface = {
    background: theme.panelBg || 'rgba(14,20,28,0.92)',
    borderColor: theme.panelBorder || 'rgba(68,92,116,0.35)',
    color: theme.textColor || '#f4f7ff',
    accent: theme.accentColor || '#5cc8ff',
    muted: theme.mutedColor || 'rgba(198,212,236,0.78)',
    buttonBg: theme.buttonBg || 'rgba(24,32,40,0.85)',
    buttonBorder: theme.buttonBorder || 'rgba(128,156,204,0.42)',
  };

  return (
    <div style={wrap} onClick={onZip}>
      <div
        style={{
          ...panel,
          background: surface.background,
          border: `1px solid ${surface.borderColor}`,
          color: surface.color,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>Backpack</div>
            <div style={{ fontSize: 12, color: surface.muted }}>
              {currentLocation
                ? `Lat ${currentLocation.lat.toFixed(5)}, Lng ${currentLocation.lng.toFixed(5)} · ±${Math.round(
                    currentLocation.accuracy || 0
                  )}m`
                : 'Awaiting location lock…'}
            </div>
          </div>
          <button
            type="button"
            onClick={onZip}
            style={{
              ...btn,
              color: surface.color,
              background: surface.buttonBg,
              borderColor: surface.buttonBorder,
            }}
          >
            Zip it shut ✕
          </button>
        </div>

        <Section title="Geo Finds" surface={surface}>
          <FindGrid
            items={finds}
            onDrop={onDrop}
            onDiscard={onDiscard}
            currentLocation={currentLocation}
            surface={surface}
          />
        </Section>

        <Section title="Photos" surface={surface}>
          <ThumbGrid items={photos.map((item) => ({ id: item.id, title: item.title, url: item.url }))} surface={surface} />
        </Section>

        <Section title="Rewards" surface={surface}>
          <ThumbGrid items={rewards.map((item) => ({ id: item.id, title: item.name, url: item.thumbUrl }))} surface={surface} />
        </Section>

        <Section title="Utilities" surface={surface}>
          <ThumbGrid items={utilities.map((item) => ({ id: item.id, title: item.name, url: item.thumbUrl }))} surface={surface} />
        </Section>

        <Section title="Clues" surface={surface}>
          {clues.length === 0 ? (
            <div style={{ color: surface.muted }}>No clues yet.</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {clues.map((clue) => (
                <li key={clue.id} style={{ margin: '6px 0' }}>
                  <div>{clue.text}</div>
                  <div style={{ fontSize: 11, color: surface.muted }}>{toLocal(clue.ts)}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Drop Log" surface={surface}>
          {drops.length === 0 ? (
            <div style={{ color: surface.muted }}>No drops recorded yet.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {drops.map((drop) => (
                <div
                  key={drop.id}
                  style={{
                    border: `1px solid ${surface.borderColor}`,
                    borderRadius: 10,
                    padding: 10,
                    background: 'rgba(0,0,0,0.18)',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{drop.item?.name || drop.item?.title || 'Dropped item'}</div>
                  <div style={{ fontSize: 12, color: surface.muted }}>
                    {drop.lat != null && drop.lng != null
                      ? `Lat ${Number(drop.lat).toFixed(4)}, Lng ${Number(drop.lng).toFixed(4)}`
                      : 'Unknown location'}
                  </div>
                  <div style={{ fontSize: 12, color: surface.muted }}>
                    {drop.droppedAt || drop.dropped_at ? toLocal(drop.droppedAt || drop.dropped_at) : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, surface, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <div>{children}</div>
      <div style={{ borderTop: `1px solid ${surface.borderColor}`, marginTop: 12, opacity: 0.25 }} />
    </div>
  );
}

function ThumbGrid({ items, surface }) {
  if (!items.length) {
    return <div style={{ color: surface.muted }}>Empty.</div>;
  }
  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))' }}>
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            border: `1px solid ${surface.borderColor}`,
            borderRadius: 10,
            background: 'rgba(0,0,0,0.18)',
            padding: 8,
          }}
        >
          <div
            style={{
              width: '100%',
              height: 90,
              border: `1px solid ${surface.borderColor}`,
              borderRadius: 8,
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
              background: 'rgba(0,0,0,0.35)',
            }}
          >
            {item.url ? (
              <img alt="" src={item.url} style={{ maxWidth: '100%', maxHeight: '100%' }} />
            ) : (
              <div style={{ color: surface.muted }}>—</div>
            )}
          </div>
          <div style={{ fontSize: 12, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.title || 'Item'}
          </div>
        </div>
      ))}
    </div>
  );
}

function FindGrid({ items, onDrop, onDiscard, currentLocation, surface }) {
  if (!items.length) {
    return <div style={{ color: surface.muted }}>Locate a mission geofence to collect items.</div>;
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            border: `1px solid ${surface.borderColor}`,
            borderRadius: 10,
            padding: 10,
            background: 'rgba(0,0,0,0.18)',
          }}
        >
          <div style={{ display: 'flex', gap: 12 }}>
            {item.iconUrl ? (
              <img
                src={item.iconUrl}
                alt="icon"
                style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 8, background: 'rgba(0,0,0,0.35)' }}
              />
            ) : (
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.2)',
                  display: 'grid',
                  placeItems: 'center',
                  color: surface.muted,
                }}
              >
                🎒
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{item.name || 'Geo Find'}</div>
              {item.description && <div style={{ fontSize: 13, color: surface.muted }}>{item.description}</div>}
              <div style={{ fontSize: 12, color: surface.muted, marginTop: 6 }}>
                Collected {toLocal(item.collectedAt)}
                {item.lat != null && item.lng != null
                  ? ` • Origin ${Number(item.lat).toFixed(4)}, ${Number(item.lng).toFixed(4)}`
                  : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onDrop && onDrop(item)}
              disabled={!currentLocation}
              style={{
                ...btn,
                color: surface.color,
                background: surface.buttonBg,
                borderColor: surface.buttonBorder,
                opacity: currentLocation ? 1 : 0.5,
                cursor: currentLocation ? 'pointer' : 'not-allowed',
              }}
            >
              Drop here
            </button>
            <button
              type="button"
              onClick={() => onDiscard && onDiscard(item)}
              style={{
                ...btn,
                color: surface.color,
                background: 'rgba(120,24,32,0.65)',
                borderColor: 'rgba(220,82,96,0.65)',
              }}
            >
              Discard
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const wrap = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(4,8,12,0.72)',
  display: 'grid',
  placeItems: 'center',
  zIndex: 9999,
  padding: 16,
};

const panel = {
  width: 'min(920px, 96vw)',
  maxHeight: '88vh',
  overflowY: 'auto',
  borderRadius: 14,
  padding: 18,
  boxShadow: '0 28px 60px rgba(0,0,0,0.35)',
};

const btn = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid rgba(128,156,204,0.42)',
  background: 'rgba(24,32,40,0.85)',
  color: '#f4f7ff',
  cursor: 'pointer',
  transition: 'transform 0.15s ease',
};
