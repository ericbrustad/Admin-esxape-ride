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

const surfaceStyle = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 14,
};

const textColor = 'var(--text)';
const mutedColor = 'var(--muted)';
const accentColor = 'var(--accent)';

function Section({ title, children, style }) {
  return (
    <div style={{ ...surfaceStyle, padding: 16, marginBottom: 16, ...style }}>
      <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 8, color: textColor }}>{title}</div>
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
        background: 'rgba(45, 212, 191, 0.12)',
        border: `1px solid ${accentColor}`,
        fontSize: 12,
        color: accentColor,
      }}
    >
      {children}
    </span>
  );
}

function SmallButton({ children, onClick, tone = 'solid' }) {
  const tones = {
    solid: {
      background: 'rgba(45, 212, 191, 0.14)',
      border: `1px solid ${accentColor}`,
      color: textColor,
    },
    danger: {
      background: 'rgba(239, 68, 68, 0.16)',
      border: '1px solid rgba(248, 113, 113, 0.5)',
      color: textColor,
    },
  };
  return (
    <button
      onClick={onClick}
      style={{ ...tones[tone] || tones.solid, padding: '6px 10px', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}
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
    <div>
      {/* Trigger Automation */}
      <Section title="Trigger Automation">
        <label style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8, color:textColor }}>
          <input type="checkbox" checked={!!triggerEnabled} onChange={e=>setTriggerEnabled(e.target.checked)} />
          <span>Enable Assigned Media Trigger — instantly link media, devices, and missions.</span>
        </label>
        <div style={{ fontSize:12, color:mutedColor, marginBottom:12 }}>
          Toggle on to coordinate triggers across media, devices, and missions.
        </div>

        {/* NEW: Assign Action Media (dropdown) */}
        <div style={{ marginTop:12 }}>
          <div style={{ fontWeight:600, marginBottom:6, color:textColor }}>Assign Action Media</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center' }}>
            <select
              onChange={(e)=> assignActionMedia(e.target.value)}
              defaultValue=""
              style={{
                padding:'10px 12px',
                borderRadius:10,
                border:'1px solid var(--border)',
                background:'var(--bg)',
                color:textColor,
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
          <div style={{ fontSize:12, color:mutedColor, marginTop:6 }}>
            Choose one or more media items to be used as <strong style={{ color:textColor }}>Action Media</strong> (e.g., sound effects, short clips, effects).
          </div>
        </div>
      </Section>

      {/* Assigned Icons + NEW Action Media Section */}
      <Section title="Assigned Media">
        {/* Existing sections would go here (Mission Icons, Device Icons, Rewards, Penalties) */}

        {/* NEW: Action Media Section */}
        <div style={{ marginTop:8 }}>
          <div style={{ fontWeight:600, marginBottom:8, color:textColor }}>Action Media ({safeAssigned.actionMedia.length})</div>
          {safeAssigned.actionMedia.length === 0 ? (
            <div style={{ fontSize:13, color:mutedColor }}>No Action Media assigned yet.</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:12 }}>
              {safeAssigned.actionMedia.map(id => {
                const m = idToObj(id);
                return (
                  <div key={id} style={{ ...surfaceStyle, borderRadius:12, padding:12 }}>
                    <div style={{ display:'grid', gridTemplateColumns:'60px 1fr', gap:12, alignItems:'center' }}>
                      <div style={{ width:60, height:60, background:'#0f1b20', borderRadius:10, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {m.thumbUrl ? <img src={m.thumbUrl} alt={m.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <span style={{ fontSize:12, color:mutedColor }}>no preview</span>}
                      </div>
                      <div>
                        <div style={{ fontWeight:600, color:textColor }}>{m.name || m.id}</div>
                        <div style={{ fontSize:12, color:mutedColor }}>{m.type || 'media'}</div>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8, marginTop:10 }}>
                      <SmallButton
                        onClick={() => {
                          const url = m.openUrl || m.url || '#';
                          const win = window.open(url, '_blank', 'noopener,noreferrer');
                          if (win) win.opener = null;
                        }}
                      >
                        Open
                      </SmallButton>
                      <SmallButton onClick={()=> removeActionMedia(id)} tone="danger">
                        Remove
                      </SmallButton>
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
