import React from 'react';

/**
 * Compact single-row header for Admin.
 * - Normal mode: [Icon] [Title] [nav/actions -> horizontal scroll]
 * - Settings mode: [Icon] [Title] [Settings label] [Back button]
 * - Global status statement (Draft/Published) always visible (right side).
 */
export default function HeaderBar({
  iconUrl,
  title = 'Untitled Game',
  isSettings = false,
  status = 'draft', // 'draft' | 'published'
  onBack = () => {},
  onGo = () => {}, // (key) => void ; keys: 'settings','missions','devices','text','assigned','media','new','save','publish','update','save_and_publish'
  onUpdate = null,
  onSaveAndPublish = null,
}) {
  const S = styles;
  const statusIsPublished = String(status).toLowerCase() === 'published';
  const statusLabel = statusIsPublished ? 'This version is Published' : 'This version is a Draft';
  const statusStyle = statusIsPublished ? S.statusPublished : S.statusDraft;

  return (
    <header id="AdminHeaderBar" data-ui="headerbar" style={S.wrap}>
      <div style={S.left}>
        <div style={S.iconWrap}>
          {iconUrl ? <img src={iconUrl} alt="" style={S.icon} /> : <div style={S.iconPlaceholder} />}
        </div>
        <div style={S.titleWrap}>
          <div style={S.title}>{title}</div>
          {isSettings ? (
            <div style={S.subtitle}>Settings</div>
          ) : (
            <div style={S.subtitle}>Admin Control Deck</div>
          )}
        </div>
      </div>

      {/* Middle: actions (hidden in Settings mode except the Settings tag) */}
      <div style={S.middle}>
        {isSettings ? (
          <button type="button" onClick={() => onBack()} style={S.backBtn} aria-label="Back to main">
            ← Back
          </button>
        ) : (
          <div style={S.actionsRail} role="toolbar" aria-label="Primary actions">
            <button type="button" style={S.action} onClick={() => onGo('settings')}>Settings</button>
            <button type="button" style={S.action} onClick={() => onGo('missions')}>Missions</button>
            <button type="button" style={S.action} onClick={() => onGo('devices')}>Devices</button>
            <button type="button" style={S.action} onClick={() => onGo('text')}>Text</button>
            <button type="button" style={S.action} onClick={() => onGo('assigned')}>Assigned Media</button>
            <button type="button" style={S.action} onClick={() => onGo('media')}>Media Pool</button>
            <div style={S.railSpacer} />
          </div>
        )}
      </div>

      {/* Right: global save actions + status */}
      <div style={S.right}>
        <button
          type="button"
          onClick={() => (onUpdate ? onUpdate() : onGo('update'))}
          style={S.updateBtn}
          title="Save (stay in current channel)"
        >
          Update
        </button>
        <button
          type="button"
          onClick={() => (onSaveAndPublish ? onSaveAndPublish() : onGo('save_and_publish'))}
          style={S.savePublishBtn}
          title="Save changes and publish live"
        >
          Save &amp; Publish
        </button>
        <span style={{ ...S.status, ...statusStyle }}>{statusLabel}</span>
      </div>
    </header>
  );
}

const styles = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '6px 12px',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
    background: 'rgba(255,255,255,0.82)',
    backdropFilter: 'saturate(150%) blur(6px)',
    height: 56, // thinner header
    boxSizing: 'border-box',
  },
  left: { display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 },
  iconWrap: { width: 36, height: 36, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' },
  icon: { width: '100%', height: '100%', objectFit: 'cover' },
  iconPlaceholder: { width: '100%', height: '100%', background: 'linear-gradient(135deg,#e8e8f4,#d9d9ef)' },
  titleWrap: { display: 'flex', flexDirection: 'column', lineHeight: 1 },
  title: { fontSize: 16, fontWeight: 700, color: '#0f172a', letterSpacing: 0.2, whiteSpace: 'nowrap' },
  subtitle: { fontSize: 11, color: '#64748b', letterSpacing: 0.3, whiteSpace: 'nowrap' },

  middle: { flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center' },
  actionsRail: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    overflowX: 'auto',
    scrollbarWidth: 'thin',
    padding: '4px 6px',
  },
  action: {
    fontSize: 12,
    padding: '6px 10px',
    borderRadius: 10,
    border: '1px solid rgba(15,23,42,0.12)',
    background: 'white',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  railSpacer: { width: 10, flex: '0 0 auto' },

  right: { display: 'flex', alignItems: 'center', gap: 8 },
  updateBtn: {
    fontSize: 12,
    padding: '6px 10px',
    borderRadius: 12,
    border: '1px solid rgba(15,23,42,0.12)',
    background: 'white',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontWeight: 600,
  },
  savePublishBtn: {
    fontSize: 12,
    padding: '6px 10px',
    borderRadius: 12,
    border: '1px solid rgba(34,197,94,0.45)',
    background: 'rgba(34,197,94,0.25)',
    opacity: 0.5,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontWeight: 700,
    color: '#065f46',
  },
  status: {
    fontSize: 12,
    padding: '4px 8px',
    borderRadius: 999,
    border: '1px solid',
    whiteSpace: 'nowrap',
    fontWeight: 600,
  },
  statusDraft: {
    color: '#9a3412', // orange-800
    borderColor: 'rgba(234,88,12,0.45)', // orange-500
    background: 'rgba(234,88,12,0.08)',
  },
  statusPublished: {
    color: '#166534', // green-800
    borderColor: 'rgba(34,197,94,0.45)', // green-500
    background: 'rgba(34,197,94,0.08)',
  },
  backBtn: {
    fontSize: 12,
    padding: '6px 10px',
    borderRadius: 10,
    border: '1px solid rgba(15,23,42,0.12)',
    background: 'white',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};
