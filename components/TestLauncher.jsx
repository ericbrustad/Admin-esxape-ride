// components/TestLauncher.jsx
import { ADMIN_THEME } from '../lib/admin-shared';

const theme = ADMIN_THEME;

export default function TestLauncher({ slug, channel='draft', preferPretty=false, popup=false }) {
  const base =
    (typeof window !== 'undefined'
      ? (window.__GAME_ORIGIN__ || process.env.NEXT_PUBLIC_GAME_ORIGIN)
      : process.env.NEXT_PUBLIC_GAME_ORIGIN) || '';

  const buttonStyle = {
    padding: '10px 14px',
    borderRadius: 12,
    border: theme.borderSoft,
    background: theme.surfaceRaised,
    color: theme.textPrimary,
    cursor: 'pointer',
    boxShadow: theme.glassSheen,
  };

  if (!base || !slug) {
    return <button disabled style={{ ...buttonStyle, opacity: 0.55, cursor: 'not-allowed' }}>Open full window</button>;
  }

  const pretty = `${base}/${encodeURIComponent(slug)}?channel=${encodeURIComponent(channel)}&preview=1`;
  const query  = `${base}/?slug=${encodeURIComponent(slug)}&channel=${encodeURIComponent(channel)}&preview=1`;
  const href   = preferPretty ? pretty : query;

  const common = { target: '_blank', rel: 'noreferrer', style: { textDecoration: 'none' } };
  return (
    <a href={href} {...common}>
      <button style={buttonStyle}>
        Open full window
      </button>
    </a>
  );
}
