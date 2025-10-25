import React, { useMemo } from 'react';

const STATUS_STYLES = {
  complete: {
    fill: 'rgba(61, 214, 140, 0.95)',
    stroke: 'rgba(61, 214, 140, 1)',
    label: 'Complete',
  },
  attempted: {
    fill: 'rgba(245, 166, 35, 0.95)',
    stroke: 'rgba(245, 166, 35, 1)',
    label: 'Attempted',
  },
  pending: {
    fill: 'rgba(15, 23, 42, 0.92)',
    stroke: 'rgba(59, 130, 246, 0.9)',
    label: 'Pending',
  },
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function normalizeMissions(missions, answers, currentId, currentLocation) {
  const sanitized = [];
  const latitudes = [];
  const longitudes = [];
  const radiusValues = [];

  missions.forEach((mission) => {
    if (!mission) return;
    const lat = Number(mission.lat ?? mission?.content?.lat);
    const lng = Number(mission.lng ?? mission?.content?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }
    const radiusMetersRaw = Number(
      mission.radiusMeters ?? mission?.content?.radiusMeters ?? mission?.radius ?? 0,
    );
    const radiusMeters = Number.isFinite(radiusMetersRaw) ? Math.abs(radiusMetersRaw) : 0;
    sanitized.push({
      ...mission,
      lat,
      lng,
      radiusMeters,
    });
    latitudes.push(lat);
    longitudes.push(lng);
    if (radiusMeters > 0) {
      radiusValues.push(radiusMeters);
    }
  });

  const hasLocation =
    currentLocation &&
    Number.isFinite(currentLocation.lat) &&
    Number.isFinite(currentLocation.lng);

  if (hasLocation) {
    latitudes.push(Number(currentLocation.lat));
    longitudes.push(Number(currentLocation.lng));
    const accuracy = Number(currentLocation.accuracy);
    if (Number.isFinite(accuracy) && accuracy > 0) {
      radiusValues.push(Math.abs(accuracy));
    }
  }

  if (!latitudes.length || !longitudes.length) {
    return { missions: [], location: null };
  }

  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  const latSpanRaw = maxLat - minLat;
  const lngSpanRaw = maxLng - minLng;
  const padLat = (latSpanRaw || 0.01) * 0.1;
  const padLng = (lngSpanRaw || 0.01) * 0.1;

  const bounds = {
    minLat: minLat - padLat,
    maxLat: maxLat + padLat,
    minLng: minLng - padLng,
    maxLng: maxLng + padLng,
  };

  const latSpan = bounds.maxLat - bounds.minLat || 0.01;
  const lngSpan = bounds.maxLng - bounds.minLng || 0.01;

  const scale = radiusValues.length ? 120 / Math.max(...radiusValues) : 0.5;

  const getAnswer = (id) => {
    if (!id) return null;
    if (answers instanceof Map) {
      return answers.get(id);
    }
    if (answers && typeof answers === 'object') {
      return answers[id];
    }
    return null;
  };

  const normalizedMissions = sanitized.map((mission) => {
    const x = (mission.lng - bounds.minLng) / lngSpan;
    const y = (bounds.maxLat - mission.lat) / latSpan;
    const entry = getAnswer(mission.id);
    const statusKey = entry ? (entry.correct ? 'complete' : 'attempted') : 'pending';
    const palette = STATUS_STYLES[statusKey] || STATUS_STYLES.pending;
    return {
      ...mission,
      x: clamp(x, 0, 1),
      y: clamp(y, 0, 1),
      status: statusKey,
      palette,
      isCurrent: mission.id === currentId,
      radiusPx: mission.radiusMeters > 0 ? clamp(mission.radiusMeters * scale, 24, 220) : 0,
    };
  });

  let normalizedLocation = null;
  if (hasLocation) {
    const x = (Number(currentLocation.lng) - bounds.minLng) / lngSpan;
    const y = (bounds.maxLat - Number(currentLocation.lat)) / latSpan;
    const accuracy = Number(currentLocation.accuracy);
    normalizedLocation = {
      ...currentLocation,
      x: clamp(x, 0, 1),
      y: clamp(y, 0, 1),
      accuracySize:
        Number.isFinite(accuracy) && accuracy > 0 ? clamp(Math.abs(accuracy) * scale, 24, 260) : 0,
    };
  }

  return { missions: normalizedMissions, location: normalizedLocation };
}

export default function MissionMap({
  missions = [],
  currentId,
  answers,
  onSelect,
  currentLocation,
  children,
}) {
  const { missions: plottedMissions, location } = useMemo(
    () => normalizeMissions(missions, answers, currentId, currentLocation),
    [missions, answers, currentId, currentLocation],
  );

  const hasMissions = plottedMissions.length > 0;

  return (
    <div style={container}>
      <div style={backgroundLayer} />
      <div style={gridLayer} />

      {!hasMissions && (
        <div style={emptyState}>Mission coordinates are unavailable for this game.</div>
      )}

      {plottedMissions.map((mission) => (
        <React.Fragment key={mission.id || mission.index}>
          {mission.radiusPx > 0 && (
            <div
              aria-hidden="true"
              style={{
                ...radiusRing,
                borderColor: `${mission.palette.stroke}33`,
                background: `${mission.palette.stroke}12`,
                width: mission.radiusPx,
                height: mission.radiusPx,
                left: `calc(${mission.x * 100}% - ${mission.radiusPx / 2}px)`,
                top: `calc(${mission.y * 100}% - ${mission.radiusPx / 2}px)`,
              }}
            />
          )}

          <button
            type="button"
            onClick={() => onSelect && mission.id && onSelect(mission.id)}
            aria-label={`${mission.title || 'Mission'} — ${mission.palette.label}`}
            style={{
              ...markerButton,
              left: `calc(${mission.x * 100}% - 24px)`,
              top: `calc(${mission.y * 100}% - 24px)`,
              background: mission.palette.fill,
              borderColor: mission.palette.stroke,
              boxShadow: mission.isCurrent
                ? '0 0 0 6px rgba(61, 214, 140, 0.35)'
                : '0 12px 24px rgba(0, 0, 0, 0.35)',
              transform: mission.isCurrent ? 'scale(1.05)' : 'scale(1)',
              zIndex: mission.isCurrent ? 16 : 12,
            }}
          >
            <span style={markerIndex}>{mission.indexLabel || '•'}</span>
          </button>

          <div
            aria-hidden="true"
            style={{
              ...markerLabel,
              left: `calc(${mission.x * 100}% - 80px)`,
              top: `calc(${mission.y * 100}% + 28px)`,
            }}
          >
            <div style={{ fontWeight: 600 }}>{mission.title || mission.name || 'Mission'}</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>{mission.palette.label}</div>
          </div>
        </React.Fragment>
      ))}

      {location && (
        <React.Fragment>
          {location.accuracySize > 0 && (
            <div
              aria-hidden="true"
              style={{
                ...accuracyRing,
                width: location.accuracySize,
                height: location.accuracySize,
                left: `calc(${location.x * 100}% - ${location.accuracySize / 2}px)`,
                top: `calc(${location.y * 100}% - ${location.accuracySize / 2}px)`,
              }}
            />
          )}

          <div
            role="status"
            aria-label="Current location"
            style={{
              ...locationDot,
              left: `calc(${location.x * 100}% - 9px)`,
              top: `calc(${location.y * 100}% - 9px)`,
            }}
          />
          <div
            aria-hidden="true"
            style={{
              ...locationLabel,
              left: `calc(${location.x * 100}% - 32px)`,
              top: `calc(${location.y * 100}% + 16px)`,
            }}
          >
            You
          </div>
        </React.Fragment>
      )}

      {children}
    </div>
  );
}

const container = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
  color: '#e2e8f0',
};

const backgroundLayer = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(circle at 30% 20%, rgba(30, 64, 175, 0.45), rgba(2, 6, 23, 0.95))',
  zIndex: 0,
};

const gridLayer = {
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px)',
  backgroundSize: '80px 80px',
  zIndex: 1,
};

const emptyState = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  background: 'rgba(15, 23, 42, 0.85)',
  border: '1px solid rgba(148, 163, 184, 0.2)',
  borderRadius: 12,
  padding: '16px 24px',
  fontSize: 15,
  zIndex: 5,
  textAlign: 'center',
};

const markerButton = {
  position: 'absolute',
  width: 48,
  height: 48,
  borderRadius: '50%',
  borderWidth: 2,
  borderStyle: 'solid',
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
  color: '#020617',
  fontWeight: 700,
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  zIndex: 12,
};

const markerIndex = {
  fontSize: 14,
  textShadow: '0 1px 2px rgba(2, 6, 23, 0.4)',
};

const markerLabel = {
  position: 'absolute',
  width: 160,
  padding: '8px 10px',
  borderRadius: 12,
  background: 'rgba(15, 23, 42, 0.75)',
  border: '1px solid rgba(148, 163, 184, 0.25)',
  boxShadow: '0 10px 30px rgba(2, 6, 23, 0.45)',
  pointerEvents: 'none',
  zIndex: 11,
};

const radiusRing = {
  position: 'absolute',
  borderRadius: '50%',
  borderWidth: 1,
  borderStyle: 'dashed',
  transition: 'opacity 0.2s ease',
  zIndex: 8,
};

const accuracyRing = {
  position: 'absolute',
  borderRadius: '50%',
  border: '1px solid rgba(56, 189, 248, 0.35)',
  background: 'rgba(56, 189, 248, 0.12)',
  zIndex: 9,
};

const locationDot = {
  position: 'absolute',
  width: 18,
  height: 18,
  borderRadius: '50%',
  border: '3px solid rgba(56, 189, 248, 0.45)',
  background: '#38bdf8',
  boxShadow: '0 0 0 6px rgba(56, 189, 248, 0.2)',
  zIndex: 14,
};

const locationLabel = {
  position: 'absolute',
  padding: '4px 8px',
  borderRadius: 999,
  background: 'rgba(15, 23, 42, 0.85)',
  border: '1px solid rgba(148, 163, 184, 0.25)',
  fontSize: 11,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  zIndex: 13,
  pointerEvents: 'none',
};

