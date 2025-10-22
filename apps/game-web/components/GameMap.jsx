import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, Tooltip, useMap } from 'react-leaflet';

function RecenterOnPlayer({ playerLocation }) {
  const map = useMap();
  useEffect(() => {
    if (playerLocation && playerLocation.lat && playerLocation.lng) {
      map.setView([playerLocation.lat, playerLocation.lng], map.getZoom(), { animate: true });
    }
  }, [playerLocation, map]);
  return null;
}

function RecenterOnStart({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center.lat && center.lng) {
      map.setView([center.lat, center.lng]);
    }
  }, [center, map]);
  return null;
}

function tileUrl(showLabels) {
  return showLabels
    ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';
}

function tileAttribution(showLabels) {
  return showLabels
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    : '&copy; <a href="https://carto.com/attributions">CARTO</a>'; // nolabels tiles
}

function toLatLng(item) {
  const lat = Number(item.lat);
  const lng = Number(item.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
}

function missionGeofences(missions = []) {
  return missions
    .filter((mission) => mission?.content?.geofenceEnabled && Number.isFinite(mission.content.lat) && Number.isFinite(mission.content.lng))
    .map((mission) => ({
      id: mission.id,
      title: mission.title,
      radius: Number(mission.content.radiusMeters) || 40,
      lat: Number(mission.content.lat),
      lng: Number(mission.content.lng),
      description: mission.content.question || '',
    }));
}

function deviceGeofences(devices = []) {
  return (devices || [])
    .filter((device) => Number.isFinite(device.lat) && Number.isFinite(device.lng))
    .map((device) => ({
      id: device.id,
      title: device.title,
      radius: Number(device.pickupRadius) || 50,
      lat: Number(device.lat),
      lng: Number(device.lng),
      description: device.type || '',
    }));
}

export default function GameMap({
  center,
  playerLocation,
  missions,
  devices,
  drops,
  options,
}) {
  const missionZones = useMemo(() => missionGeofences(missions), [missions]);
  const deviceZones = useMemo(() => deviceGeofences(devices), [devices]);
  const showRadius = options?.showRadius !== false;
  const showDrops = options?.showDrops !== false;
  const showLabels = options?.showLabels !== false;

  const startCenter = center && Number.isFinite(center.lat) && Number.isFinite(center.lng)
    ? [Number(center.lat), Number(center.lng)]
    : [38.9072, -77.0369];

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative', zIndex: 1 }}>
      <MapContainer center={startCenter} zoom={options?.zoom || 15} style={{ height: '100%', width: '100%' }}>
        <TileLayer url={tileUrl(showLabels)} attribution={tileAttribution(showLabels)} />
        <RecenterOnStart center={center} />
        {playerLocation && <RecenterOnPlayer playerLocation={playerLocation} />}

        {playerLocation && (
          <Circle
            center={[playerLocation.lat, playerLocation.lng]}
            radius={Math.max(playerLocation.accuracy || 20, 15)}
            pathOptions={{ color: '#5cc8ff', weight: 2, opacity: 0.6, fillOpacity: 0.15 }}
          >
            <Tooltip direction="top" offset={[0, -10]} permanent>
              <span>You</span>
            </Tooltip>
          </Circle>
        )}

        {missionZones.map((zone) => (
          <Circle
            key={`mission-${zone.id}`}
            center={[zone.lat, zone.lng]}
            radius={showRadius ? zone.radius : 12}
            pathOptions={{ color: '#ff7a18', weight: showRadius ? 2 : 0, fillOpacity: 0.18, fillColor: '#ff7a18' }}
          >
            <Tooltip direction="top" offset={[0, -12]} permanent>
              <div style={{ fontWeight: 700 }}>Mission: {zone.title}</div>
              {zone.description && <div style={{ fontSize: 11 }}>{zone.description}</div>}
            </Tooltip>
          </Circle>
        ))}

        {deviceZones.map((zone) => (
          <Circle
            key={`device-${zone.id}`}
            center={[zone.lat, zone.lng]}
            radius={showRadius ? zone.radius : 10}
            pathOptions={{ color: '#5cc8ff', weight: showRadius ? 1.5 : 0, fillOpacity: 0.12, fillColor: '#5cc8ff' }}
          >
            <Tooltip direction="top" offset={[0, -12]} permanent>
              <div style={{ fontWeight: 700 }}>Device: {zone.title}</div>
              {zone.description && <div style={{ fontSize: 11 }}>{zone.description}</div>}
            </Tooltip>
          </Circle>
        ))}

        {showDrops && (drops || []).map((drop) => {
          const coords = toLatLng(drop);
          if (!coords) return null;
          return (
            <CircleMarker key={`drop-${drop.id}`} center={coords} radius={6} pathOptions={{ color: '#ffd54f', weight: 2, fillColor: '#ffd54f', fillOpacity: 0.9 }}>
              <Tooltip direction="top" offset={[0, -8]}>
                <div style={{ fontWeight: 600 }}>{drop.item?.name || drop.item?.title || 'Dropped item'}</div>
                {drop.droppedAt && <div style={{ fontSize: 11 }}>{new Date(drop.droppedAt).toLocaleString()}</div>}
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
