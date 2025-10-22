import React, { useEffect, useMemo, useRef, useState } from 'react';

const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

let leafletPromise = null;

function ensureLeafletStyles() {
  if (typeof document === 'undefined') return;
  if (document.querySelector('link[data-leaflet]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = LEAFLET_CSS;
  link.setAttribute('data-leaflet', 'true');
  document.head.appendChild(link);
}

function loadLeaflet() {
  if (typeof window === 'undefined') {
    return Promise.resolve(null);
  }

  if (window.L) {
    ensureLeafletStyles();
    return Promise.resolve(window.L);
  }

  if (!leafletPromise) {
    ensureLeafletStyles();
    leafletPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = LEAFLET_JS;
      script.async = true;
      script.onload = () => {
        if (window.L) {
          resolve(window.L);
        } else {
          reject(new Error('Leaflet failed to initialize'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load Leaflet assets'));
      document.head.appendChild(script);
    });
  }

  return leafletPromise;
}

function toLatLng(item) {
  const lat = Number(item?.lat);
  const lng = Number(item?.lng);
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

function tileUrl(showLabels) {
  return showLabels
    ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';
}

function tileAttribution(showLabels) {
  return showLabels
    ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    : '&copy; <a href="https://carto.com/attributions">CARTO</a>';
}

function renderMissionZones(state, zones, showRadius) {
  const { L, missionLayer } = state;
  missionLayer.clearLayers();
  zones.forEach((zone) => {
    const coords = toLatLng(zone);
    if (!coords) return;
    const circle = L.circle(coords, {
      radius: showRadius ? zone.radius : 12,
      color: '#ff7a18',
      weight: showRadius ? 2 : 0,
      fillOpacity: 0.18,
      fillColor: '#ff7a18',
    });
    const description = zone.description ? `<div style="font-size:11px;">${zone.description}</div>` : '';
    circle.bindTooltip(
      `<div style="font-weight:700;">Mission: ${zone.title}</div>${description}`,
      { direction: 'top', offset: [0, -12], permanent: true }
    );
    circle.addTo(missionLayer);
  });
}

function renderDeviceZones(state, zones, showRadius) {
  const { L, deviceLayer } = state;
  deviceLayer.clearLayers();
  zones.forEach((zone) => {
    const coords = toLatLng(zone);
    if (!coords) return;
    const circle = L.circle(coords, {
      radius: showRadius ? zone.radius : 10,
      color: '#5cc8ff',
      weight: showRadius ? 1.5 : 0,
      fillOpacity: 0.12,
      fillColor: '#5cc8ff',
    });
    const description = zone.description ? `<div style="font-size:11px;">${zone.description}</div>` : '';
    circle.bindTooltip(
      `<div style="font-weight:700;">Device: ${zone.title}</div>${description}`,
      { direction: 'top', offset: [0, -12], permanent: true }
    );
    circle.addTo(deviceLayer);
  });
}

function renderDrops(state, drops) {
  const { L, dropLayer } = state;
  dropLayer.clearLayers();
  drops.forEach((drop) => {
    const coords = toLatLng(drop);
    if (!coords) return;
    const marker = L.circleMarker(coords, {
      radius: 6,
      color: '#ffd54f',
      weight: 2,
      fillColor: '#ffd54f',
      fillOpacity: 0.9,
    });
    const subtitle = drop.droppedAt
      ? `<div style="font-size:11px;">${new Date(drop.droppedAt).toLocaleString()}</div>`
      : '';
    marker.bindTooltip(
      `<div style="font-weight:600;">${drop.item?.name || drop.item?.title || 'Dropped item'}</div>${subtitle}`,
      { direction: 'top', offset: [0, -8] }
    );
    marker.addTo(dropLayer);
  });
}

function renderPlayer(state, playerLocation) {
  const { L } = state;
  if (!playerLocation || !Number.isFinite(playerLocation.lat) || !Number.isFinite(playerLocation.lng)) {
    if (state.playerCircle) {
      state.playerCircle.remove();
      state.playerCircle = null;
    }
    return;
  }

  if (!state.playerCircle) {
    state.playerCircle = L.circle([playerLocation.lat, playerLocation.lng], {
      radius: Math.max(playerLocation.accuracy || 20, 15),
      color: '#5cc8ff',
      weight: 2,
      opacity: 0.6,
      fillOpacity: 0.15,
    }).addTo(state.map);
    state.playerCircle.bindTooltip('<span>You</span>', { direction: 'top', offset: [0, -10], permanent: true });
  } else {
    state.playerCircle.setLatLng([playerLocation.lat, playerLocation.lng]);
    state.playerCircle.setRadius(Math.max(playerLocation.accuracy || 20, 15));
  }
}

export default function GameMap({
  center,
  playerLocation,
  missions,
  devices,
  drops,
  options,
}) {
  const containerRef = useRef(null);
  const stateRef = useRef({ map: null, L: null, tileLayer: null, missionLayer: null, deviceLayer: null, dropLayer: null, playerCircle: null });
  const [status, setStatus] = useState({ loading: typeof window !== 'undefined', error: null });

  const missionZones = useMemo(() => missionGeofences(missions), [missions]);
  const deviceZones = useMemo(() => deviceGeofences(devices), [devices]);
  const showRadius = options?.showRadius !== false;
  const showDrops = options?.showDrops !== false;
  const showLabels = options?.showLabels !== false;
  const zoom = options?.zoom || 15;

  const defaultCenter = useMemo(() => {
    if (Number.isFinite(center?.lat) && Number.isFinite(center?.lng)) {
      return [Number(center.lat), Number(center.lng)];
    }
    return [38.9072, -77.0369];
  }, [center]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let active = true;
    if (!containerRef.current) return undefined;

    loadLeaflet()
      .then((L) => {
        if (!active || !containerRef.current) return;
        const map = L.map(containerRef.current, {
          zoomControl: false,
          center: defaultCenter,
          zoom,
        });
        const tileLayer = L.tileLayer(tileUrl(showLabels), {
          attribution: tileAttribution(showLabels),
        }).addTo(map);
        const missionLayer = L.layerGroup().addTo(map);
        const deviceLayer = L.layerGroup().addTo(map);
        const dropLayer = L.layerGroup().addTo(map);

        stateRef.current = {
          map,
          L,
          tileLayer,
          missionLayer,
          deviceLayer,
          dropLayer,
          playerCircle: null,
        };

        renderMissionZones(stateRef.current, missionZones, showRadius);
        renderDeviceZones(stateRef.current, deviceZones, showRadius);
        if (showDrops) {
          renderDrops(stateRef.current, drops || []);
        }
        renderPlayer(stateRef.current, playerLocation);
        if (playerLocation && Number.isFinite(playerLocation.lat) && Number.isFinite(playerLocation.lng)) {
          map.setView([playerLocation.lat, playerLocation.lng], map.getZoom());
        }

        setStatus({ loading: false, error: null });
      })
      .catch((error) => {
        if (!active) return;
        setStatus({ loading: false, error: error.message || 'Leaflet failed to load' });
      });

    return () => {
      active = false;
      const { map, playerCircle } = stateRef.current || {};
      if (playerCircle) {
        playerCircle.remove();
      }
      if (map) {
        map.remove();
      }
      stateRef.current = { map: null, L: null, tileLayer: null, missionLayer: null, deviceLayer: null, dropLayer: null, playerCircle: null };
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  useEffect(() => {
    const state = stateRef.current;
    if (!state.map || !state.L) return;
    state.tileLayer.setUrl(tileUrl(showLabels));
    state.tileLayer.setAttribution(tileAttribution(showLabels));
  }, [showLabels]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state.map || !state.L) return;
    renderMissionZones(state, missionZones, showRadius);
  }, [missionZones, showRadius]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state.map || !state.L) return;
    renderDeviceZones(state, deviceZones, showRadius);
  }, [deviceZones, showRadius]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state.map || !state.L) return;
    if (showDrops) {
      renderDrops(state, drops || []);
    } else {
      state.dropLayer.clearLayers();
    }
  }, [drops, showDrops]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state.map || !state.L) return;
    if (Number.isFinite(center?.lat) && Number.isFinite(center?.lng)) {
      state.map.setView([Number(center.lat), Number(center.lng)]);
    }
  }, [center]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state.map || !state.L) return;
    renderPlayer(state, playerLocation);
    if (playerLocation && Number.isFinite(playerLocation.lat) && Number.isFinite(playerLocation.lng)) {
      state.map.setView([playerLocation.lat, playerLocation.lng], state.map.getZoom(), { animate: true });
    }
  }, [playerLocation]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state.map || !state.L) return;
    state.map.setZoom(zoom);
  }, [zoom]);

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative', zIndex: 1 }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
      {status.loading && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            padding: '8px 12px',
            borderRadius: 8,
            background: 'rgba(10,16,24,0.72)',
            color: '#f4f7ff',
            fontSize: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          Loading map…
        </div>
      )}
      {status.error && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            maxWidth: 280,
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(60,16,24,0.82)',
            color: '#ffd1d1',
            fontSize: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          Map failed to load: {status.error}
        </div>
      )}
    </div>
  );
}
