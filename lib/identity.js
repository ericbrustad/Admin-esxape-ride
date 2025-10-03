// lib/identity.js
import { KEYS, load, save } from './storage';

export function getUserEmail() {
  return load(KEYS.USER_EMAIL, '');
}

export function setUserEmail(email) {
  if (!email) return;
  save(KEYS.USER_EMAIL, email);
}
