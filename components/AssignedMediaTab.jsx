import React, { useMemo } from 'react';

/**
 * AssignedMediaTab (drop-in)
 * - Adds "Assign Action Media" under Trigger Automation
 * - Adds an "Action Media" section in Assigned Media
 *
 * EXPECTED PROPS (flexible, safe defaults):
 *   mediaPool: Array<{ id: string, name: string, type?: string, tags?: string[], thumbUrl?: string }>
 *   assigned: {
 *     missionIcons?: string[],
 *     deviceIcons?: string[],
 *     rewardMedia?: string[],
 *     penaltyMedia?: string[],
 *     actionMedia?: string[]
 *   }
 *   onChange: (nextAssigned) => void
 *   triggerEnabled?: boolean
 *   setTriggerEnabled?: (v:boolean) => void
 *
 * You can replace your existing Assigned Media tab component with this one,
 * or mount this alongside and pass-through your data.
 */

const colors = {
  surface: '#12181d',
  surfaceSoft: '#0f1418',
  border: '#1f262d',
  borderStrong: '#2a323b',
  text: '#e9eef2',
  muted: '#9fb0bf',
  accent: '#38bdf8',
  dangerBg: '#2a1313',
  dangerBorder: '#7a1f1f',
};

function Section({ title, children, style }) {
  return (
    <section
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        color: colors.text,
        ...style,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 12 }}>{title}</div>
      {children}
    </section>
  );
}

function Pill({ children }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 12px',
        borderRadius: 999,
        background: '#1a2027',
        border: `1px solid ${colors.borderStrong}`,
        fontSize: 12,
        color: colors.muted,
      }}
    >
      {children}
    </span>
  );
}

function SmallButton({ children, onClick, tone = 'solid', style = {} }) {
  const base = {
    padding: '8px 12px',
    borderRadius: 10,
    fontWeight: 600,
    cursor: 'pointer',
    background: '#1a2027',
    border: `1px solid ${colors.borderStrong}`,
    color: colors.text,
  };
  const toneStyle = tone === 'danger'
    ? { background: colors.dangerBg, border: `1px solid ${colors.dangerBorder}`, color: '#fca5a5' }
    : tone === 'ghost'
      ? { background: 'transparent', border: `1px solid ${colors.border}`, color: colors.muted }
      : { background: '#1a2027', border: `1px solid ${colors.borderStrong}`, color: colors.text };
  return (
    <button type="button" onClick={onClick} style={{ ...base, ...toneStyle, ...style }}>
      {children}
    </button>
  );
}

export default function AssignedMediaTab({
  mediaPool = [],
  assigned = {},
  onChange = () => {},
  triggerEnabled = false,
  setTriggerEnabled = () => {}
}) {
  const safeAssigned = {
    missionIcons: assigned.missionIcons || [],
    deviceIcons: assigned.deviceIcons || [],
    rewardMedia: assigned.rewardMedia || [],
    penaltyMedia: assigned.penaltyMedia || [],
    actionMedia: assigned.actionMedia || [],
  };

  // "Action" candidates: prefer items with type === 'action' or tag 'action'.
  // Fallback to all media when no action-tagged items exist.
  const actionCandidates = useMemo(() => {
    const tagged = mediaPool.filter(m =>
      (m?.type && String(m.type).toLowerCase() === 'action') ||
      (Array.isArray(m?.tags) && m.tags.map(t => String(t).toLowerCase()).includes('action'))
    );
    return tagged.length ? tagged : mediaPool;
  }, [mediaPool]);

  function assignActionMedia(id) {
    if (!id) return;
    if (safeAssigned.actionMedia.includes(id)) return;
    const next = { ...safeAssigned, actionMedia: [...safeAssigned.actionMedia, id] };
    onChange(next);
  }

  function removeActionMedia(id) {
    const next = { ...safeAssigned, actionMedia: safeAssigned.actionMedia.filter(x => x !== id) };
    onChange(next);
  }

  const idToObj = (id) => mediaPool.find(m => m.id === id) || { id, name: id };

  return (
    <div style={{ color: colors.text }}>
      {/* Trigger Automation */}
      <Section title="Trigger Automation">
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={!!triggerEnabled}
            onChange={e => setTriggerEnabled(e.target.checked)}
            style={{ accentColor: '#22c55e' }}
          />
          <span style={{ color: colors.muted }}>
            Enable Assigned Media Trigger — instantly link media, devices, and missions.
          </span>
        </label>
        <div style={{ fontSize: 12, color: colors.muted, marginBottom: 12 }}>
          Toggle on to coordinate triggers across media, devices, and missions.
        </div>

        {/* NEW: Assign Action Media (dropdown) */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Assign Action Media</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
            <select
              onChange={(e) => assignActionMedia(e.target.value)}
              defaultValue=""
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${colors.borderStrong}`,
                background: '#0b0c10',
                color: colors.text,
              }}
            >
              <option value="" disabled>Select action media…</option>
              {actionCandidates.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
            </select>
            <Pill>{safeAssigned.actionMedia.length} assigned</Pill>
          </div>
          <div style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>
            Choose one or more media items to be used as <strong>Action Media</strong> (e.g., sound effects, short clips, effects).
          </div>
        </div>
      </Section>

      {/* Assigned Icons + NEW Action Media Section */}
      <Section title="Assigned Media">
        {/* Existing sections would go here (Mission Icons, Device Icons, Rewards, Penalties) */}

        {/* NEW: Action Media Section */}
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Action Media ({safeAssigned.actionMedia.length})</div>
          {safeAssigned.actionMedia.length === 0 ? (
            <div style={{ fontSize: 13, color: colors.muted }}>No Action Media assigned yet.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {safeAssigned.actionMedia.map(id => {
                const m = idToObj(id);
                return (
                  <div
                    key={id}
                    style={{
                      background: colors.surfaceSoft,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 14,
                      padding: 14,
                      display: 'grid',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 12, alignItems: 'center' }}>
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          background: '#11161a',
                          borderRadius: 12,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        {m.thumbUrl ? (
                          <img src={m.thumbUrl} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 12, color: colors.muted }}>no preview</span>
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{m.name || m.id}</div>
                        <div style={{ fontSize: 12, color: colors.muted }}>{m.type || 'media'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <SmallButton
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            window.open(m.openUrl || m.url || '#', '_blank');
                          }
                        }}
                      >
                        Open
                      </SmallButton>
                      <SmallButton tone="danger" onClick={() => removeActionMedia(id)}>
                        Remove
                      </SmallButton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
