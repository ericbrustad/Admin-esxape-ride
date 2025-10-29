import React, { useEffect } from 'react';

/**
 * Hides legacy top-left Draft/Published toggle buttons without altering
 * the rest of the UI. Runs on mount in the browser only.
 */
export default function HideLegacyStatusToggles() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    try {
      const candidates = Array.from(document.querySelectorAll('button, [role="button"]'));
      for (const el of candidates) {
        const text = (el.textContent || '').trim().toLowerCase();
        if (!text) continue;
        const rect = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
        const nearTop = rect ? rect.top >= 0 && rect.top < 140 : false;
        if (nearTop && (text === 'draft' || text === 'published')) {
          el.style.display = 'none';
          el.setAttribute('data-hidden-by', 'HideLegacyStatusToggles');
        }
      }
    } catch (error) {
      console.warn('HideLegacyStatusToggles failed', error);
    }
  }, []);

  return null;
}
