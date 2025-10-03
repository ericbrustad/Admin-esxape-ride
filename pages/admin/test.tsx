// pages/admin/test.tsx
import { useEffect, useState } from 'react';

export default function TestPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return (
    <main className="page">
      <h1>Test</h1>
      <p>Render check: {ready ? '✅ Mounted' : '…'}</p>
    </main>
  );
}
