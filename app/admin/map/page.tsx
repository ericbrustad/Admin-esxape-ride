// app/admin/map/page.tsx
import dynamic from 'next/dynamic';

// Make the map strictly client-side to avoid "window is not defined" on SSR
const MapTab = dynamic(() => import('./MapTab'), {
  ssr: false,
  loading: () => <p style={{ padding: 24 }}>Loading map…</p>,
});

export default function MapPage() {
  return (
    <main className="page">
      <h1>Map</h1>
      <p>Place and preview your clue locations.</p>
      <MapTab active />
    </main>
  );
}
