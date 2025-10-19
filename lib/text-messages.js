import { clamp } from './admin-shared';

export const TEXT_PLAYER_TOKENS = [
  { token: '{{FIRST_NAME}}', label: 'First name' },
  { token: '{{LAST_NAME}}', label: 'Last name' },
  { token: '{{EMAIL}}', label: 'Email' },
  { token: '{{CELL}}', label: 'Cell number' },
  { token: '{{IN_CASE_OF_EMERGENCY_NUMBER}}', label: 'Emergency contact' },
];

const GEO_DEFAULTS = {
  geofenceEnabled: false,
  lat: '',
  lng: '',
  radiusMeters: 25,
  cooldownSeconds: 30,
};

export const TEXT_MESSAGE_CONTENT_DEFAULTS = {
  ...GEO_DEFAULTS,
  enableIncoming: false,
  incomingTitle: '',
  incomingBody: '',
  enableOutgoing: false,
  outgoingPrompt: '',
  outgoingPlayerMessage: '',
  outgoingResponseNote: '',
  targetNumberKey: '',
  targetNumberDirect: '',
  conversationLog: '',
};

function sanitizeLine(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function sanitizeParagraph(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n/g, '\n').replace(/\s+$/g, '').trim();
}

function sanitizePhone(value) {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw) return '';
  const cleaned = raw.replace(/[^+\d]/g, '');
  if (cleaned.startsWith('00')) {
    return `+${cleaned.slice(2)}`;
  }
  return cleaned;
}

function sanitizeCoordinates(value) {
  if (value === '' || value === null || value === undefined) return '';
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return Number(num.toFixed(6));
}

function sanitizeRadius(value) {
  if (value === '' || value === null || value === undefined) return 25;
  const num = Number(value);
  if (!Number.isFinite(num)) return 25;
  return clamp(num, 5, 2000);
}

export function createTextMessageContent(overrides = {}) {
  const merged = { ...TEXT_MESSAGE_CONTENT_DEFAULTS, ...(overrides || {}) };
  return {
    ...GEO_DEFAULTS,
    enableIncoming: !!merged.enableIncoming,
    incomingTitle: sanitizeLine(merged.incomingTitle),
    incomingBody: sanitizeParagraph(merged.incomingBody),
    enableOutgoing: !!merged.enableOutgoing,
    outgoingPrompt: sanitizeParagraph(merged.outgoingPrompt),
    outgoingPlayerMessage: sanitizeParagraph(merged.outgoingPlayerMessage),
    outgoingResponseNote: sanitizeParagraph(merged.outgoingResponseNote),
    targetNumberKey: sanitizeLine(merged.targetNumberKey),
    targetNumberDirect: sanitizePhone(merged.targetNumberDirect),
    conversationLog: sanitizeParagraph(merged.conversationLog),
    geofenceEnabled: merged.geofenceEnabled === true,
    lat: sanitizeCoordinates(merged.lat),
    lng: sanitizeCoordinates(merged.lng),
    radiusMeters: sanitizeRadius(merged.radiusMeters),
    cooldownSeconds: clamp(Number(merged.cooldownSeconds ?? 30) || 30, 5, 3600),
  };
}

export function validateTextMessageContent(content) {
  const normalized = createTextMessageContent(content);
  const errors = [];
  const incomingEnabled = normalized.enableIncoming;
  const outgoingEnabled = normalized.enableOutgoing;

  if (!incomingEnabled && !outgoingEnabled) {
    errors.push('Enable incoming or outgoing text content');
  }

  if (incomingEnabled) {
    if (!normalized.incomingTitle) errors.push('Incoming text title required');
    if (!normalized.incomingBody) errors.push('Incoming message body required');
  }

  if (outgoingEnabled) {
    if (!normalized.outgoingPrompt) errors.push('Outgoing prompt required');
    if (!normalized.outgoingPlayerMessage) errors.push('Outgoing player message required');
    if (!normalized.targetNumberKey && !normalized.targetNumberDirect) {
      errors.push('Provide a recipient number key or fallback phone number');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    content: normalized,
  };
}
