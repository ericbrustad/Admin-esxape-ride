import React from 'react';

const boxStyle = {
  display: 'grid',
  gap: 12,
  padding: 12,
  border: '1px solid rgba(15,23,42,0.12)',
  borderRadius: 12,
  background: 'white',
};

export default function ProjectFlags({ flags = null, busy = false, error = '', onUpdate = () => {} }) {
  const gameEnabled = typeof flags?.game_enabled === 'boolean' ? flags.game_enabled : true;
  const defaultChannel = flags?.new_game_default_channel === 'published' ? 'published' : 'draft';

  return (
    <div style={boxStyle}>
      <div style={{ fontWeight: 700, color: '#0f172a' }}>Project Flags</div>
      {error && (
        <div style={{ color: '#991b1b', fontSize: 12 }}>
          {error}
        </div>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="checkbox"
          checked={gameEnabled}
          disabled={busy}
          onChange={(event) => onUpdate({ game_enabled: event.target.checked })}
        />
        <span>Mirror to Game project (GAME_ENABLED)</span>
      </label>

      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontSize: 12, color: '#334155', fontWeight: 600 }}>New Game default channel</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input
              type="radio"
              name="new-game-default-channel"
              checked={defaultChannel === 'draft'}
              disabled={busy}
              onChange={() => onUpdate({ new_game_default_channel: 'draft' })}
            />
            Draft
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input
              type="radio"
              name="new-game-default-channel"
              checked={defaultChannel === 'published'}
              disabled={busy}
              onChange={() => onUpdate({ new_game_default_channel: 'published' })}
            />
            Live (Publish)
          </label>
        </div>
      </div>
    </div>
  );
}
