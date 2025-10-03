// components/ScoringSettingsTab.jsx
import React from 'react';
import { useUndo } from './UndoProvider';

export default function ScoringSettingsTab() {
  const { draft, mutateDraft } = useUndo();
  const s = draft.scoring || {};

  const set = (patch) => mutateDraft(d => ({ ...d, scoring: { ...d.scoring, ...patch }}));

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div>
        <label className="text-sm">Points per mission</label>
        <input className="mt-1 w-full border rounded-xl px-3 py-2" type="number" value={s.pointsPerMission ?? 100} onChange={e=>set({pointsPerMission:Number(e.target.value)})} />
      </div>
      <div>
        <label className="text-sm">Penalty per fail</label>
        <input className="mt-1 w-full border rounded-xl px-3 py-2" type="number" value={s.penaltyPerFail ?? 0} onChange={e=>set({penaltyPerFail:Number(e.target.value)})} />
      </div>
      <div>
        <label className="text-sm">Difficulty multiplier</label>
        <input className="mt-1 w-full border rounded-xl px-3 py-2" type="number" step="0.1" value={s.difficultyMultiplier ?? 1} onChange={e=>set({difficultyMultiplier:Number(e.target.value)})} />
      </div>
    </div>
  );
}
