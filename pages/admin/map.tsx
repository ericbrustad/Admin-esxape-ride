// pages/admin/map.tsx
import dynamic from 'next/dynamic';

const MapTab = dynamic(() => import('../../components/MapTab'), {
  ssr: false,
  loading: () => <p style={{ padding: 24 }}>Loading map…</p>,
});

export default function MapPage() {
  return (
    <main className="page">
      <h1>Map</h1>
      <MapTab active />
    </main>
  );
}
