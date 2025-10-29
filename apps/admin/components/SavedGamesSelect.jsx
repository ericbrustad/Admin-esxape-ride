// CODEX NOTE: Settings-page "Saved Games" dropdown.
// Lists ALL games (draft + published) and includes a "Default (reset)" option.
import React from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/router';

const fetcher = (url) => fetch(url).then((r) => r.json());

const S = {
  label: { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 },
  help: { fontSize: 12, opacity: 0.7, marginTop: 6 },
  select: {
    width: '100%',
    maxWidth: 760,
    border: '1px solid #D1D5DB',
    borderRadius: 10,
    padding: '10px 12px',
    background: 'transparent',
    outline: 'none',
  },
};

function labelFor(g) {
  const suffix =
    g.channel === 'published' ? ' (published)' : g.channel === 'draft' ? ' (draft)' : '';
  return `${g.title}${suffix}`;
}

export default function SavedGamesSelect() {
  const router = useRouter();
  const { data, isLoading } = useSWR('/api/games/list?includeDrafts=1', fetcher, {
    revalidateOnFocus: false,
  });

  const items = data?.items ?? [];

  function openGame(slug, channel) {
    const query = { ...router.query, game: slug, channel };
    router.push({ pathname: router.pathname, query }, undefined, { shallow: true });
  }

  return (
    <div>
      <label style={S.label}>Saved Games</label>
      <select
        style={S.select}
        defaultValue=""
        onChange={(e) => {
          const val = e.target.value;
          if (!val) return;
          if (val === '__default__') {
            openGame('default', 'draft');
            return;
          }
          const [slug, channel] = val.split('::');
          openGame(slug, channel || 'draft');
        }}
      >
        <option value="" disabled>
          {isLoading ? 'Loading…' : 'Select a game'}
        </option>
        <option value="__default__">Default (reset)</option>
        {items.map((g) => (
          <option key={`${g.slug}-${g.channel}`} value={`${g.slug}::${g.channel}`}>
            {labelFor(g)}
          </option>
        ))}
      </select>
      <div style={S.help}>
        Switch to another saved escape ride. Use the “+ New Game” control in the top navigation to add a
        title.
      </div>
    </div>
  );
}
