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

const PALETTE = {
  cardBg: 'rgba(12, 23, 40, 0.88)',
  cardBorder: '#1b2944',
  text: '#f4f7ff',
  muted: '#9aa8d8',
  pillBg: 'rgba(17, 31, 52, 0.85)',
  pillBorder: '#253458',
  accentBg: 'linear-gradient(135deg,#f97316 0%,#fb923c 100%)',
  accentBorder: 'rgba(249,115,22,0.7)',
  accentText: '#080c1a',
  dangerBg: 'rgba(86, 20, 33, 0.6)',
  dangerBorder: 'rgba(248,113,113,0.6)',
  inputBg: '#081123',
  inputBorder: '#253458',
};

function Section({ title, children, style }) {
  return (
    <div
      style={{
        background: PALETTE.cardBg,
        border: `1px solid ${PALETTE.cardBorder}`,
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        color: PALETTE.text,
        ...style,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function Pill({ children }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: 999,
        background: PALETTE.pillBg,
        border: `1px solid ${PALETTE.pillBorder}`,
        fontSize: 12,
        color: PALETTE.muted,
      }}
    >
      {children}
    </span>
  );
}

function SmallButton({ children, onClick, tone='solid' }) {
  const styles = tone === 'danger'
    ? {
        background: PALETTE.dangerBg,
        border: `1px solid ${PALETTE.dangerBorder}`,
        color: '#fcdbe1',
      }
    : {
        background: PALETTE.accentBg,
        border: `1px solid ${PALETTE.accentBorder}`,
        color: PALETTE.accentText,
        boxShadow: '0 8px 18px rgba(249,115,22,0.25)',
      };
  return (
    <button
      onClick={onClick}
      style={{
        ...styles,
        padding: '6px 10px',
        borderRadius: 10,
        fontWeight: 600,
        color: PALETTE.text,
        cursor: 'pointer',
      }}
    >
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
      (m?.type && String(m.type).toLowerCase()==='action') ||
      (Array.isArray(m?.tags) && m.tags.map(t=>String(t).toLowerCase()).includes('action'))
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
    <div style={{ color: PALETTE.text }}>
      {/* Trigger Automation */}
      <Section title="Trigger Automation">
        <label style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8, color: PALETTE.text }}>
          <input type="checkbox" checked={!!triggerEnabled} onChange={e=>setTriggerEnabled(e.target.checked)} />
          <span>Enable Assigned Media Trigger — instantly link media, devices, and missions.</span>
        </label>
        <div style={{ fontSize:12, color:PALETTE.muted, marginBottom:12 }}>
          Toggle on to coordinate triggers across media, devices, and missions.
        </div>

        {/* NEW: Assign Action Media (dropdown) */}
        <div style={{ marginTop:12 }}>
          <div style={{ fontWeight:600, marginBottom:6 }}>Assign Action Media</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center' }}>
            <select
              onChange={(e)=> assignActionMedia(e.target.value)}
              defaultValue=""
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${PALETTE.inputBorder}`,
                background: PALETTE.inputBg,
                color: PALETTE.text,
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
          <div style={{ fontSize:12, color:PALETTE.muted, marginTop:6 }}>
            Choose one or more media items to be used as **Action Media** (e.g., sound effects, short clips, effects).
          </div>
        </div>
      </Section>

      {/* Assigned Icons + NEW Action Media Section */}
      <Section title="Assigned Media">
        {/* Existing sections would go here (Mission Icons, Device Icons, Rewards, Penalties) */}

        {/* NEW: Action Media Section */}
        <div style={{ marginTop:8 }}>
          <div style={{ fontWeight:600, marginBottom:8 }}>Action Media ({safeAssigned.actionMedia.length})</div>
          {safeAssigned.actionMedia.length === 0 ? (
            <div style={{ fontSize:13, color:PALETTE.muted }}>No Action Media assigned yet.</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:12 }}>
              {safeAssigned.actionMedia.map(id => {
                const m = idToObj(id);
                return (
                  <div
                    key={id}
                    style={{
                      background: '#0f1418',
                      border: `1px solid ${PALETTE.cardBorder}`,
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ display:'grid', gridTemplateColumns:'60px 1fr', gap:12, alignItems:'center' }}>
                      <div
                        style={{
                          width: 60,
                          height: 60,
                          background: '#1a2027',
                          borderRadius: 10,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {m.thumbUrl
                          ? <img src={m.thumbUrl} alt={m.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          : <span style={{ fontSize:12, color:PALETTE.muted }}>no preview</span>}
                      </div>
                      <div>
                        <div style={{ fontWeight:600 }}>{m.name || m.id}</div>
                        <div style={{ fontSize:12, color:PALETTE.muted }}>{m.type || 'media'}</div>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8, marginTop:10 }}>
                      <SmallButton onClick={()=> window.open(m.openUrl || m.url || '#', '_blank')}>Open</SmallButton>
                      <SmallButton tone="danger" onClick={()=> removeActionMedia(id)}>Remove</SmallButton>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
