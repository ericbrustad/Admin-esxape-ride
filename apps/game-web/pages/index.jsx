import React, { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import PhotoCapture from '../components/PhotoCapture';
import OutcomeModal from '../components/OutcomeModal';
import BackpackButton from '../components/BackpackButton';
import BackpackDrawer from '../components/BackpackDrawer';
import SettingsMenu from '../components/SettingsMenu';
import {
  initBackpack,
  getBackpack,
  addPhoto,
  addReward,
  addUtility,
  addClue,
  addPoints,
  recordAnswer,
  addFind,
  markGeofenceVisit,
  removePocketItem,
  dropPocketItem,
  loadBackpackFromSupabase,
  listDroppedItems,
} from '../lib/backpack';

const GameMap = dynamic(() => import('../components/GameMap'), { ssr: false });

const SOUND_KEY = 'esx.sound-settings';
const MAP_KEY = 'esx.map-options';
const DEFAULT_SOUND = { themeEnabled: true, themeVolume: 0.6, fxEnabled: true, fxVolume: 0.8 };
const DEFAULT_MAP = { showLabels: true, showDrops: true, showRadius: true };

function readLocal(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) || {}) };
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function toDirect(u) {
  try {
    const url = new URL(u);
    const host = url.host.toLowerCase();
    if (host.endsWith('dropbox.com')) {
      url.host = 'dl.dropboxusercontent.com';
      url.searchParams.delete('dl');
      if (!url.searchParams.has('raw')) url.searchParams.set('raw', '1');
      return url.toString();
    }
    if (host.endsWith('drive.google.com')) {
      let id = '';
      if (url.pathname.startsWith('/file/d/')) {
        id = url.pathname.split('/')[3] || '';
      } else if (url.pathname === '/open') {
        id = url.searchParams.get('id') || '';
      }
      if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
    }
    return u;
  } catch {
    return u;
  }
}

export default function Game() {
  const [suite, setSuite] = useState(null);
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState('Loading…');
  const [idx, setIdx] = useState(0);

  const [backpack, setBackpack] = useState(null);
  const [drops, setDrops] = useState([]);
  const [backpackOpen, setBackpackOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [sound, setSound] = useState(() => readLocal(SOUND_KEY, DEFAULT_SOUND));
  const [mapOptions, setMapOptions] = useState(() => readLocal(MAP_KEY, DEFAULT_MAP));

  const [playerLocation, setPlayerLocation] = useState(null);
  const [geoStatus, setGeoStatus] = useState('locating');
  const [missionStatus, setMissionStatus] = useState('');

  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState('');

  const [showPhoto, setShowPhoto] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const themeAudioRef = useRef(null);

  const { slug, channel } = useMemo(() => {
    if (typeof window === 'undefined') {
      return { slug: '', channel: 'published' };
    }
    try {
      const u = new URL(window.location.href);
      return { slug: u.searchParams.get('slug') || '', channel: u.searchParams.get('channel') || 'published' };
    } catch {
      return { slug: '', channel: 'published' };
    }
  }, []);

  useEffect(() => {
    if (!slug) return;
    initBackpack(slug);
    setBackpack(getBackpack(slug));
    loadBackpackFromSupabase(slug).then((state) => {
      if (state) setBackpack(getBackpack(slug));
    });
    listDroppedItems(slug).then((items) => setDrops(items));
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/meta', { cache: 'no-store' });
        if (!response.ok) throw new Error(`status ${response.status}`);
        const data = await response.json();
        if (!cancelled) {
          setMeta(data);
          setMetaError('');
        }
      } catch (error) {
        if (!cancelled) {
          setMeta(null);
          setMetaError(error?.message || 'meta request failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    (async () => {
      if (!slug) return;
      try {
        const base = channel === 'published' ? 'published' : 'draft';
        const missions = await fetch(`/games/${encodeURIComponent(slug)}/${base}/missions.json`, { cache: 'no-store' }).then((r) => r.json());
        const cfg = await fetch(`/games/${encodeURIComponent(slug)}/${base}/config.json`, { cache: 'no-store' }).then((r) => r.json()).catch(() => ({}));
        setSuite(missions);
        setConfig(cfg);
        setStatus('');
      } catch (error) {
        setStatus('Failed to load game.');
      }
    })();
  }, [slug, channel]);

  const themeMusicUrl = config?.audio?.themeUrl || config?.game?.themeMusicUrl || '';
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const resolved = themeMusicUrl ? toDirect(themeMusicUrl) : null;
    let audio = themeAudioRef.current;
    if (!resolved || sound.themeEnabled === false) {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      return undefined;
    }
    if (!audio || audio._themeSrc !== resolved) {
      audio?.pause();
      audio = new Audio(resolved);
      audio.loop = true;
      audio._themeSrc = resolved;
      themeAudioRef.current = audio;
    }
    audio.volume = Math.max(0, Math.min(1, sound.themeVolume ?? 1));
    audio.play().catch(() => {});
    return () => {
      if (themeAudioRef.current) {
        themeAudioRef.current.pause();
      }
    };
  }, [themeMusicUrl, sound.themeEnabled, sound.themeVolume]);

  useEffect(() => {
    writeLocal(SOUND_KEY, sound);
  }, [sound]);

  useEffect(() => {
    writeLocal(MAP_KEY, mapOptions);
  }, [mapOptions]);

  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGeoStatus('unsupported');
      return () => {};
    }
    const handleSuccess = (pos) => {
      setPlayerLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? 0,
      });
      setGeoStatus('ready');
    };
    const handleError = (error) => {
      setGeoStatus(error?.message || 'Location unavailable');
    };
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, { enableHighAccuracy: true });
    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      maximumAge: 15000,
      timeout: 20000,
    });
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!missionStatus) return undefined;
    const handle = setTimeout(() => setMissionStatus(''), 4000);
    return () => clearTimeout(handle);
  }, [missionStatus]);

  const missions = suite?.missions || [];
  const mission = missions[idx] || null;
  const missionAppearance = mission?.appearanceOverrideEnabled ? (mission.appearance || {}) : (config?.appearance || {});
  const theme = useMemo(() => buildTheme(config?.appearance || {}), [config]);
  const missionStyle = missionBodyStyle(missionAppearance);
  const missionLabel = (text) => (
    <div style={{ ...labelStyle(missionAppearance), textAlign: missionAppearance.textAlign || 'left' }}>{text}</div>
  );

  const mapCenter = config?.map
    ? { lat: Number(config.map.centerLat), lng: Number(config.map.centerLng) }
    : { lat: 38.9072, lng: -77.0369 };
  const mapZoom = config?.map?.defaultZoom || 15;

  const geofences = useMemo(() => buildGeofences(missions, config?.devices || []), [missions, config]);

  useEffect(() => {
    if (!playerLocation || !slug || !geofences.length) return;
    const visited = (backpack?.visits?.geofences) || {};
    const collected = [];
    for (const fence of geofences) {
      const visitId = `${fence.kind}:${fence.id}`;
      if (visited[visitId]) continue;
      const distance = distanceMeters(playerLocation.lat, playerLocation.lng, fence.lat, fence.lng);
      if (distance <= fence.radius) {
        addFind(slug, {
          id: `${fence.kind}_${fence.id}_${Date.now()}`,
          name: fence.title,
          description: fence.description,
          iconUrl: fence.iconUrl,
          originId: fence.id,
          originType: fence.kind,
          lat: fence.lat,
          lng: fence.lng,
          collectedAt: Date.now(),
        });
        markGeofenceVisit(slug, visitId);
        collected.push(fence.title);
      }
    }
    if (collected.length) {
      setBackpack(getBackpack(slug));
      setMissionStatus(`Collected ${collected.join(', ')}!`);
    }
  }, [playerLocation, geofences, slug, backpack]);

  if (!suite || !config) {
    return (
      <main style={loadingOuter(theme)}>
        <div style={loadingCard}>{status}</div>
      </main>
    );
  }

  function nextMission() {
    setIdx((value) => Math.min(value + 1, missions.length - 1));
  }
  function prevMission() {
    setIdx((value) => Math.max(value - 1, 0));
  }

  function refreshBackpack() {
    setBackpack(getBackpack(slug));
  }

  function applyOutcome(result, wasCorrect) {
    if (!result || !result.enabled) {
      nextMission();
      return;
    }
    if (wasCorrect && typeof mission?.rewards?.points === 'number') {
      addPoints(slug, mission.rewards.points);
    }
    if (result.rewardKey) {
      const row = (config.media?.rewards || []).find((entry) => entry.key === result.rewardKey);
      if (row) addReward(slug, { key: row.key, name: row.name || 'Reward', thumbUrl: row.thumbUrl || '' });
    }
    if (result.punishmentKey || result.deviceKey) {
      const key = result.punishmentKey || result.deviceKey;
      const all = [...(config.media?.punishments || []), ...(config.devices || [])];
      const row = all.find((entry) => entry.key === key || entry.id === key || entry.type === key);
      addUtility(slug, { key, name: row?.name || row?.title || 'Utility', thumbUrl: row?.thumbUrl || '' });
    }
    if (result.clueText) addClue(slug, result.clueText);

    refreshBackpack();

    setOutcome({
      title: wasCorrect ? 'Correct!' : 'Try Again',
      message: result.message,
      mediaUrl: result.mediaUrl ? toDirect(result.mediaUrl) : '',
      audioUrl: result.audioUrl ? toDirect(result.audioUrl) : '',
    });
  }

  function handleMultipleChoice(answerIdx) {
    const correctIndex = Number(mission.content?.correctIndex);
    const correct = Number(answerIdx) === correctIndex;
    recordAnswer(slug, mission.id, { correct, value: answerIdx });
    applyOutcome(correct ? mission.onCorrect : mission.onWrong, correct);
  }

  const [shortAnswer, setShortAnswer] = useState('');
  useEffect(() => {
    setShortAnswer('');
  }, [mission?.id]);

  function handleShortAnswerSubmit() {
    const expected = (mission.content?.answer || '').trim().toLowerCase();
    const acceptable = (mission.content?.acceptable || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    const submitted = String(shortAnswer || '').trim().toLowerCase();
    const correct = [expected, ...acceptable].includes(submitted);
    recordAnswer(slug, mission.id, { correct, value: shortAnswer });
    applyOutcome(correct ? mission.onCorrect : mission.onWrong, correct);
  }

  function handleStatementAck() {
    recordAnswer(slug, mission.id, { correct: true, value: 'ack' });
    applyOutcome(mission.onCorrect, true);
  }

  const mapState = {
    ...mapOptions,
    zoom: mapZoom,
  };

  const currentPoints = backpack?.points || 0;
  const backpackCount = backpack?.pockets?.finds?.length || 0;

  return (
    <main style={mainStyle(theme, missionAppearance)}>
      <div style={mapLayer}>
        <GameMap
          center={mapCenter}
          playerLocation={playerLocation}
          missions={missions}
          devices={config?.devices || []}
          drops={drops}
          options={mapState}
        />
      </div>

      <div style={uiOverlay}>
        <div style={missionCard(theme)}>
          <header style={missionHeader}>
            <div>
              <div style={{ fontSize: 12, color: theme.mutedColor }}>
                Mission {missions.length ? idx + 1 : 0} / {missions.length}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{mission?.title || 'Mission'}</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 12 }}>
              <div style={{ color: theme.mutedColor }}>Points</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{currentPoints}</div>
            </div>
          </header>
          <div style={missionBody(missionStyle)}>
            {renderMissionContent({
              mission,
              missionStyle,
              missionLabel,
              handleMultipleChoice,
              shortAnswer,
              setShortAnswer,
              handleShortAnswerSubmit,
              handleStatementAck,
              prevMission,
              setShowPhoto,
              config,
            })}
          </div>
          <footer style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: theme.mutedColor }}>
            <span>{mission?.rewards?.points ? `${mission.rewards.points} pts available` : 'Explore the zone to progress.'}</span>
            <span>{mission?.id}</span>
          </footer>
        </div>

        {status && (
          <div style={statusBanner(theme)}>{status}</div>
        )}

        {geoStatus !== 'ready' && (
          <div style={geoBanner(theme)}>{geoStatus === 'locating' ? 'Locating…' : geoStatus}</div>
        )}

        {missionStatus && (
          <div style={toast(theme)}>{missionStatus}</div>
        )}
      </div>

      <BackpackButton onClick={() => setBackpackOpen(true)} count={backpackCount} theme={theme} />
      <BackpackDrawer
        open={backpackOpen}
        onZip={() => setBackpackOpen(false)}
        backpack={backpack}
        onDrop={async (item) => {
          const result = await dropPocketItem(slug, 'finds', item.id, playerLocation);
          refreshBackpack();
          if (result?.entry) {
            setDrops((prev) => {
              const next = [result.entry, ...(Array.isArray(prev) ? prev : [])];
              return next.slice(0, 200);
            });
          } else {
            const items = await listDroppedItems(slug);
            setDrops(items);
          }
          setBackpackOpen(false);
        }}
        onDiscard={(item) => {
          removePocketItem(slug, 'finds', item.id);
          refreshBackpack();
        }}
        currentLocation={playerLocation}
        drops={drops}
        theme={theme}
      />

      <SettingsMenu
        open={settingsOpen}
        onToggle={() => setSettingsOpen((value) => !value)}
        sound={sound}
        onSoundChange={setSound}
        mapOptions={mapOptions}
        onMapOptionsChange={(value) => {
          setMapOptions(value);
          writeLocal(MAP_KEY, value);
          if (value.showDrops) {
            listDroppedItems(slug).then((items) => setDrops(items));
          }
        }}
        theme={theme}
        meta={meta}
        metaError={metaError}
      />

      {showPhoto && (
        <PhotoCapture
          overlayUrl={showPhoto.overlayUrl}
          onCancel={() => setShowPhoto(null)}
          onSave={(dataUrl) => {
            addPhoto(slug, { dataUrl, title: 'Captured' });
            setShowPhoto(null);
            recordAnswer(slug, mission.id, { correct: true, value: 'photo' });
            applyOutcome(mission.onCorrect, true);
          }}
        />
      )}

      <OutcomeModal
        open={!!outcome}
        outcome={outcome}
        onClose={() => {
          setOutcome(null);
          nextMission();
        }}
        sound={sound}
      />
    </main>
  );
}

function renderMissionContent({
  mission,
  missionStyle,
  missionLabel,
  handleMultipleChoice,
  shortAnswer,
  setShortAnswer,
  handleShortAnswerSubmit,
  handleStatementAck,
  prevMission,
  setShowPhoto,
  config,
}) {
  if (!mission) {
    return <div style={missionStyle}>Mission complete! 🎉</div>;
  }
  switch (mission.type) {
    case 'multiple_choice': {
      const choices = mission.content?.choices || [];
      return (
        <div style={missionStyle}>
          {missionLabel(mission.content?.question || '')}
          <div style={{ display: 'grid', gap: 8 }}>
            {choices.map((choice, index) => (
              <button key={index} style={missionButton} onClick={() => handleMultipleChoice(index)}>
                {choice}
              </button>
            ))}
          </div>
        </div>
      );
    }
    case 'short_answer': {
      return (
        <div style={missionStyle}>
          {missionLabel(mission.content?.question || '')}
          <input
            value={shortAnswer}
            onChange={(event) => setShortAnswer(event.target.value)}
            placeholder="Type your answer…"
            style={missionInput}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button style={missionButton} onClick={handleShortAnswerSubmit}>
              Submit
            </button>
            <button style={missionButton} onClick={prevMission}>
              Back
            </button>
          </div>
        </div>
      );
    }
    case 'statement': {
      return (
        <div style={missionStyle}>
          {missionLabel(mission.content?.text || '')}
          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <button style={missionButton} onClick={handleStatementAck}>
              ✕ Acknowledge
            </button>
          </div>
        </div>
      );
    }
    case 'photo_opportunity': {
      const overlayUrl = resolveOverlayUrl(config, mission.content?.overlayKey, mission.content?.overlayUrl);
      return (
        <div style={missionStyle}>
          {missionLabel(mission.content?.text || 'Photo Opportunity')}
          <button style={missionButton} onClick={() => setShowPhoto({ overlayUrl, title: 'Capture' })}>
            Open Camera
          </button>
        </div>
      );
    }
    default:
      return (
        <div style={missionStyle}>
          {missionLabel('Unsupported mission type')}
          <div style={{ color: '#9fb0bf', fontSize: 12 }}>Type: {mission.type}</div>
        </div>
      );
  }
}

function resolveOverlayUrl(config, overlayKey, overlayUrl) {
  if (overlayUrl) return toDirect(overlayUrl);
  const list = config?.media?.overlays || [];
  const found = list.find((item) => item.key === overlayKey || item.name === overlayKey);
  return found ? toDirect(found.url) : '';
}

function buildGeofences(missions, devices) {
  const missionFences = (missions || [])
    .filter((mission) => mission?.content?.geofenceEnabled)
    .map((mission) => ({
      id: mission.id,
      title: mission.title || mission.id,
      description: mission.content?.question || '',
      radius: Number(mission.content?.radiusMeters) || 40,
      lat: Number(mission.content?.lat),
      lng: Number(mission.content?.lng),
      iconUrl: mission.iconUrl || '',
      kind: 'mission',
    }))
    .filter((mission) => Number.isFinite(mission.lat) && Number.isFinite(mission.lng));
  const deviceFences = (devices || [])
    .map((device) => ({
      id: device.id,
      title: device.title || device.id,
      description: device.type || '',
      radius: Number(device.pickupRadius) || 60,
      lat: Number(device.lat),
      lng: Number(device.lng),
      iconUrl: device.iconUrl || '',
      kind: 'device',
    }))
    .filter((device) => Number.isFinite(device.lat) && Number.isFinite(device.lng));
  return [...missionFences, ...deviceFences];
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371000 * c;
}

function missionBodyStyle(appearance) {
  const fontFamily = appearance.fontFamily || 'system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif';
  const fontSize = (appearance.fontSizePx || 22) + 'px';
  const textBg = `rgba(${hex(appearance.textBgColor || '#000')}, ${appearance.textBgOpacity ?? 0.25})`;
  return {
    background: textBg,
    padding: 12,
    display: 'grid',
    gap: 12,
    color: appearance.fontColor || '#ffffff',
    fontFamily,
    fontSize,
    borderRadius: 12,
  };
}

function labelStyle(appearance) {
  return {
    background: `rgba(${hex(appearance.textBgColor || '#000')}, ${Math.min(0.6, (appearance.textBgOpacity ?? 0.35) + 0.2)})`,
    padding: '8px 12px',
    borderRadius: 10,
    fontWeight: 600,
  };
}

function hex(value) {
  try {
    const stripped = value.replace('#', '');
    const buffer = stripped.length === 3 ? stripped.split('').map((char) => char + char).join('') : stripped;
    return `${parseInt(buffer.slice(0, 2), 16)}, ${parseInt(buffer.slice(2, 4), 16)}, ${parseInt(buffer.slice(4, 6), 16)}`;
  } catch {
    return '0,0,0';
  }
}

function buildTheme(appearance) {
  const hasImage = appearance?.screenBgImage && appearance.screenBgImageEnabled !== false;
  const background = hasImage
    ? `linear-gradient(rgba(0,0,0,${appearance.screenBgOpacity ?? 0.32}), rgba(0,0,0,${appearance.screenBgOpacity ?? 0.32})), url(${toDirect(appearance.screenBgImage)}) center/cover no-repeat`
    : appearance?.screenBgColor || '#060b12';
  return {
    background,
    textColor: appearance?.fontColor || '#f4f7ff',
    mutedColor: 'rgba(198,212,236,0.78)',
    panelBg: 'rgba(10,16,24,0.92)',
    panelBorder: 'rgba(68,92,116,0.35)',
    accentColor: '#5cc8ff',
    buttonBg: 'rgba(14,20,28,0.9)',
    buttonBorder: 'rgba(128,156,204,0.45)',
  };
}

function mainStyle(theme, appearance) {
  return {
    position: 'relative',
    minHeight: '100vh',
    color: theme.textColor,
    fontFamily: appearance?.fontFamily || 'system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif',
    background: theme.background,
  };
}

const mapLayer = {
  position: 'absolute',
  inset: 0,
};

const uiOverlay = {
  position: 'relative',
  zIndex: 2,
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  maxWidth: 520,
};

function missionCard(theme) {
  return {
    background: theme.panelBg,
    border: `1px solid ${theme.panelBorder}`,
    borderRadius: 18,
    padding: 18,
    boxShadow: '0 32px 80px rgba(0,0,0,0.45)',
    backdropFilter: 'blur(6px)',
  };
}

const missionHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
};

function missionBody(style) {
  return {
    ...style,
    background: 'rgba(0,0,0,0.28)',
  };
}

const missionButton = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid rgba(128,156,204,0.45)',
  background: 'rgba(14,20,28,0.9)',
  color: '#f4f7ff',
  cursor: 'pointer',
};

const missionInput = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid rgba(128,156,204,0.35)',
  background: 'rgba(8,12,18,0.8)',
  color: '#f4f7ff',
};

function statusBanner(theme) {
  return {
    alignSelf: 'flex-start',
    padding: '10px 14px',
    borderRadius: 10,
    background: 'rgba(220,80,100,0.9)',
    color: '#fff',
    fontSize: 12,
  };
}

function geoBanner(theme) {
  return {
    alignSelf: 'flex-start',
    padding: '8px 12px',
    borderRadius: 10,
    background: 'rgba(92,200,255,0.85)',
    color: '#062235',
    fontSize: 12,
  };
}

function toast(theme) {
  return {
    position: 'fixed',
    bottom: 40,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(10,16,24,0.92)',
    borderRadius: 12,
    padding: '10px 18px',
    border: `1px solid ${theme.panelBorder}`,
    color: theme.textColor,
    zIndex: 1300,
    boxShadow: '0 18px 40px rgba(0,0,0,0.4)',
    fontSize: 14,
  };
}

function loadingOuter(theme) {
  return {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: theme.background,
    color: theme.textColor,
    fontFamily: 'system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif',
  };
}

const loadingCard = {
  padding: '16px 22px',
  borderRadius: 14,
  border: '1px solid rgba(128,156,204,0.45)',
  background: 'rgba(14,20,28,0.92)',
  boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
};
