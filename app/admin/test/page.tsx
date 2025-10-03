// app/admin/test/page.tsx
'use client';

import { useEffect, useState } from 'react';

export default function TestPage() {
  const [loadedAt, setLoadedAt] = useState<string>('');

  useEffect(() => {
    setLoadedAt(new Date().toLocaleString());
  }, []);

  return (
    <main className="page">
      <h1>Test</h1>
      <p>Tab rendering check: this page mounted at <strong>{loadedAt || '…'}</strong>.</p>
      <pre style={{
        padding: 12,
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        overflowX: 'auto'
      }}>
{`{
  "status": "ok",
  "hint": "If you can see this, your Test tab is not blank."
}`}
      </pre>
    </main>
  );
}
