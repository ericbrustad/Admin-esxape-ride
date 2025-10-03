// components/NotificationsTab.jsx
import React, { useRef, useState } from 'react';
import { useUndo } from './UndoProvider';

export default function NotificationsTab() {
  const { draft, mutateDraft } = useUndo();
  const cfg = draft.notifications || {};
  const audioRef = useRef();
  const [custom, setCustom] = useState('');

  const set = (patch) => mutateDraft(d => ({ ...d, notifications: { ...d.notifications, ...patch }}));

  const play = () => { try { audioRef.current?.play(); } catch(_){} };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm">Warn at minutes left</label>
        <input className="mt-1 border rounded-xl px-3 py-2" type="number" value={cfg.warnAtMinutesLeft ?? 10} onChange={e=>set({warnAtMinutesLeft:Number(e.target.value)})} />
      </div>
      <div className="space-y-2">
        <label className="text-sm">Alarm sound</label>
        <div className="flex gap-3 flex-wrap">
          {['/sounds/alarm_1.mp3','/sounds/alarm_2.mp3', cfg.alarmSound].filter(Boolean).map((p,i)=>(
            <button key={i} className={`px-3 py-2 rounded-xl border ${cfg.alarmSound===p?'bg-black text-white':''}`} onClick={()=>set({alarmSound:p})}>{p.split('/').pop()}</button>
          ))}
          <label className="px-3 py-2 rounded-xl border cursor-pointer">
            Upload
            <input type="file" accept="audio/*" className="hidden" onChange={async (e)=>{
              const f = e.target.files?.[0]; if (!f) return;
              const url = URL.createObjectURL(f);
              set({ alarmSound: url });
            }} />
          </label>
          <button className="px-3 py-2 rounded-xl bg-gray-100" onClick={play}>Preview</button>
          <audio ref={audioRef} src={cfg.alarmSound} />
        </div>
      </div>
      <p className="text-xs text-gray-500">These settings are read by the game client to play a warning and final alarm.</p>
    </div>
  );
}
