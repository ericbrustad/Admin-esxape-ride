// components/MapTab.tsx
'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, useMap, Marker, Popup } from 'react-leaflet';

function SizeInvalidator({ active = true }: { active?: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => map.invalidateSize(), 0);
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    return () => { clearTimeout(id); window.removeEventListener('resize', onResize); };
  }, [active, map]);
  return null;
}

export default function MapTab({ active = true }: { active?: boolean }) {
  const center: [number, number] = [44.9778, -93.265];
  return (
    <div className="mapShell">
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <SizeInvalidator active={active} />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                   attribution="&copy; OpenStreetMap contributors"/>
        <Marker position={center}><Popup>Clue example</Popup></Marker>
      </MapContainer>
    </div>
  );
}
