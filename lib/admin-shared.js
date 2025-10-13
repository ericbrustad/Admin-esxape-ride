// lib/admin-shared.js
// Shared helpers, constants, and defaults used by Admin

/* ------------------ helpers ------------------ */
export async function fetchJsonSafe(url, fallback) {
  try {
    const r = await fetch(url, { cache: 'no-store', credentials: 'include' });
    const ct = r.headers.get('content-type') || '';
    if (r.ok && ct.includes('application/json')) return await r.json();
  } catch {}
  return fallback;
}
export async function fetchFirstJson(urls, fallback) {
  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: 'no-store', credentials: 'include' });
      const ct = r.headers.get('content-type') || '';
      if (r.ok && ct.includes('application/json')) return await r.json();
    } catch {}
  }
  return fallback;
}
export function toDirectMediaURL(u) {
  if (!u) return u;
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
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export function hexToRgb(hex) {
  try {
    const h = hex.replace('#','');
    const b = h.length === 3 ? h.split('').map(ch=>ch+ch).join('') : h;
    const r = parseInt(b.slice(0,2),16), g = parseInt(b.slice(2,4),16), bl = parseInt(b.slice(4,6),16);
    return `${r}, ${g}, ${bl}`;
  } catch { return '0,0,0'; }
}

export function normalizeTone(value) {
  const str = String(value || '').toLowerCase().trim();
  if (str === 'light' || str === 'dark') return str;
  if (str.startsWith('l')) return 'light';
  return 'dark';
}

export function appearanceBackgroundStyle(appearance = {}, tone = 'dark') {
  const normalizedTone = normalizeTone(tone);
  const overlay = clamp(Number(appearance?.screenBgOpacity ?? 0), 0, 1);
  const fallbackColor = normalizedTone === 'dark' ? '#0b101a' : '#f5f7fb';
  const backgroundColor = appearance?.screenBgColor || fallbackColor;

  const style = {
    backgroundColor,
    backgroundImage: 'none',
    backgroundSize: '',
    backgroundRepeat: '',
    backgroundPosition: '',
    backgroundBlendMode: overlay > 0 ? 'multiply' : '',
  };

  if (appearance?.screenBgImage && appearance?.screenBgImageEnabled !== false) {
    style.backgroundImage = `url(${appearance.screenBgImage})`;
    style.backgroundSize = appearance?.screenBgSize || 'cover';
    style.backgroundRepeat = appearance?.screenBgRepeat || 'no-repeat';
    style.backgroundPosition = appearance?.screenBgPosition || 'center';
    if (!appearance?.screenBgBlendMode && overlay <= 0) {
      style.backgroundBlendMode = '';
    } else if (appearance?.screenBgBlendMode) {
      style.backgroundBlendMode = appearance.screenBgBlendMode;
    }
  }

  return style;
}

export function surfaceStylesFromAppearance(appearance = {}, tone = 'dark') {
  const normalizedTone = normalizeTone(tone);
  const overlay = clamp(Number(appearance?.screenBgOpacity ?? 0), 0, 1);
  const isFlat = appearance?.panelDepth === false;

  const panelBase = normalizedTone === 'dark'
    ? `rgba(14, 22, 34, ${clamp(0.76 + overlay * 0.12, 0.6, 0.95)})`
    : `rgba(255, 255, 255, ${clamp(0.88 - overlay * 0.25, 0.5, 0.97)})`;

  const panelBorder = normalizedTone === 'dark'
    ? '1px solid rgba(130, 170, 220, 0.28)'
    : '1px solid rgba(36, 52, 72, 0.16)';

  const panelShadow = isFlat
    ? 'none'
    : normalizedTone === 'dark'
      ? '0 18px 42px rgba(0, 0, 0, 0.45)'
      : '0 18px 48px rgba(28, 44, 72, 0.22)';

  const pipingOpacity = isFlat
    ? 0
    : normalizedTone === 'dark'
      ? clamp(0.4 + overlay * 0.2, 0.25, 0.78)
      : clamp(0.2 + overlay * 0.35, 0.18, 0.72);

  const pipingShadow = normalizedTone === 'dark'
    ? '0 0 18px rgba(40, 80, 140, 0.35)'
    : '0 0 18px rgba(190, 210, 240, 0.45)';

  return {
    panelBg: panelBase,
    panelBorder,
    panelShadow,
    pipingOpacity,
    pipingShadow,
  };
}

/* ------------------ constants ------------------ */
export const TYPE_FIELDS = {
  multiple_choice: [
    { key:'question', label:'Question', type:'text' },
    { key:'mediaUrl',  label:'Image or Video URL (optional)', type:'text' },
  ],
  short_answer: [
    { key:'question',   label:'Question', type:'text' },
    { key:'answer',     label:'Correct Answer', type:'text' },
    { key:'acceptable', label:'Also Accept (comma-separated)', type:'text' },
    { key:'mediaUrl',   label:'Image or Video URL (optional)', type:'text' },
  ],
  statement: [
    { key:'text',     label:'Statement Text', type:'multiline' },
    { key:'mediaUrl', label:'Image or Video URL (optional)', type:'text' },
  ],
  video: [
    { key:'videoUrl',   label:'Video URL (https)', type:'text' },
    { key:'overlayText',label:'Overlay Text (optional)', type:'text' },
  ],
  geofence_image: [
    { key:'lat', label:'Latitude', type:'number' },
    { key:'lng', label:'Longitude', type:'number' },
    { key:'radiusMeters',    label:'Geofence Radius (m)', type:'number', min:5, max:2000 },
    { key:'cooldownSeconds', label:'Cooldown (sec)', type:'number', min:5, max:240 },
    { key:'imageUrl',  label:'Image URL (https)', type:'text' },
    { key:'overlayText',label:'Caption/Text', type:'text' },
  ],
  geofence_video: [
    { key:'lat', label:'Latitude', type:'number' },
    { key:'lng', label:'Longitude', type:'number' },
    { key:'radiusMeters',    label:'Geofence Radius (m)', type:'number', min:5, max:2000 },
    { key:'cooldownSeconds', label:'Cooldown (sec)', type:'number', min:5, max:240 },
    { key:'videoUrl',  label:'Video URL (https)', type:'text' },
    { key:'overlayText',label:'Overlay Text (optional)', type:'text' },
  ],
  ar_image: [
    { key:'markerUrl', label:'AR Marker Image URL (png/jpg)', type:'text' },
    { key:'assetUrl',  label:'AR Overlay Image URL (png/jpg)', type:'text' },
    { key:'overlayText',label:'Overlay Text (optional)', type:'text' },
  ],
  ar_video: [
    { key:'markerUrl', label:'AR Marker Image URL (png/jpg)', type:'text' },
    { key:'assetUrl',  label:'AR Video URL (mp4)', type:'text' },
    { key:'overlayText',label:'Overlay Text (optional)', type:'text' },
  ],
  stored_statement: [
    { key:'template', label:'Template Text (use #mXX# to insert answers)', type:'multiline' },
  ],
};
export const TYPE_LABELS = {
  multiple_choice:  'Multiple Choice',
  short_answer:     'Question (Short Answer)',
  statement:        'Statement',
  video:            'Video',
  geofence_image:   'Geo Fence Image',
  geofence_video:   'Geo Fence Video',
  ar_image:         'AR Image',
  ar_video:         'AR Video',
  stored_statement: 'Stored Statement',
};
export const GAME_TYPES = ['Mystery','Chase','Race','Thriller','Hunt'];
export const DEVICE_TYPES = [
  { value:'smoke',  label:'Smoke (hide on GPS)' },
  { value:'clone',  label:'Clone (decoy location)' },
  { value:'jammer', label:'Signal Jammer (blackout radius)' },
];
export const FONT_FAMILIES = [
  { v:'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif', label:'System' },
  { v:'Georgia, serif',                      label:'Georgia' },
  { v:'Times New Roman, Times, serif',      label:'Times New Roman' },
  { v:'Arial, Helvetica, sans-serif',       label:'Arial' },
  { v:'Courier New, Courier, monospace',    label:'Courier New' },
];
export function defaultAppearance() {
  return {
    fontFamily: FONT_FAMILIES[0].v,
    fontSizePx: 22,
    fontColor: '#ffffff',
    textBgColor: '#000000',
    textBgOpacity: 0.0,
    screenBgColor: '#000000',
    screenBgOpacity: 0.0,
    screenBgImage: '',
    textAlign: 'center',
    textVertical: 'top',
  };
}
export const DEFAULT_ICONS = { missions:[], devices:[], rewards:[] };
export const DEFAULT_REWARDS = [
  { key:'gold-coin', name:'Gold Coin', ability:'Adds a coin to your wallet.', thumbUrl:'https://drive.google.com/uc?export=view&id=1TicLeS2LLwY8nVk-7Oc6ESxk_SyvxZGw' },
];

/* ------------------ defaults ------------------ */
export function defaultConfig() {
  return {
    splash: { enabled:true, mode:'single' },
    game:   { title:'Untitled Game', type:'Mystery', tags:['default','default-game'], coverImage:'' },
    forms:  { players:1 },
    timer:  { durationMinutes:0, alertMinutes:10 },
    textRules: [],
    devices: [], powerups: [],
    media: {}, icons: DEFAULT_ICONS,
    appearance: defaultAppearance(),
  };
}
export function defaultContentForType(t) {
  const base = { geofenceEnabled:false, lat:'', lng:'', radiusMeters:25, cooldownSeconds:30 };
  switch (t) {
    case 'multiple_choice': return { question:'', choices:[], correctIndex:undefined, mediaUrl:'', ...base };
    case 'short_answer':    return { question:'', answer:'', acceptable:'', mediaUrl:'', ...base };
    case 'statement':       return { text:'', mediaUrl:'', ...base };
    case 'video':           return { videoUrl:'', overlayText:'', ...base };
    case 'geofence_image':  return { lat:'', lng:'', radiusMeters:25, cooldownSeconds:30, imageUrl:'', overlayText:'' };
    case 'geofence_video':  return { lat:'', lng:'', radiusMeters:25, cooldownSeconds:30, videoUrl:'', overlayText:'' };
    case 'ar_image':        return { markerUrl:'', assetUrl:'', overlayText:'', ...base };
    case 'ar_video':        return { markerUrl:'', assetUrl:'', overlayText:'', ...base };
    case 'stored_statement':return { template:'' };
    default:                return { ...base };
  }
}
