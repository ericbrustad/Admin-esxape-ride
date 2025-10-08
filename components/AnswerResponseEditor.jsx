import React, { useState } from 'react';

/* ───────────────── AnswerResponseEditor (Admin: Missions) ─────────────────
   Adds:
   - Collapse/Expand control so the editor doesn't always take all screen space
   - "Open" button next to each MediaPicker to preview media in overlay
   - Close button inside overlay to dismiss preview
   - Persists into editing.onCorrect and editing.onWrong via setEditing
----------------------------------------------------------------------------*/
export default function AnswerResponseEditor({ editing, setEditing, inventory }) {
  const inv = Array.isArray(inventory) ? inventory : [];
  const imagesVideos = inv.filter(it =>
    /^(image|gif|video)$/i.test(it.type || '') ||
    /\.(png|jpg|jpeg|gif|webp|avif|mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(it.url || '')
  );
  const audios = inv.filter(it =>
    /^audio$/i.test(it.type || '') ||
    /\.(mp3|wav|ogg|m4a|aiff|aif)(\?|#|$)/i.test((it.url || ''))
  );

  const oC = editing?.onCorrect || {};
  const oW = editing?.onWrong || {};

  function setOC(next) {
    setEditing(prev => ({ ...prev, onCorrect: { buttonText: 'OK', ...(prev?.onCorrect || {}), ...next } }));
  }
  function setOW(next) {
    setEditing(prev => ({ ...prev, onWrong: { buttonText: 'OK', ...(prev?.onWrong || {}), ...next } }));
  }

  // UI state: collapse whole editor; preview overlay
  const [collapsed, setCollapsed] = useState(false);
  const [preview, setPreview] = useState({ show: false, url: '', kind: '' });

  const row = { display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8, alignItems: 'center', margin: '6px 0' };
  const lab = { fontSize: 12, color: '#9fb0bf' };
  const inp = { padding: '10px 12px', borderRadius: 10, border: '1px solid #2a323b', background: '#0b0c10', color: '#e9eef2', width: '100%' };
  const box = { border: '1px solid #2a323b', borderRadius: 10, padding: 10, margin: '12px 0' };

  const smallBtn = {
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid #2a323b',
    background: '#0b1115',
    color: '#e9eef2',
    cursor: 'pointer',
    f
