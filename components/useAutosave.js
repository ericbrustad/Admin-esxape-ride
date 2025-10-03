// components/useAutosave.js
import { useEffect, useRef } from 'react';
import { save, KEYS } from '../lib/storage';

export default function useAutosave(draft, { delay = 1200 } = {}) {
  const t = useRef();
  useEffect(() => {
    clearTimeout(t.current);
    t.current = setTimeout(() => {
      save(KEYS.DRAFT, draft);
    }, delay);
    return () => clearTimeout(t.current);
  }, [draft, delay]);
}
