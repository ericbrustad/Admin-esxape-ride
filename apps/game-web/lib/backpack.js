// Backpack persistence with Supabase sync support.
const SKEY = (slug) => `esx.backpack.${slug || 'default'}`;
const DROP_CACHE_KEY = (slug) => `esx.backpack.${slug || 'default'}.drops`;
const SYNC_DELAY_MS = 400;

const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

function readDropCache(slug) {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(DROP_CACHE_KEY(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeCoordinate(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function writeDropCache(slug, entries) {
  if (!isBrowser()) return;
  try {
    const list = Array.isArray(entries) ? entries.slice(0, 50) : [];
    localStorage.setItem(DROP_CACHE_KEY(slug), JSON.stringify(list));
  } catch {}
}

function baseState() {
  return {
    points: 0,
    pockets: {
      photos: [],
      videos: [],
      audios: [],
      rewards: [],
      utilities: [],
      clues: [],
      finds: [], // geo-finds collected via geofences
    },
    answers: {},
    visits: {
      geofences: {}, // { [geofenceId]: timestamp }
    },
  };
}

function normalizeState(state = {}) {
  const base = baseState();
  const pockets = { ...base.pockets, ...(state.pockets || {}) };
  pockets.photos = pockets.photos || [];
  pockets.rewards = pockets.rewards || [];
  pockets.utilities = pockets.utilities || [];
  pockets.clues = pockets.clues || [];
  pockets.finds = pockets.finds || [];
  return {
    ...base,
    ...state,
    pockets,
    visits: {
      ...base.visits,
      ...(state.visits || {}),
      geofences: {
        ...(base.visits.geofences || {}),
        ...((state.visits && state.visits.geofences) || {}),
      },
    },
  };
}

function read(slug) {
  if (!isBrowser()) return baseState();
  try {
    const raw = localStorage.getItem(SKEY(slug));
    if (!raw) return baseState();
    return normalizeState(JSON.parse(raw));
  } catch {
    return baseState();
  }
}

function write(slug, data) {
  if (!isBrowser()) return;
  const next = normalizeState(data);
  localStorage.setItem(SKEY(slug), JSON.stringify(next));
  return next;
}

const pendingSync = new Map();

function scheduleSync(slug) {
  if (!isBrowser() || typeof fetch === 'undefined') return;
  if (pendingSync.has(slug)) {
    clearTimeout(pendingSync.get(slug));
  }
  const handle = setTimeout(() => {
    pendingSync.delete(slug);
    const state = read(slug);
    pushToSupabase(slug, state).catch(() => {});
  }, SYNC_DELAY_MS);
  pendingSync.set(slug, handle);
}

async function pushToSupabase(slug, state) {
  if (!slug || typeof fetch === 'undefined') return null;
  try {
    const res = await fetch('/api/backpack', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, state }),
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    return json;
  } catch {
    return null;
  }
}

async function pullFromSupabase(slug) {
  if (!slug || typeof fetch === 'undefined') return null;
  try {
    const res = await fetch(`/api/backpack?slug=${encodeURIComponent(slug)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    if (json && json.state) {
      write(slug, json.state);
      return normalizeState(json.state);
    }
    return null;
  } catch {
    return null;
  }
}

function persist(slug, next) {
  write(slug, next);
  scheduleSync(slug);
  return next;
}

export function initBackpack(slug) {
  const current = read(slug);
  return write(slug, current);
}

export function getBackpack(slug) {
  return read(slug);
}

export function addPoints(slug, n) {
  const s = read(slug);
  s.points = (s.points || 0) + (Number(n) || 0);
  persist(slug, s);
  return s.points;
}

export function getPoints(slug) {
  return read(slug).points || 0;
}

export function addPhoto(slug, { dataUrl, title }) {
  const s = read(slug);
  const id = `ph_${Date.now()}`;
  s.pockets.photos.unshift({ id, url: dataUrl, title: title || 'Photo', ts: Date.now() });
  persist(slug, s);
  return id;
}

export function addReward(slug, { key, name, thumbUrl }) {
  const s = read(slug);
  const id = `rw_${Date.now()}`;
  s.pockets.rewards.unshift({ id, key, name, thumbUrl, ts: Date.now() });
  persist(slug, s);
  return id;
}

export function addUtility(slug, { key, name, thumbUrl }) {
  const s = read(slug);
  const id = `ut_${Date.now()}`;
  s.pockets.utilities.unshift({ id, key, name, thumbUrl, ts: Date.now() });
  persist(slug, s);
  return id;
}

export function addClue(slug, text) {
  const s = read(slug);
  const id = `cl_${Date.now()}`;
  s.pockets.clues.unshift({ id, text: String(text || ''), ts: Date.now() });
  persist(slug, s);
  return id;
}

export function addFind(slug, item) {
  const s = read(slug);
  const id = item?.id || `gf_${Date.now()}`;
  s.pockets.finds.unshift({
    id,
    name: item?.name || 'Geo Find',
    description: item?.description || '',
    iconUrl: item?.iconUrl || '',
    originId: item?.originId || '',
    originType: item?.originType || '',
    lat: item?.lat ?? null,
    lng: item?.lng ?? null,
    collectedAt: item?.collectedAt || Date.now(),
  });
  persist(slug, s);
  return id;
}

export function markGeofenceVisit(slug, geofenceId) {
  if (!geofenceId) return;
  const s = read(slug);
  s.visits.geofences[geofenceId] = Date.now();
  persist(slug, s);
}

export function hasVisitedGeofence(slug, geofenceId) {
  const s = read(slug);
  return Boolean(s.visits.geofences[geofenceId]);
}

export function removePocketItem(slug, pocket, id) {
  if (!pocket || !id) return;
  const s = read(slug);
  const arr = s.pockets[pocket] || [];
  const index = arr.findIndex((item) => item.id === id);
  if (index >= 0) {
    arr.splice(index, 1);
    persist(slug, s);
  }
}

export function recordAnswer(slug, missionId, { correct, value }) {
  const s = read(slug);
  s.answers[String(missionId)] = { correct: !!correct, value, ts: Date.now() };
  persist(slug, s);
}

export function getProgress(slug) {
  const s = read(slug);
  return { points: s.points || 0, answers: s.answers || {}, pockets: s.pockets || {} };
}

export async function loadBackpackFromSupabase(slug) {
  return pullFromSupabase(slug);
}

export async function syncBackpack(slug) {
  const state = read(slug);
  await pushToSupabase(slug, state);
  return state;
}

export async function dropPocketItem(slug, pocket, id, location = null) {
  const s = read(slug);
  const arr = s.pockets[pocket] || [];
  const index = arr.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const [removed] = arr.splice(index, 1);
  persist(slug, s);
  const entry = await logDrop(slug, pocket, removed, location);
  return { removed, entry };
}

async function logDrop(slug, pocket, item, location) {
  if (!slug || typeof fetch === 'undefined') return null;
  const fallbackEntry = {
    id: `drop_${Date.now()}`,
    slug,
    pocket: String(pocket || ''),
    item,
    lat: normalizeCoordinate(location?.lat),
    lng: normalizeCoordinate(location?.lng),
    accuracy: normalizeCoordinate(location?.accuracy),
    dropped_at: new Date().toISOString(),
  };
  try {
    const res = await fetch('/api/backpack/drop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, pocket, item, location }),
    });
    if (!res.ok) {
      const cached = readDropCache(slug);
      writeDropCache(slug, [fallbackEntry, ...cached]);
      return fallbackEntry;
    }
    const json = await res.json().catch(() => null);
    const entry = json?.entry || fallbackEntry;
    const cached = readDropCache(slug);
    writeDropCache(slug, [entry, ...cached]);
    return entry;
  } catch {
    const cached = readDropCache(slug);
    writeDropCache(slug, [fallbackEntry, ...cached]);
    return fallbackEntry;
  }
}

export async function listDroppedItems(slug) {
  if (!slug || typeof fetch === 'undefined') return [];
  const cached = readDropCache(slug);
  try {
    const res = await fetch(`/api/backpack/drops?slug=${encodeURIComponent(slug)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      return cached;
    }
    const json = await res.json().catch(() => null);
    let list = Array.isArray(json?.items) ? json.items : [];
    if (!list.length && json?.ok === false) {
      list = cached;
    }
    if (!Array.isArray(list) || !list.length) {
      list = cached;
    }
    if (!Array.isArray(list)) {
      list = [];
    }
    writeDropCache(slug, list);
    return list;
  } catch {
    return cached;
  }
}
