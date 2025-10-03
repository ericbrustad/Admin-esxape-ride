// lib/storage.js
export const KEYS = {
  DRAFT: 'erix_admin_draft_v1',
  PUBLISHED: 'erix_admin_published_v1',
  UNDO_STACK: 'erix_admin_undo_stack_v1',
  USER_EMAIL: 'erix_admin_user_email_v1',
};

const isBrowser = () => typeof window !== 'undefined';

export function load(key, fallback) {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) { return fallback; }
}

export function save(key, value) {
  if (!isBrowser()) return;
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

export function pushUndo(snapshot) {
  const stack = load(KEYS.UNDO_STACK, []);
  stack.push({ ts: Date.now(), snapshot });
  save(KEYS.UNDO_STACK, stack.slice(-50));
}

export function popUndo() {
  const stack = load(KEYS.UNDO_STACK, []);
  const last = stack.pop();
  save(KEYS.UNDO_STACK, stack);
  return last?.snapshot;
}

export function clearUndo() { save(KEYS.UNDO_STACK, []); }
