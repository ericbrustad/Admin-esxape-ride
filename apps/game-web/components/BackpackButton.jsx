import React from 'react';

export default function BackpackButton({ onClick, count = 0, theme = {} }) {
  const surface = {
    background: theme.buttonBg || 'rgba(14,20,28,0.85)',
    borderColor: theme.buttonBorder || 'rgba(128,156,204,0.45)',
    color: theme.textColor || '#f4f7ff',
    accent: theme.accentColor || '#5cc8ff',
  };

  return (
    <button
      aria-label="Backpack"
      onClick={onClick}
      style={{
        ...btn,
        background: surface.background,
        borderColor: surface.borderColor,
        color: surface.color,
      }}
    >
      <span style={{ fontSize: 22, marginRight: 8 }}>🎒</span>
      <span style={{ fontWeight: 600 }}>Backpack</span>
      <span
        style={{
          marginLeft: 10,
          minWidth: 26,
          height: 26,
          borderRadius: 13,
          background: surface.accent,
          color: '#06121e',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 13,
          padding: '0 8px',
        }}
      >
        {count}
      </span>
    </button>
  );
}

const btn = {
  position: 'fixed',
  left: 16,
  bottom: 20,
  zIndex: 1200,
  padding: '12px 18px',
  borderRadius: 14,
  border: '1px solid rgba(128,156,204,0.45)',
  background: 'rgba(14,20,28,0.85)',
  color: '#f4f7ff',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  boxShadow: '0 12px 28px rgba(0,0,0,0.32)',
  gap: 4,
};
