import { useEffect, useState } from 'react';

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET || 'admin-media';

export default function SupabaseTest() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const list = await fetch(`/api/supabase/list?bucket=${encodeURIComponent(BUCKET)}`).then((r) => r.json());
        if (!list.ok) throw new Error(list.error || 'list failed');
        const files = list.files || [];

        await Promise.all(
          files.map(async (f) => {
            const r = await fetch(
              `/api/supabase/sign?bucket=${encodeURIComponent(BUCKET)}&path=${encodeURIComponent(f.name)}&expiresIn=300`
            );
            const j = await r.json();
            f.url = j.ok ? j.url : '';
          })
        );

        setItems(files);
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: 'ui-sans-serif,system-ui' }}>
      <h1>Supabase Private Media (Signed URLs)</h1>
      {err && <pre style={{ color: 'crimson' }}>{err}</pre>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 160px)', gap: 12 }}>
        {items.map((f) => (
          <figure key={f.name} style={{ margin: 0 }}>
            <img src={f.url} alt={f.name} style={{ width: 160, height: 160, objectFit: 'cover', borderRadius: 12 }} />
            <figcaption style={{ fontSize: 12, wordBreak: 'break-all' }}>{f.name}</figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
