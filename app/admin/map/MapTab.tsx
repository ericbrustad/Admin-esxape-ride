// app/admin/map/MapTab.tsx
'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';

/**
 * Ensures the map recalculates its size after first paint and on window resize.
 * If you mount this within a hidden tab and then show it, call the component
 * again or trigger a rerender so the effect runs; or pass `active` state down
 * and invoke map.invalidateSize() on tab change.
 */
function SizeInvalidator({ active = true }: { active?: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!active) return;
    // After the tab becomes visible, let layout settle then fix sizing
    const id = setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {}
    }, 0);

    const onResize = () => {
      try {
        map.invalidateSize();
      } catch {}
    };
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(id);
      window.removeEventListener('resize', onResize);
    };
  }, [active, map]);

  return null;
}

export default function MapTab({ active = true }: { active?: boolean }) {
  const center: [number, number] = [44.9778, -93.265]; // example: Minneapolis

  return (
    <div className="mapShell">
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%' }} // must fill the shell which has explicit height
        scrollWheelZoom
      >
        <SizeInvalidator active={active} />
        <TileLayer
          // You can swap tile providers later
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <Marker position={center}>
          <Popup>Drop pins for clue locations here.</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
