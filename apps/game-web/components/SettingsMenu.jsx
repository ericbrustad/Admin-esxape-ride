import React, { useState } from 'react';

function Toggle({ label, checked, onChange, description, accent }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <div style={{ fontWeight: 600 }}>{label}</div>
        {description && <div style={{ fontSize: 12, opacity: 0.7 }}>{description}</div>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{ width: 22, height: 22, accentColor: accent || '#5cc8ff' }}
      />
    </label>
  );
}

function Slider({ label, value, onChange, accent }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span>{label}</span>
        <span>{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ accentColor: accent || '#5cc8ff' }}
      />
    </label>
  );
}

export default function SettingsMenu({
  open,
  onToggle,
  sound,
  onSoundChange,
  mapOptions,
  onMapOptionsChange,
  theme = {},
}) {
  const [soundOpen, setSoundOpen] = useState(true);
  const [mapOpen, setMapOpen] = useState(false);

  const surface = {
    background: theme.panelBg || 'rgba(18,24,34,0.92)',
    borderColor: theme.panelBorder || 'rgba(68,92,116,0.35)',
    color: theme.textColor || '#f4f7ff',
    muted: theme.mutedColor || 'rgba(198,212,236,0.78)',
    accent: theme.accentColor || '#5cc8ff',
    buttonBg: theme.buttonBg || 'rgba(18,26,34,0.85)',
    buttonBorder: theme.buttonBorder || 'rgba(128,156,204,0.45)',
  };

  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 1200 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          padding: '10px 16px',
          borderRadius: 12,
          border: `1px solid ${surface.buttonBorder}`,
          background: surface.buttonBg,
          color: surface.color,
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          boxShadow: '0 12px 30px rgba(0,0,0,0.32)',
        }}
      >
        <span role="img" aria-hidden="true">⚙️</span>
        Settings
      </button>
      {open && (
        <div
          style={{
            marginTop: 12,
            width: 300,
            background: surface.background,
            border: `1px solid ${surface.borderColor}`,
            borderRadius: 14,
            padding: 16,
            boxShadow: '0 30px 60px rgba(0,0,0,0.4)',
            color: surface.color,
          }}
        >
          <Section
            title="Sound"
            open={soundOpen}
            onToggle={() => setSoundOpen((value) => !value)}
            muted={surface.muted}
          >
            <Toggle
              label="Theme Music"
              checked={sound.themeEnabled}
              onChange={(value) => onSoundChange({ ...sound, themeEnabled: value })}
              description="Play the appearance skin's ambient score."
              accent={surface.accent}
            />
            <Slider
              label="Theme music volume"
              value={sound.themeVolume}
              onChange={(value) => onSoundChange({ ...sound, themeVolume: value })}
              accent={surface.accent}
            />
            <Toggle
              label="Sound FX"
              checked={sound.fxEnabled}
              onChange={(value) => onSoundChange({ ...sound, fxEnabled: value })}
              description="Toggle interface and mission effects."
              accent={surface.accent}
            />
            <Slider
              label="Sound FX volume"
              value={sound.fxVolume}
              onChange={(value) => onSoundChange({ ...sound, fxVolume: value })}
              accent={surface.accent}
            />
          </Section>

          <Section
            title="Map Options"
            open={mapOpen}
            onToggle={() => setMapOpen((value) => !value)}
            muted={surface.muted}
          >
            <Toggle
              label="Show map labels"
              checked={mapOptions.showLabels}
              onChange={(value) => onMapOptionsChange({ ...mapOptions, showLabels: value })}
              accent={surface.accent}
            />
            <Toggle
              label="Show dropped items"
              checked={mapOptions.showDrops}
              onChange={(value) => onMapOptionsChange({ ...mapOptions, showDrops: value })}
              accent={surface.accent}
            />
            <Toggle
              label="Highlight geofence radius"
              checked={mapOptions.showRadius}
              onChange={(value) => onMapOptionsChange({ ...mapOptions, showRadius: value })}
              accent={surface.accent}
            />
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, open, onToggle, children, muted }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          padding: 0,
          marginBottom: 8,
          fontWeight: 700,
        }}
      >
        {title}
        <span style={{ fontSize: 18 }}>{open ? '▾' : '▸'}</span>
      </button>
      {open ? <div style={{ display: 'grid', gap: 14 }}>{children}</div> : <div style={{ fontSize: 12, color: muted }}>Collapsed</div>}
    </div>
  );
}
