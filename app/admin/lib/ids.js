import { ulid } from 'ulid';

export function newId(prefix = '') {
  return (prefix ? `${prefix}_` : '') + ulid().toLowerCase();
}

export function toSlug(s) {
  return String(s || 'untitled')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
