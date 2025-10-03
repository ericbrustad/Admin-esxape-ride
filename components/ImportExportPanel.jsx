// components/ImportExportPanel.jsx
import React, { useRef, useState } from 'react';
import { useUndo } from './UndoProvider';

export default function ImportExportPanel() {
  const { draft, mutateDraft } = useUndo();
  const inputRef = useRef();
  const [err, setErr] = useState('');

  const onExport = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'missions.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (e) => {
    setErr('');
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!json?.missions || !Array.isArray(json.missions)) throw new Error('Invalid: missions array missing');
      mutateDraft(() => json);
    } catch (ex) { setErr(ex.message); }
    finally { if (inputRef.current) inputRef.current.value = ''; }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={onExport}>Export JSON</button>
        <button className="px-4 py-2 rounded-xl bg-gray-100" onClick={() => inputRef.current?.click()}>Import JSON</button>
        <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={onImport} />
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <p className="text-xs text-gray-500">Tip: Export often before big edits.</p>
    </div>
  );
}
