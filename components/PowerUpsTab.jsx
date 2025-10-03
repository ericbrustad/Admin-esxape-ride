// components/PowerUpsTab.jsx
import React from 'react';
import { useUndo } from './UndoProvider';

export default function PowerUpsTab() {
  const { draft, mutateDraft } = useUndo();
  const items = draft.powerUps || [];

  const add = () => mutateDraft(d => ({ ...d, powerUps: [...(d.powerUps||[]), { key: '', label: '', durationSec: 30, radiusMeters: 50, meta:{} }] }));
  const del = (i) => mutateDraft(d => ({ ...d, powerUps: items.filter((_, idx) => idx !== i) }));
  const set = (i, patch) => mutateDraft(d => ({ ...d, powerUps: items.map((it, idx) => idx===i ? { ...it, ...patch } : it) }));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Power‑Ups</h3>
        <button className="px-3 py-2 rounded-xl bg-black text-white" onClick={add}>Add Power‑Up</button>
      </div>
      {items.length===0 && <p className="text-sm text-gray-500">No power‑ups yet.</p>}
      <div className="grid gap-4">
        {items.map((it, i) => (
          <div key={i} className="rounded-2xl border p-4 grid md:grid-cols-5 gap-3">
            <input className="border rounded-xl px-3 py-2" placeholder="key (e.g., signal_jammer)" value={it.key} onChange={e=>set(i,{key:e.target.value.trim()})} />
            <input className="border rounded-xl px-3 py-2" placeholder="Label" value={it.label} onChange={e=>set(i,{label:e.target.value})} />
            <input className="border rounded-xl px-3 py-2" type="number" placeholder="Duration (sec)" value={it.durationSec} onChange={e=>set(i,{durationSec:Number(e.target.value)})} />
            <input className="border rounded-xl px-3 py-2" type="number" placeholder="Radius (m)" value={it.radiusMeters} onChange={e=>set(i,{radiusMeters:Number(e.target.value)})} />
            <button className="px-3 py-2 rounded-xl bg-gray-100" onClick={()=>del(i)}>Delete</button>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">Game client can read these and implement behavior per <code>key</code>.</p>
    </div>
  );
}
