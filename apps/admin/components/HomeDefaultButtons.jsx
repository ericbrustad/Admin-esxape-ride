// CODEx note: Drop-in main-screen buttons that respect default selections.
import React from 'react';

const styles = {
  wrap: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  button: {
    borderRadius: 12,
    border: '1px solid var(--admin-border-soft)',
    background: 'var(--admin-panel-bg)',
    color: 'var(--admin-body-color)',
    padding: '8px 16px',
    cursor: 'pointer',
    boxShadow: '0 12px 24px rgba(15, 23, 42, 0.3)',
  },
};

function getDefaultSlugs() {
  const envDefaultGame = (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_DEFAULT_GAME_SLUG)
    ? process.env.NEXT_PUBLIC_DEFAULT_GAME_SLUG
    : '';
  const envPublished = (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_DEFAULT_PUBLISHED_GAME_SLUG)
    ? process.env.NEXT_PUBLIC_DEFAULT_PUBLISHED_GAME_SLUG
    : '';
  const any =
    (typeof window !== 'undefined' && localStorage.getItem('esx_default_game_slug')) ||
    envDefaultGame ||
    '';
  const pub =
    (typeof window !== 'undefined' && localStorage.getItem('esx_default_published_game_slug')) ||
    envPublished ||
    '';
  return { any, pub };
}

function getGameOrigin() {
  const envOrigin = (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_GAME_ORIGIN)
    ? process.env.NEXT_PUBLIC_GAME_ORIGIN
    : '';
  if (typeof window !== 'undefined') {
    return window.__GAME_ORIGIN__ || envOrigin || '';
  }
  return envOrigin;
}

export default function HomeDefaultButtons() {
  const [{ any, pub }, setState] = React.useState(getDefaultSlugs());
  const base = getGameOrigin();

  React.useEffect(() => {
    const onUpdate = () => setState(getDefaultSlugs());
    if (typeof window !== 'undefined') {
      window.addEventListener('esx:defaults:updated', onUpdate);
      return () => window.removeEventListener('esx:defaults:updated', onUpdate);
    }
    return undefined;
  }, []);

  const go = (slug, channel) => {
    if (typeof window === 'undefined') return;
    if (!base || !slug) return;
    const pretty = `${base}/${encodeURIComponent(slug)}?channel=${encodeURIComponent(channel || 'draft')}&preview=1`;
    const query = `${base}/?slug=${encodeURIComponent(slug)}&channel=${encodeURIComponent(channel || 'draft')}&preview=1`;
    const href = channel === 'published' ? pretty : query;
    window.open(href, '_blank', 'noreferrer');
  };

  const disabledStyle = { opacity: 0.5, cursor: 'not-allowed', boxShadow: 'none' };
  const canOpenAny = Boolean(any && base);
  const canOpenPub = Boolean(pub && base);

  return (
    <div style={styles.wrap}>
      {any ? (
        <button
          style={{ ...styles.button, ...(canOpenAny ? {} : disabledStyle) }}
          onClick={() => go(any, 'draft')}
          disabled={!canOpenAny}
        >
          Open Default Game
        </button>
      ) : null}
      {pub ? (
        <button
          style={{ ...styles.button, ...(canOpenPub ? {} : disabledStyle) }}
          onClick={() => go(pub, 'published')}
          disabled={!canOpenPub}
        >
          Open Published
        </button>
      ) : null}
    </div>
  );
}
