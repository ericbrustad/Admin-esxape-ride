// game/components/OutcomeModal.jsx
import React, { useEffect, useRef, useState } from 'react';

export default function OutcomeModal({
  open,
  onClose,
  data = {},      // { statement, mediaUrl, audioUrl, durationSeconds, buttonText }
  title,          // optional title from caller; fallback to "Correct!" or "Try Again" upstream
  variant,        // optional: 'correct' | 'wrong' (for styling)
}) {
  const {
    statement = '',
    mediaUrl = '',
    audioUrl = '',
    durationSeconds = 0,
    buttonText = 'OK',
  } = data || {};

  const [remaining, setRemaining] = useState(0);
  const audioRef = useRef(null);

  // Reset when opened
  useEffect(() => {
    if (!open) return;
    setRemaining(Math.max(0, Math.ceil(Number(durationSeconds) || 0)));
  }, [open, durationSeconds]);

  // Auto-close countdown
  useEffect(() => {
    if (!open) return;
    if (!remaining) return;
    const t = setInterval(() => {
      setRemaining((n) => {
        if (n <= 1) {
          clearInterval(t);
          onClose && onClose();
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [open, remaining, onClose]);

  // Optional audio (play on open, stop on close)
  useEffect(() => {
    if (!open || !audioUrl) return;
    const a = new Audio(audioUrl);
    audioRef.current = a;
    a.play().catch(() => {});
    return () => {
      try { a.pause(); a.currentTime = 0; } catch {}
      audioRef.current = null;
    };
  }, [open, audioUrl]);

  const isVideo = /\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(mediaUrl || '');
  const isImage = /\.(png|jpg|jpeg|gif|webp|avif)(\?|#|$)/i.test(mediaUrl || '');

  if (!open) return null;

  const styles = {
    backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 5000, display: 'grid', placeItems: 'center', padding: 16 },
    card:     { width: 'min(720px, 94vw)', background: '#12181d', color: '#e9eef2', border: '1px solid #1f262d', borderRadius: 14, padding: 16, boxShadow: '0 6px 24px rgba(0,0,0,0.35)' },
    head:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    title:    { fontSize: 18, fontWeight: 700 },
    body:     { display: 'grid', gap: 10 },
    media:    { width: '100%', borderRadius: 10, border: '1px solid #2a323b' },
    stmt:     { whiteSpace: 'pre-wrap', lineHeight: 1.35 },
    foot:     { marginTop: 6, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    chip:     { fontSize: 12, border: '1px solid #2a323b', padding: '2px 6px', borderRadius: 999, background: '#0f1418', color: '#c9d6e2' },
    btn:      { padding: '10px 14px', borderRadius: 10, border: '1px solid #2a323b', background: '#1a2027', color: '#e9eef2', cursor: 'pointer' },
  };

  return (
    <div style={styles.backdrop} role="dialog" aria-modal="true" aria-label={title || (variant === 'correct' ? 'Correct' : 'Result')}>
      <div style={styles.card}>
        <div style={styles.head}>
          <div style={styles.title}>{title || (variant === 'correct' ? 'Correct!' : 'Try Again')}</div>
          <button onClick={onClose} style={styles.btn} aria-label="Close">✕</button>
        </div>

        <div style={styles.body}>
          {statement ? <div style={styles.stmt}>{statement}</div> : null}
          {mediaUrl ? (
            isVideo ? (
              <video src={mediaUrl} style={styles.media} controls playsInline autoPlay />
            ) : isImage ? (
              <img src={mediaUrl} alt="" style={{ ...styles.media, objectFit: 'contain', maxHeight: 420 }} />
            ) : (
              <a href={mediaUrl} target="_blank" rel="noreferrer" style={{ color: '#9fb0bf' }}>Open media</a>
            )
          ) : null}
        </div>

        <div style={styles.foot}>
          {remaining > 0 ? (
            <span style={styles.chip}>Auto‑closing in {remaining}s</span>
          ) : (
            <button style={styles.btn} onClick={onClose}>{buttonText || 'OK'}</button>
          )}
        </div>
      </div>
    </div>
  );
}
