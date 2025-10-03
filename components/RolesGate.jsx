// components/RolesGate.jsx
import React from 'react';

export function hasRole(userEmail, roles, need) {
  if (!userEmail) return false;
  const { ownerEmails=[], editorEmails=[], viewerEmails=[] } = roles || {};
  const map = { owner: ownerEmails, editor: [...ownerEmails, ...editorEmails], viewer: [...ownerEmails, ...editorEmails, ...viewerEmails] };
  return (map[need]||[]).map(e=>e.toLowerCase().trim()).includes(userEmail.toLowerCase().trim());
}

export default function RolesGate({ userEmail, roles, need='viewer', fallback=null, children }) {
  return hasRole(userEmail, roles, need) ? children : fallback;
}
