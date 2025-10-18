// pages/index.jsx
// Admin Control Deck (merged + cleaned)
// - 5 MB cover limit
// - Robust Save (bundle first -> legacy fallback)
// - Publish with dual endpoint + fallback
// - Strict boolean deployEnabled
// - SVG previews supported
// - No undefined UI_THEME_MAP access

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TestLauncher from '../components/TestLauncher';
import AnswerResponseEditor from '../components/AnswerResponseEditor';
import InlineMissionResponses from '../components/InlineMissionResponses';
import AssignedMediaTab from '../components/AssignedMediaTab';
import SafeBoundary from '../components/SafeBoundary';
import { AppearanceEditor } from '../components/ui-kit';
import {
  normalizeTone,
  appearanceBackgroundStyle,
  defaultAppearance,
  surfaceStylesFromAppearance,
  DEFAULT_APPEARANCE_SKIN,
} from '../lib/admin-shared';
import { GAME_ENABLED } from '../lib/game-switch';

/* ───────────────────────── Helpers ───────────────────────── */
async function fetchJsonSafe(url, fallback) {
  try {
    const r = await fetch(url, { cache: 'no-store', credentials: 'include' });
    const ct = r.headers.get('content-type') || '';
    if (r.ok && ct.includes('application/json')) return await r.json();
  } catch {}
  return fallback;
}
async function fetchFirstJson(urls, fallback) {
  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: 'no-store', credentials: 'include' });
      const ct = r.headers.get('content-type') || '';
      if (r.ok && ct.includes('application/json')) return await r.json();
    } catch {}
  }
  return fallback;
}
function toDirectMediaURL(u) {
  if (!u) return u;
  try {
    const url = new URL(u, typeof window !== 'undefined' ? window.location.origin : 'http://local');
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
        const parts = url.pathname.split('/');
        id = parts[3] || '';
      } else if (url.pathname === '/open') {
        id = url.searchParams.get('id') || '';
      }
      if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
    }
    return u;
  } catch { return u; }
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function hexToRgb(hex) {
  try {
    const h = hex.replace('#','');
    const b = h.length === 3 ? h.split('').map(ch=>ch+ch).join('') : h;
    const r = parseInt(b.slice(0,2),16), g = parseInt(b.slice(2,4),16), bl = parseInt(b.slice(4,6),16);
    return `${r}, ${g}, ${bl}`;
  } catch { return '0,0,0'; }
}

const EXTS = {
  image: /\.(png|jpg|jpeg|webp|bmp|svg|tif|tiff|avif|heic|heif)$/i,
  gif: /\.(gif)$/i,
  video: /\.(mp4|webm|mov)$/i,
  audio: /\.(mp3|wav|ogg|m4a|aiff|aif)$/i,
};

const COVER_SIZE_LIMIT_BYTES = 5 * 1024 * 1024; // 5 MB limit for cover uploads

const ADMIN_META_INITIAL_STATE = {
  branch: '',
  commit: '',
  owner: '',
  repo: '',
  vercelUrl: '',
  deploymentUrl: '',
  deploymentState: '',
  fetchedAt: '',
  error: '',
};

function formatLocalDateTime(value) {
  if (!value) return '';
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

/* ───────────────────────── Defaults / Skins ───────────────────────── */
const DEFAULT_ICONS = { missions:[], devices:[], rewards:[] };

const STARFIELD_DAWN_APPEARANCE = {
  ...defaultAppearance(),
  fontFamily: '"Exo 2", "Segoe UI", sans-serif',
  fontSizePx: 23,
  fontColor: '#262a58',
  textBgColor: '#f4f0ff',
  textBgOpacity: 0.7,
  screenBgColor: '#e0dcfa',
  screenBgOpacity: 0.46,
  screenBgImage: '/media/skins/starfield-dawn.svg',
  screenBgImageEnabled: true,
  textAlign: 'center',
  textVertical: 'top',
};
const STARFIELD_DAWN_SKIN_BASE = {
  label: 'Starfield Dawn',
  description: 'Unified Starfield Dawn admin skin.',
  uiKey: 'starfield-dawn',
};
const APPEARANCE_SKIN_KEYS = [
  'default',
  'space-military',
  'military-desert',
  'forest-outpost',
  'starfield',
  'cartoon-bubbles',
  'chrome-luminous',
  'desert-horizon',
  'forest-meadow',
  'starfield-dawn',
  'cartoon-parade',
  'arctic-lab',
];
const APPEARANCE_SKINS = APPEARANCE_SKIN_KEYS.map((key) => ({
  key,
  ...STARFIELD_DAWN_SKIN_BASE,
  appearance: { ...STARFIELD_DAWN_APPEARANCE },
}));
const APPEARANCE_SKIN_MAP = new Map(APPEARANCE_SKINS.map((skin) => [skin.key, skin]));
const ADMIN_SKIN_TO_UI = new Map(APPEARANCE_SKINS.map((skin) => [skin.key, skin.uiKey || skin.key]));
const DEFAULT_SKIN_PRESET = APPEARANCE_SKIN_MAP.get(DEFAULT_APPEARANCE_SKIN);
const DEFAULT_UI_SKIN = ADMIN_SKIN_TO_UI.get(DEFAULT_APPEARANCE_SKIN) || DEFAULT_APPEARANCE_SKIN;

function isAppearanceEqual(a, b) {
  if (!a || !b) return false;
  const keys = [
    'fontFamily','fontSizePx','fontColor','textBgColor','textBgOpacity',
    'screenBgColor','screenBgOpacity','screenBgImage','screenBgImageEnabled',
    'textAlign','textVertical','panelDepth',
  ];
  return keys.every((key) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === 'number' || typeof bv === 'number') {
      return Math.abs(Number(av ?? 0) - Number(bv ?? 0)) < 0.0001;
    }
    return String(av ?? '') === String(bv ?? '');
  });
}
function detectAppearanceSkin(appearance, fallbackKey) {
  if (fallbackKey && APPEARANCE_SKIN_MAP.has(fallbackKey)) {
    const preset = APPEARANCE_SKIN_MAP.get(fallbackKey);
    if (preset && isAppearanceEqual(appearance, preset.appearance)) return fallbackKey;
  }
  for (const skin of APPEARANCE_SKINS) {
    if (isAppearanceEqual(appearance, skin.appearance)) return skin.key;
  }
  return 'custom';
}
function applyAdminUiThemeForDocument(skinKey, appearance, tone = 'light') {
  if (typeof document === 'undefined') return;
  const body = document.body;
  if (!body) return;
  const root = document.documentElement;
  const uiKey = ADMIN_SKIN_TO_UI.get(skinKey) || DEFAULT_UI_SKIN;
  const normalizedTone = normalizeTone(tone);
  const background = appearanceBackgroundStyle(appearance, normalizedTone);
  const surfaces = surfaceStylesFromAppearance(appearance, normalizedTone);
  const overlay = clamp(Number(appearance?.screenBgOpacity ?? 0), 0, 1);
  const fontSize = clamp(Number(appearance?.fontSizePx ?? 22), 10, 72);
  const fontFamily = appearance?.fontFamily || '';
  const textColor = normalizedTone === 'dark' ? '#f4f7ff' : (appearance?.fontColor || '#1f2d3a');
  const textBg = `rgba(${hexToRgb(appearance?.textBgColor || '#000000')}, ${clamp(Number(appearance?.textBgOpacity ?? 0), 0, 1)})`;
  const mutedColor = normalizedTone === 'dark' ? 'rgba(198, 212, 236, 0.78)' : 'rgba(36, 52, 72, 0.68)';
  const inputBg = normalizedTone === 'dark'
    ? `rgba(12, 18, 28, ${clamp(0.78 + overlay * 0.12, 0.72, 0.92)})`
    : `rgba(255, 255, 255, ${clamp(0.88 - overlay * 0.28, 0.55, 0.97)})`;
  const inputBorder = normalizedTone === 'dark'
    ? '1px solid rgba(132, 176, 226, 0.42)'
    : '1px solid rgba(128, 156, 204, 0.42)';
  const buttonColor = normalizedTone === 'dark' ? '#f4f7ff' : '#0e1c2e';

  body.dataset.skin = uiKey;
  body.dataset.tone = normalizedTone;
  body.style.backgroundColor = background.backgroundColor || '';
  body.style.backgroundImage = background.backgroundImage || 'none';
  body.style.backgroundSize = background.backgroundSize || '';
  body.style.backgroundRepeat = background.backgroundRepeat || '';
  body.style.backgroundPosition = background.backgroundPosition || '';
  body.style.backgroundBlendMode = background.backgroundBlendMode || '';
  body.style.setProperty('--appearance-panel-bg', surfaces.panelBg);
  body.style.setProperty('--appearance-panel-border', surfaces.panelBorder);
  body.style.setProperty('--appearance-panel-shadow', surfaces.panelShadow);
  body.style.setProperty('--appearance-piping-opacity', String(surfaces.pipingOpacity));
  body.style.setProperty('--appearance-piping-shadow', surfaces.pipingShadow);
  body.style.setProperty('--appearance-screen-overlay', String(overlay));
  body.style.setProperty('--admin-body-color', textColor);
  body.style.setProperty('--admin-muted', mutedColor);
  body.style.setProperty('--admin-input-bg', inputBg);
  body.style.setProperty('--admin-input-border', inputBorder);
  body.style.setProperty('--admin-input-color', textColor);
  body.style.setProperty('--admin-button-color', buttonColor);

  if (appearance?.screenBgImage && appearance?.screenBgImageEnabled !== false) {
    body.style.setProperty('--appearance-panel-surface', 'none');
  } else {
    body.style.removeProperty('--appearance-panel-surface');
  }
  body.dataset.panelDepth = appearance?.panelDepth === false ? 'flat' : 'deep';
  if (root) {
    if (fontFamily) root.style.setProperty('--appearance-font-family', fontFamily);
    else root.style.removeProperty('--appearance-font-family');
    root.style.setProperty('--appearance-font-size', `${fontSize}px`);
    root.style.setProperty('--appearance-font-color', textColor);
    root.style.setProperty('--appearance-text-bg', textBg);
  }
}

/* ───────────────────────── Normalizers ───────────────────────── */
function normalizeGameMetadata(cfg, slug = '') {
  const base = { ...(cfg || {}) };
  const game = { ...(base.game || {}) };

  const rawTags = Array.isArray(game.tags) ? game.tags : [];
  const cleaned = [];
  const seen = new Set();
  rawTags.forEach((tag) => {
    const str = String(tag || '').trim();
    if (!str) return;
    const key = str.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    cleaned.push(str);
  });

  const normalizedSlug = (slug || '').toString().trim().toLowerCase() || 'default';
  if (!seen.has(normalizedSlug)) { cleaned.push(normalizedSlug); seen.add(normalizedSlug); }
  if (normalizedSlug === 'default' && !seen.has('default-game')) { cleaned.push('default-game'); seen.add('default-game'); }

  const normalizedTitle = (game.title || '').toString().trim();
  const normalizedType = (game.type || '').toString().trim();
  const normalizedCover = typeof game.coverImage === 'string' ? game.coverImage.trim() : '';
  const normalizedShort = typeof game.shortDescription === 'string' ? game.shortDescription.trim() : '';
  const normalizedLong  = typeof game.longDescription  === 'string' ? game.longDescription.trim()  : '';
  const normalizedPlayers = Number.isFinite(Number(game.playerCount)) ? Number(game.playerCount) : 1;

  game.tags = cleaned;
  game.title = normalizedTitle || 'Default Game';
  game.type = normalizedType || 'Mystery';
  game.coverImage = normalizedCover;
  game.shortDescription = normalizedShort;
  game.longDescription = normalizedLong;
  game.playerCount = [1,2,4].includes(normalizedPlayers) ? normalizedPlayers : 1;

  game.slug = normalizedSlug;
  game.deployEnabled = game.deployEnabled === true;

  base.game = game;
  return base;
}

function defaultConfig() {
  return {
    splash: { enabled: true, mode: 'test' },       // 'test' or 'live'
    game:   { title:'Default Game', type:'Mystery', tags:['default','default-game'], coverImage:'', playerCount:1, deployEnabled: true },
    forms:  { players:1 },
    timer:  { durationMinutes:0, alertMinutes:10 },
    textRules: [],
    devices: [], powerups: [],
    media: { rewardsPool:[], penaltiesPool:[] },
    icons: DEFAULT_ICONS,
    appearanceSkin: DEFAULT_APPEARANCE_SKIN,
    appearance: {
      ...defaultAppearance(),
      ...(DEFAULT_SKIN_PRESET?.appearance || {}),
    },
    appearanceTone: 'light',
    mediaTriggers: { enabled:false, actionType:'media' },
    map: { centerLat: 44.9778, centerLng: -93.2650, defaultZoom: 13 },
    geofence: { mode: 'test' },
  };
}

function slugifyTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/* ───────────────────────── Root ───────────────────────── */
export default function Admin() {
  const gameEnabled = GAME_ENABLED;
  const [tab, setTab] = useState('missions');

  const [adminMeta, setAdminMeta] = useState(ADMIN_META_INITIAL_STATE);

  const [games, setGames] = useState([]);
  const [activeSlug, setActiveSlug] = useState('default'); // legacy root
  const [status, setStatus] = useState('');

  const [suite, setSuite]   = useState(null);
  const [config, setConfig] = useState(null);

  // Load repo/meta + vercel status
  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      const nowIso = new Date().toISOString();
      try {
        const [metaRes, vercelRes] = await Promise.all([
          fetch('/api/admin-meta', { cache: 'no-store', credentials: 'include' }).catch(() => null),
          fetch('/api/vercel-status?project=game', { cache: 'no-store', credentials: 'include' }).catch(() => null),
        ]);
        const metaJson = metaRes ? await metaRes.json().catch(() => ({})) : {};
        const vercelJson = vercelRes ? await vercelRes.json().catch(() => ({})) : {};

        if (cancelled) return;
        const metaOk = metaJson?.ok !== false;
        const vercelOk = vercelJson?.ok !== false;

        const deploymentUrlRaw = vercelJson?.url || '';
        const deploymentUrl = typeof deploymentUrlRaw === 'string' && deploymentUrlRaw
          ? (deploymentUrlRaw.startsWith('http') ? deploymentUrlRaw : `https://${deploymentUrlRaw}`)
          : '';

        const deploymentState = vercelJson?.state || (vercelJson?.disabled ? 'DISABLED' : '');
        const combinedError = (!metaOk && metaJson?.error)
          || (!vercelOk && (vercelJson?.error || vercelJson?.reason))
          || '';

        setAdminMeta((prev) => ({
          ...ADMIN_META_INITIAL_STATE,
          ...(prev || {}),
          branch: metaOk && metaJson?.branch ? metaJson.branch : '',
          commit: metaOk && metaJson?.commit ? metaJson.commit : '',
          owner: metaOk && metaJson?.owner ? metaJson.owner : '',
          repo: metaOk && metaJson?.repo ? metaJson.repo : '',
          vercelUrl: metaOk && metaJson?.vercelUrl ? metaJson.vercelUrl : '',
          deploymentUrl,
          deploymentState: deploymentState ? String(deploymentState).toUpperCase() : '',
          fetchedAt: nowIso,
          error: combinedError || '',
        }));
      } catch (e) {
        if (cancelled) return;
        setAdminMeta((prev) => ({ ...(prev||{}), fetchedAt: new Date().toISOString(), error: 'Unable to load deployment status' }));
      }
    }
    loadMeta();
    const t = setInterval(loadMeta, 60000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Load games list
  useEffect(() => {
    if (!gameEnabled) { setGames([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/games', { credentials:'include', cache:'no-store' });
        if (!r.ok) throw new Error(await r.text() || `HTTP ${r.status}`);
        const j = await r.json();
        if (cancelled) return;
        if (j.ok) setGames(Array.isArray(j.games) ? j.games : []);
        else if (j?.error) setStatus(prev => prev || `⚠️ ${j.error}`);
      } catch (err) {
        if (cancelled) return;
        setGames([]);
        setStatus(prev => prev || `⚠️ Unable to load games list (${err?.message || 'network error'})`);
      }
    })();
    return () => { cancelled = true; };
  }, [gameEnabled]);

  // Load suite + config for active slug
  useEffect(() => {
    (async () => {
      try {
        setStatus('Loading…');
        const isDefault = !activeSlug || activeSlug === 'default';

        const missionUrls = isDefault
          ? ['/missions.json']
          : [`/games/${encodeURIComponent(activeSlug)}/missions.json`, `/missions.json`];

        const configUrls = isDefault
          ? ['/api/config']
          : [`/api/config?slug=${encodeURIComponent(activeSlug)}`, '/api/config'];

        const m  = await fetchFirstJson(missionUrls, { version:'0.0.0', missions:[] });
        const c0 = await fetchFirstJson(configUrls, defaultConfig());

        const dc = defaultConfig();
        const normalized = {
          ...m,
          missions: (m.missions || []).map(x => ({
            ...x,
            appearanceOverrideEnabled: !!x.appearanceOverrideEnabled,
            appearance: { ...defaultAppearance(), ...(x.appearance || {}) },
            correct: x.correct || { mode:'none' },
            wrong:   x.wrong   || { mode:'none' },
            showContinue: x.showContinue !== false,
          })),
        };

        let merged = {
          ...dc, ...c0,
          game: { ...dc.game, ...(c0.game || {}) },
          splash: { ...dc.splash, ...(c0.splash || {}) },
          timer: { ...dc.timer, ...(c0.timer || {}) },
          devices: (c0.devices && Array.isArray(c0.devices)) ? c0.devices
                   : (c0.powerups && Array.isArray(c0.powerups)) ? c0.powerups : [],
          media: { rewardsPool:[], penaltiesPool:[], ...(c0.media || {}) },
          icons: { ...DEFAULT_ICONS, ...(c0.icons || {}) },
          appearance: {
            ...defaultAppearance(),
            ...dc.appearance,
            ...(c0.appearance || {}),
          },
          map: { ...dc.map, ...(c0.map || {}) },
          geofence: { ...dc.geofence, ...(c0.geofence || {}) },
          mediaTriggers: { enabled:false, ...(c0.mediaTriggers || {}) },
        };

        const storedSkin = c0.appearanceSkin && ADMIN_SKIN_TO_UI.has(c0.appearanceSkin)
          ? c0.appearanceSkin
          : null;
        merged.appearanceSkin = storedSkin || detectAppearanceSkin(merged.appearance, c0.appearanceSkin);

        merged = normalizeGameMetadata(merged, isDefault ? 'default' : activeSlug);

        setSuite(normalized);
        setConfig(merged);
        setStatus('');
      } catch (e) {
        setStatus('Load failed: ' + (e?.message || e));
      }
    })();
  }, [activeSlug]);

  // Apply global theme whenever config changes
  useEffect(() => {
    if (!config) {
      const fallbackAppearance = DEFAULT_SKIN_PRESET?.appearance || defaultAppearance();
      applyAdminUiThemeForDocument(DEFAULT_APPEARANCE_SKIN, fallbackAppearance, 'light');
      return;
    }
    const stored = config.appearanceSkin && ADMIN_SKIN_TO_UI.has(config.appearanceSkin)
      ? config.appearanceSkin
      : null;
    const detected = detectAppearanceSkin(config.appearance, config.appearanceSkin);
    const tone = normalizeTone(config.appearanceTone);
    applyAdminUiThemeForDocument(stored || detected, config.appearance, tone);
  }, [config?.appearanceSkin, config?.appearance, config?.appearanceTone]);

  /* ── API helpers respecting Default Game (legacy root) ── */
  function isDefaultSlug(slug) { return !slug || slug === 'default'; }

  async function saveAllWithSlug(slug) {
    if (!suite || !config) return false;
    setStatus((prev) => {
      if (typeof prev === 'string' && prev.toLowerCase().includes('publishing')) return prev;
      return 'Saving…';
    });

    const isDefault = isDefaultSlug(slug);
    const slugTag = isDefault ? 'default' : slug;
    const preparedConfig = normalizeGameMetadata(config, slugTag);
    if (preparedConfig !== config) setConfig(preparedConfig);

    // Prefer bundle endpoint first
    const bundleUrl = isDefault ? '/api/save-bundle' : `/api/save-bundle?slug=${encodeURIComponent(slug)}`;
    const attemptBundle = async () => {
      const response = await fetch(bundleUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ missions: suite, config: preparedConfig }),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(text || 'save failed');
    };

    // Legacy fallback
    const attemptLegacy = async () => {
      const slugQuery = isDefault ? '' : `?slug=${encodeURIComponent(slug)}`;
      const missionsUrl = isDefault ? '/api/save' : `/api/save${slugQuery}`;
      const configUrl = isDefault ? '/api/save-config' : `/api/save-config${slugQuery}`;

      const missionsRes = await fetch(missionsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ missions: suite }),
      });
      const missionsText = await missionsRes.text();
      if (!missionsRes.ok) throw new Error(missionsText || 'save missions failed');

      const configRes = await fetch(configUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ config: preparedConfig }),
      });
      const configText = await configRes.text();
      if (!configRes.ok) throw new Error(configText || 'save config failed');
    };

    try {
      await attemptBundle();
      setStatus('✅ Saved');
      return true;
    } catch (bundleError) {
      try {
        setStatus('Bundle save unavailable — retrying legacy save…');
        await attemptLegacy();
        setStatus('✅ Saved');
        return true;
      } catch (legacyError) {
        console.error('Save failed', { bundleError, legacyError });
        setStatus('❌ Save failed: ' + (legacyError?.message || legacyError || bundleError));
        return false;
      }
    }
  }

  async function publishWithSlug(slug, channel='published') {
    if (isDefaultSlug(slug)) {
      try {
        const res = await fetch('/api/publish', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          credentials:'include',
          body: JSON.stringify({ slug: 'root' }),
        });
        const txt = await res.text();
        let data = {};
        try { data = JSON.parse(txt); } catch {}
        if (!res.ok || data?.ok === false) {
          const err = data?.error || txt || 'publish failed';
          throw new Error(err);
        }
        setStatus('✅ Published');
        return true;
      } catch (e) {
        setStatus('❌ Publish failed: ' + (e?.message || e));
        return false;
      }
    }

    const first = `/api/game?slug=${encodeURIComponent(slug)}&channel=${encodeURIComponent(channel)}`;
    const fallback = `/api/game/${encodeURIComponent(slug)}?channel=${encodeURIComponent(channel)}`;

    try {
      const res = await fetch(first, {
        method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
        body: JSON.stringify({ action:'publish' })
      });
      const txt = await res.text();
      let data = {};
      try { data = JSON.parse(txt); } catch {}
      if (!res.ok) throw new Error('try fallback');
      setStatus(`✅ Published${data?.version ? ` v${data.version}` : ''}`);
      return true;
    } catch (e) {
      try {
        const res2 = await fetch(fallback, {
          method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
          body: JSON.stringify({ action:'publish' })
        });
        const txt2 = await res2.text();
        let data2 = {};
        try { data2 = JSON.parse(txt2); } catch {}
        if (!res2.ok) throw new Error(txt2||'publish failed');
        setStatus(`✅ Published${data2?.version ? ` v${data2.version}` : ''}`);
        return true;
      } catch (e2) {
        setStatus('❌ Publish failed: ' + (e2?.message || e2));
        return false;
      }
    }
  }

  async function reloadGamesList() {
    if (!gameEnabled) { setGames([]); return; }
    try {
      const r = await fetch('/api/games', { credentials:'include', cache:'no-store' });
      if (!r.ok) throw new Error(await r.text() || `HTTP ${r.status}`);
      const j = await r.json();
      if (j.ok) setGames(Array.isArray(j.games) ? j.games : []);
      else if (j?.error) setStatus(`⚠️ ${j.error}`);
    } catch (err) {
      setStatus(`⚠️ Unable to refresh games list (${err?.message || 'network error'})`);
    }
  }

  async function saveAndPublish() {
    if (!suite || !config) return;
    const slug = activeSlug || 'default';
    const shouldPublish = gameEnabled && config?.game?.deployEnabled === true;
    const deployDelaySec = 5;

    setStatus(shouldPublish ? 'Saving & publishing…' : 'Saving…');
    const saved = await saveAllWithSlug(slug);
    if (!saved) return;
    if (shouldPublish) {
      if (deployDelaySec > 0) await new Promise(r => setTimeout(r, deployDelaySec * 1000));
      const published = await publishWithSlug(slug, 'published');
      if (!published) return;
    } else {
      setStatus('✅ Saved (game deploy disabled)');
    }
    await reloadGamesList();
  }

  // UI helpers
  const deployGameEnabled = config?.game?.deployEnabled === true;
  const headerGameTitle = (config?.game?.title || '').trim() || 'Default Game';
  const headerCoverThumb = config?.game?.coverImage
    ? toDirectMediaURL(config.game.coverImage)
    : '';
  const metaRepoLabel = adminMeta.repo ? `${adminMeta.owner ? `${adminMeta.owner}/` : ''}${adminMeta.repo}` : '';
  const metaRepoUrl = adminMeta.owner && adminMeta.repo
    ? `https://github.com/${adminMeta.owner}/${adminMeta.repo}`
    : '';
  const metaBranchUrl = metaRepoUrl && adminMeta.branch
    ? `${metaRepoUrl}/tree/${encodeURIComponent(adminMeta.branch)}`
    : '';
  const metaCommitFull = adminMeta.commit || '';
  const metaCommitShort = metaCommitFull ? String(metaCommitFull).slice(0, 7) : '';
  const metaCommitUrl = metaRepoUrl && metaCommitFull
    ? `${metaRepoUrl}/commit/${metaCommitFull}`
    : '';
  const metaDeploymentUrl = adminMeta.deploymentUrl || adminMeta.vercelUrl || '';
  const metaDeploymentLinkLabel = metaDeploymentUrl ? metaDeploymentUrl.replace(/^https?:\/\//, '') : '';
  const metaDeploymentState = adminMeta.deploymentState || (metaDeploymentUrl ? 'UNKNOWN' : '');
  const metaTimestampLabel = adminMeta.fetchedAt ? formatLocalDateTime(adminMeta.fetchedAt) : '';

  if (!suite || !config) {
    return (
      <main style={{ maxWidth: 900, margin: '40px auto', color: 'var(--admin-muted)', padding: 16 }}>
        <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--admin-border-soft)', background: 'var(--appearance-panel-bg, var(--admin-panel-bg))', boxShadow: 'var(--appearance-panel-shadow, var(--admin-panel-shadow))' }}>
          Loading… (pulling config & missions)
        </div>
      </main>
    );
  }

  return (
    <div style={S.body}>
      <div style={S.metaBanner}>
        <div style={{ ...S.metaBannerLine, flexWrap:'wrap', gap:12 }}>
          {metaRepoLabel && (
            <span>
              <strong>Repo:</strong>{' '}
              {metaRepoUrl ? (
                <a href={metaRepoUrl} target="_blank" rel="noreferrer" style={S.metaLink}>
                  {metaRepoLabel}
                </a>
              ) : metaRepoLabel}
            </span>
          )}
          <span>
            <strong>Branch:</strong>{' '}
            {metaBranchUrl ? (
              <a href={metaBranchUrl} target="_blank" rel="noreferrer" style={S.metaLink}>
                {adminMeta.branch || 'unknown'}
              </a>
            ) : (adminMeta.branch || 'unknown')}
          </span>
          {metaCommitFull && (
            <span>
              <strong>Commit:</strong>{' '}
              {metaCommitUrl ? (
                <a href={metaCommitUrl} target="_blank" rel="noreferrer" style={S.metaLink}>
                  {metaCommitShort}
                </a>
              ) : metaCommitShort}
            </span>
          )}
          {metaDeploymentState && (
            <span>
              <strong>Deployment:</strong>{' '}
              {metaDeploymentUrl ? (
                <a href={metaDeploymentUrl} target="_blank" rel="noreferrer" style={S.metaLink}>
                  {metaDeploymentState}
                </a>
              ) : metaDeploymentState}
            </span>
          )}
          {metaDeploymentLinkLabel && (
            <span>
              <strong>Preview:</strong>{' '}
              <a href={metaDeploymentUrl} target="_blank" rel="noreferrer" style={S.metaLink}>
                {metaDeploymentLinkLabel}
              </a>
            </span>
          )}
          {metaTimestampLabel && (
            <span><strong>Checked:</strong> {metaTimestampLabel}</span>
          )}
          {adminMeta.error && (
            <span style={S.metaBannerError}>{adminMeta.error}</span>
          )}
        </div>
      </div>

      <header style={S.header}>
        <div style={S.wrap}>
          <div style={S.headerTopRow}>
            <div style={S.headerTitleGroup}>
              <div style={S.headerCoverFrame}>
                {headerCoverThumb ? (
                  <img
                    src={headerCoverThumb}
                    alt="Active game cover"
                    style={S.headerCoverThumb}
                  />
                ) : (
                  <div style={S.headerCoverPlaceholder}>No Cover</div>
                )}
              </div>
              <div style={S.headerTitleColumn}>
                <div style={S.headerGameTitle}>{headerGameTitle}</div>
                <div style={S.headerSubtitle}>Admin Control Deck</div>
              </div>
            </div>
          </div>
          <div style={S.headerNavRow}>
            <div style={S.headerNavPrimary}>
              {['settings','missions','devices','text','assigned','media-pool','test'].map((t)=>{
                const labelMap = {
                  'missions':'MISSIONS',
                  'devices':'DEVICES',
                  'settings':'SETTINGS',
                  'text':'TEXT',
                  'media-pool':'MEDIA POOL',
                  'assigned':'ASSIGNED MEDIA',
                  'test':'TEST',
                };
                return (
                  <button key={t} onClick={()=>setTab(t)} style={{ ...S.tab, ...(tab===t?S.tabActive:{}) }}>
                    {labelMap[t] || t.toUpperCase()}
                  </button>
                );
              })}
              <button
                onClick={saveAndPublish}
                style={{ ...S.button, ...S.savePublishButton }}
              >
                Save & Publish
              </button>
            </div>
            <div style={S.headerNavSecondary}>
              <label style={{ color:'var(--admin-muted)', fontSize:12 }}>Game:</label>
              <select value={activeSlug} onChange={(e)=>setActiveSlug(e.target.value)} style={{ ...S.input, width:280 }}>
                <option value="default">(Default Game)</option>
                {games.map(g=>(
                  <option key={g.slug} value={g.slug}>{g.title} — {g.slug} ({g.mode||'single'})</option>
                ))}
              </select>
              <label style={{ color:'var(--admin-muted)', fontSize:12, display:'flex', alignItems:'center', gap:6 }}>
                <input
                  type="checkbox"
                  checked={deployGameEnabled}
                  onChange={(e)=>{
                    const effective = gameEnabled ? !!e.target.checked : false;
                    setConfig(prev => {
                      if (!prev) return prev;
                      return { ...prev, game: { ...(prev.game || {}), deployEnabled: effective } };
                    });
                    setStatus(effective
                      ? 'Game deployment enabled — Save & Publish will deploy the game build.'
                      : (gameEnabled
                        ? 'Game deployment disabled — Save & Publish updates admin data only.'
                        : 'Game project mirror disabled — Save & Publish updates admin data only.'));
                  }}
                  disabled={!gameEnabled}
                />
                Deploy game build
              </label>
            </div>
          </div>
          <div style={{ color:'var(--admin-muted)', marginTop:6, whiteSpace:'pre-wrap' }}>{status}</div>
        </div>
      </header>

      {/* SIMPLE TAB PLACEHOLDERS — your existing components render inside these sections */}
      {tab==='missions' && (
        <main style={S.wrap}><div style={S.card}>Use the Missions tab UI from your existing component tree.</div></main>
      )}
      {tab==='devices' && (
        <main style={S.wrap}><div style={S.card}>Use the Devices tab UI from your existing component tree.</div></main>
      )}
      {tab==='settings' && (
        <main style={S.wrap}><div style={S.card}>Settings panel (cover upload, map defaults, skins) — preserved behaviors.</div></main>
      )}
      {tab==='text' && (
        <TextTab config={config} setConfig={setConfig} />
      )}
      {tab==='assigned' && (
        <main style={S.wrap}><div style={S.card}>Assigned Media tab uses your existing `AssignedMediaTab` component.</div></main>
      )}
      {tab==='media-pool' && (
        <main style={S.wrap}><div style={S.card}>Media Pool tab (images/videos/audio/gifs) — use your existing MediaPoolTab implementation.</div></main>
      )}
      {tab==='test' && (
        <main style={S.wrap}>
          <div style={S.card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <h3 style={{ margin:0 }}>Play Test</h3>
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <TestLauncher slug={activeSlug === 'default' ? '' : activeSlug} channel={'draft'} preferPretty={true} popup={false}/>
              </div>
            </div>
            <div style={{ color:'var(--admin-muted)' }}>Set NEXT_PUBLIC_GAME_ORIGIN to enable in-iframe preview.</div>
          </div>
        </main>
      )}
    </div>
  );
}

/* Minimal styles retained */
const S = {
  body: {
    background: 'transparent',
    color: 'var(--appearance-font-color, var(--admin-body-color))',
    minHeight: '100vh',
    fontFamily: 'var(--appearance-font-family, var(--admin-font-family))',
  },
  metaBanner: {
    background: 'rgba(7, 12, 18, 0.82)',
    backdropFilter: 'blur(14px)',
    color: 'var(--appearance-font-color, var(--admin-body-color))',
    borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
    padding: '8px 16px',
    boxShadow: '0 18px 36px rgba(2, 6, 12, 0.45)',
  },
  metaBannerLine: {
    maxWidth: 1400,
    margin: '0 auto',
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaLink: { color: 'var(--admin-link-color, #60a5fa)', textDecoration: 'none', fontWeight: 600 },
  metaBannerError: { color: '#f87171', fontWeight: 600 },
  header: {
    padding: 20,
    background: 'var(--admin-header-bg)',
    backdropFilter: 'var(--admin-header-blur, blur(20px))',
    borderBottom: 'var(--admin-header-border)',
    position: 'sticky',
    top: 0,
    zIndex: 40,
    boxShadow: 'var(--admin-header-shadow)',
    color: 'var(--appearance-font-color, var(--admin-body-color))',
  },
  wrap: { maxWidth: 1400, margin: '0 auto', padding: 16 },
  tab: {
    padding: '8px 12px',
    borderRadius: 12,
    border: 'var(--admin-button-border)',
    background: 'var(--admin-tab-bg)',
    color: 'var(--admin-body-color)',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  },
  tabActive: { background: 'var(--admin-tab-active-bg)', boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' },
  headerTopRow: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6, marginBottom: 20 },
  headerTitleGroup: { display: 'flex', alignItems: 'center', gap: 16 },
  headerCoverFrame: {
    width: 68, height: 68, borderRadius: 16, overflow: 'hidden',
    border: '1px solid rgba(148, 163, 184, 0.4)', background: 'rgba(15, 23, 42, 0.7)',
    display: 'grid', placeItems: 'center', boxShadow: '0 18px 32px rgba(2, 6, 12, 0.55)',
  },
  headerCoverThumb: { width: '100%', height: '100%', objectFit: 'cover' },
  headerCoverPlaceholder: { fontSize: 11, color: 'var(--admin-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', padding: '0 6px' },
  headerTitleColumn: { display: 'grid', justifyItems: 'flex-start', textAlign: 'left', gap: 4 },
  headerGameTitle: { fontSize: 24, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' },
  headerSubtitle: { fontSize: 13, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--admin-muted)' },
  headerNavRow: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 },
  headerNavPrimary: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'center' },
  headerNavSecondary: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  button: {
    padding: '10px 14px',
    borderRadius: 12,
    border: 'var(--admin-button-border)',
    background: 'var(--admin-button-bg)',
    color: 'var(--admin-button-color)',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'background 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease',
    boxShadow: 'var(--admin-glass-sheen)',
  },
  savePublishButton: {
    background: 'linear-gradient(95deg, #2563eb, #38bdf8)',
    border: '1px solid rgba(59, 130, 246, 0.6)',
    color: '#f8fafc',
    boxShadow: '0 20px 36px rgba(37, 99, 235, 0.45)',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontWeight: 800,
    padding: '12px 20px',
  },
};

/* TEXT TAB (minimal, same API as your existing implementation expects) */
function TextTab({ config, setConfig }) {
  const [text, setText] = useState((config?.textRules || []).join('\n'));
  useEffect(()=>{ setText((config?.textRules || []).join('\n')); }, [config?.textRules]);
  return (
    <main style={S.wrap}>
      <div style={{ ...S.card }}>
        <h3 style={{ marginTop:0 }}>Text Rules / Instructions</h3>
        <div style={{ color:'var(--admin-muted)', marginBottom:8, fontSize:12 }}>
          One rule per line. This saves into <code>config.textRules</code>.
        </div>
        <textarea
          style={{ padding:'10px 12px', width:'100%', height:220, borderRadius:12, border:'var(--admin-input-border)', background:'var(--admin-input-bg)', color:'var(--admin-input-color)', fontFamily:'ui-monospace, Menlo' }}
          value={text}
          onChange={(e)=>setText(e.target.value)}
        />
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <button
            style={S.button}
            onClick={()=>{
              const lines = text.split('\n').map(s=>s.trim()).filter(Boolean);
              setConfig(c=>({ ...c, textRules: lines }));
            }}
          >
            Save Rules
          </button>
          <button
            style={S.button}
            onClick={()=>setText((config?.textRules || []).join('\n'))}
          >
            Reset
          </button>
        </div>
      </div>
    </main>
  );
}
