// components/RolesGate.jsx
import React from 'react';

function rolesEmpty(roles) {
  if (!roles) return true;
  const { ownerEmails=[], editorEmails=[], viewerEmails=[] } = roles;
  return (ownerEmails.length + editorEmails.length + viewerEmails.length) === 0;
}

export function hasRole(userEmail, roles, need) {
  const email = (userEmail || '').toLowerCase().trim();
  if (!email) return false;
  if (rolesEmpty(roles)) return true; // first-run: no roles configured -> allow access when email is set
  const { ownerEmails=[], editorEmails=[], viewerEmails=[] } = roles || {};
  const map = {
    owner: ownerEmails,
    editor: [...ownerEmails, ...editorEmails],
    viewer: [...ownerEmails, ...editorEmails, ...viewerEmails]
  };
  return (map[need]||[]).map(e=>String(e||'').toLowerCase().trim()).includes(email);
}

export default function RolesGate({ userEmail, roles, need='viewer', fallback=null, children }) {
  return hasRole(userEmail, roles, need) ? children : fallback;
}
