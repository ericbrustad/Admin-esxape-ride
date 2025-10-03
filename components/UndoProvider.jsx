// components/UndoProvider.jsx
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { KEYS, load, save, pushUndo, popUndo, clearUndo } from '../lib/storage';

const UndoCtx = createContext();

export function UndoProvider({ initialDraft, children }) {
  const [draft, setDraft] = useState(() => load(KEYS.DRAFT, initialDraft));
  const [published, setPublished] = useState(() => load(KEYS.PUBLISHED, initialDraft));

  const mutateDraft = useCallback((fn) => {
    pushUndo(draft);
    const next = fn(draft);
    setDraft(next);
    save(KEYS.DRAFT, next);
  }, [draft]);

  const undo = useCallback(() => {
    const prev = popUndo();
    if (prev) { setDraft(prev); save(KEYS.DRAFT, prev); }
  }, []);

  const discardDraft = useCallback(() => {
    setDraft(published);
    save(KEYS.DRAFT, published);
    clearUndo();
  }, [published]);

  const publish = useCallback(async () => {
    setPublished(draft);
    save(KEYS.PUBLISHED, draft);
    // TODO: call your GitHub/API persist here if desired
    return true;
  }, [draft]);

  const value = useMemo(() => ({ draft, setDraft, published, mutateDraft, undo, publish, discardDraft }), [draft, published, mutateDraft, undo, publish, discardDraft]);

  return <UndoCtx.Provider value={value}>{children}</UndoCtx.Provider>;
}

export function useUndo() { return useContext(UndoCtx); }
