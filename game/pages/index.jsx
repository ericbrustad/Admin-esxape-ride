import React, { useEffect, useRef } from 'react';

/**
 * OutcomeModal — shows mission.onCorrect / mission.onWrong objects
 * Props:
 *   - open (bool)
 *   - outcome: { statement, mediaUrl, audioUrl, durationSeconds, buttonText }
 *   - onClose()
 * Behavior:
 *   - If durationSeconds > 0, auto-closes after that many seconds.
 *   - If buttonText present (default 'OK'), show a button to close.
 *   - Plays optional audio once on open.
 */
export default function OutcomeModal({ open, outcome, onClose }) {
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const o = outcome || {};

  useEffect(() => {
    if (!open) return;
    // Play audio if available
    if (o.audioUrl && audioRef.current) {
      try { audioRef.current.currentTime = 0; audioRef.current.play().catch(()=>{}); } catch {}
    }
    // Auto-close
    if (o.durationSeconds && Number(o.durationSeconds) > 0) {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { onClose && onClose(); }, Number(o.durationSeconds) * 1000);
    }
    return () => { clearTimeout(timerRef.current); };
  }, [open, o.audioUrl, o.durationSeconds, onClose]);

  if (!open) return null;

  const mediaUrl = o.mediaUrl || '';
  const isVideo = /\.(mp4|webm|mov)(\?|#|$)/i.test(mediaUrl);
  const isImage = /\.(png|jpg|jpeg|gif|webp)(\?|#|$)/i.test(mediaUrl);

  return (
    <div style={wrap} role="dialog" aria-modal="true">
      <div style={panel}>
        <div style={{ marginBottom: 8, whiteSpace: 'pre-wrap' }}>{o.statement || ''}</div>

        {mediaUrl && (
          <div style={{ marginBottom: 10 }}>
            {isVideo ? (
              <video src={mediaUrl} controls style={{ width: '100%', borderRadius: 10 }} />
            ) : isImage ? (
              <img src={mediaUrl} alt="outcome" style={{ width: '100%', borderRadius: 10 }} />
            ) : (
              <a href={mediaUrl} target="_blank" rel="noreferrer" style={{ color: '#9fb0bf' }}>Open media</a>
            )}
          </div>
        )}

        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          {(!o.durationSeconds || Number(o.durationSeconds) === 0) && (
            <button style={btn} onClick={() => onClose && onClose()}>{o.buttonText || 'OK'}</button>
          )}
        </div>

        {o.audioUrl && <audio ref={audioRef} src={o.audioUrl} />}
      </div>
    </div>
  );
}

const wrap  = { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'grid', placeItems:'center', zIndex:9999, padding:16 };
const panel = { background:'#11161a', border:'1px solid #1f2329', borderRadius:12, padding:12, width:'min(560px, 96vw)' };
const btn   = { padding:'10px 14px', borderRadius:10, border:'1px solid #2a323b', background:'#1a2027', color:'#e9eef2', cursor:'pointer' };
