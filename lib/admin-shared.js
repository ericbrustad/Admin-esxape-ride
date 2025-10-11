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
export const BACKGROUND_TEXTURES = [
  {
    key: 'control-fabric',
    label: 'Control Fabric',
    image: '/media/skins/control-fabric.svg',
    description: 'Woven grey-blue fabric with subtle sheen for control rooms.',
  },
  {
    key: 'space-metal',
    label: 'Space Metal',
    image: '/media/skins/space-metal.svg',
    description: 'Brushed chrome plating with light refraction streaks.',
  },
  {
    key: 'desert-canvas',
    label: 'Desert Canvas',
    image: '/media/skins/desert-canvas.svg',
    description: 'Sun bleached tactical canvas with soft dune patterning.',
  },
  {
    key: 'forest-foliage',
    label: 'Forest Foliage',
    image: '/media/skins/forest-foliage.svg',
    description: 'Layered leaves, bark grain, and dappled woodland light.',
  },
  {
    key: 'starfield-soft',
    label: 'Soft Starfield',
    image: '/media/skins/starfield-soft.svg',
    description: 'Muted nebula dust with drifting constellations.',
  },
  {
    key: 'cartoon-balloons',
    label: 'Cartoon Balloons',
    image: '/media/skins/cartoon-balloons.svg',
    description: 'Candy balloons and bubbles with glossy highlights.',
  },
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
    screenBgImageEnabled: true,
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
    game:   { title:'Untitled Game', type:'Mystery' },
    forms:  { players:1 },
    timer:  { durationMinutes:0, alertMinutes:10 },
    textRules: [],
    devices: [], powerups: [],
    media: {}, icons: DEFAULT_ICONS,
    appearance: defaultAppearance(),
    appearanceSkin: 'default',
    appearanceTone: 'light',
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

export function normalizeTone(tone) {
  return tone === 'dark' ? 'dark' : 'light';
}

export function appearanceBackgroundStyle(appearance = {}, tone = 'light') {
  const normalizedTone = normalizeTone(tone);
  const overlayBase = clamp(Number(appearance?.screenBgOpacity ?? 0), 0, 1);
  const overlay = normalizedTone === 'dark'
    ? Math.min(0.85, Math.max(overlayBase, 0.55))
    : overlayBase;
  const imageEnabled = appearance?.screenBgImage && appearance?.screenBgImageEnabled !== false;
  const imageUrl = imageEnabled ? toDirectMediaURL(appearance.screenBgImage) : '';
  const baseColor = appearance?.screenBgColor
    || (normalizedTone === 'dark' ? '#05090f' : '#f0f5ff');

  const gradientLayers = [];
  if (normalizedTone === 'dark') {
    gradientLayers.push('rgba(4, 9, 16, 0.68)');
  }
  if (overlay > 0) {
    gradientLayers.push(`rgba(0, 0, 0, ${overlay})`);
  }

  let backgroundImage = '';
  let backgroundSize = '';
  let backgroundRepeat = '';
  let backgroundPosition = '';
  let backgroundBlendMode = '';

  if (imageUrl) {
    const gradient = gradientLayers.length > 0
      ? `linear-gradient(${gradientLayers.join(', ')})`
      : '';
    backgroundImage = gradient ? `${gradient}, url(${imageUrl})` : `url(${imageUrl})`;
    backgroundSize = gradient ? 'cover, cover' : 'cover';
    backgroundRepeat = gradient ? 'no-repeat, no-repeat' : 'no-repeat';
    backgroundPosition = gradient ? 'center, center' : 'center';
    backgroundBlendMode = normalizedTone === 'dark' ? 'normal, normal' : 'soft-light, normal';
  } else if (gradientLayers.length > 0) {
    backgroundImage = `linear-gradient(${gradientLayers.join(', ')})`;
    backgroundSize = 'cover';
    backgroundRepeat = 'no-repeat';
    backgroundPosition = 'center';
    backgroundBlendMode = 'normal';
  }

  return {
    backgroundColor: baseColor,
    backgroundImage,
    backgroundSize,
    backgroundRepeat,
    backgroundPosition,
    backgroundBlendMode,
  };
}
