// pages/index.jsx
import React from 'react';
import { UndoProvider, useUndo } from '../components/UndoProvider';
import useAutosave from '../components/useAutosave';
import ImportExportPanel from '../components/ImportExportPanel';
import PowerUpsTab from '../components/PowerUpsTab';
import ScoringSettingsTab from '../components/ScoringSettingsTab';
import NotificationsTab from '../components/NotificationsTab';
import MonetizationTab from '../components/MonetizationTab';
import ConfirmDialog from '../components/ConfirmDialog';
import PreviewPane from '../components/PreviewPane';
import RolesGate from '../components/RolesGate';
import SettingsTab from '../components/SettingsTab';
import FirstRunModal from '../components/FirstRunModal';
import { defaultGame } from '../lib/schema';
import { getUserEmail } from '../lib/identity';

function TopBar() {
  const { draft, undo, publish, discardDraft } = useUndo();
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  useAutosave(draft);

  return (
    <div className="flex items-center justify-between gap-3 p-3 border-b">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Admin</h1>
        <span className="text-xs text-gray-500">Draft: {draft?.title || ''}</span>
      </div>
      <div className="flex items-center gap-2">
        <button className="px-3 py-2 rounded-xl bg-gray-100" onClick={undo}>Undo</button>
        <button className="px-3 py-2 rounded-xl bg-gray-100" onClick={()=>setConfirmDiscard(true)}>Discard Draft</button>
        <button className="px-3 py-2 rounded-xl bg-black text-white" onClick={async()=>{ setPublishing(true); await publish(); setPublishing(false); }}>Publish</button>
      </div>
      <ConfirmDialog open={confirmDiscard} title="Discard draft?" message="Revert all unsaved changes back to last published state." onCancel={()=>setConfirmDiscard(false)} onConfirm={()=>{ discardDraft(); setConfirmDiscard(false); }} />
      <ConfirmDialog open={publishing} title="Publishing..." message="Saving current draft as published." onCancel={()=>{}} onConfirm={()=>{}} />
    </div>
  );
}

function Tabs() {
  const { draft, mutateDraft } = useUndo();
  const [tab, setTab] = React.useState('missions');

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('game', draft.id);
    window.history.replaceState({}, '', url.toString());
  }, [draft?.id]);

  return (
    <div className="p-4 space-y-6">
      <div className="rounded-2xl border p-4 flex flex-wrap gap-3 items-center">
        <span className="text-sm text-gray-500">[Games Dropdown here] [New Game modal button]</span>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-4">
          <label className="text-sm">Game Title</label>
          <input className="mt-1 w-full border rounded-xl px-3 py-2" value={draft.title||''} onChange={e=>mutateDraft(d=>({...d,title:e.target.value}))} />
        </div>
        <div className="rounded-2xl border p-4">
          <label className="text-sm">Game Duration (minutes, 0 = infinite)</label>
          <input className="mt-1 w-full border rounded-xl px-3 py-2" type="number" value={draft.durationMinutes ?? 0} onChange={e=>mutateDraft(d=>({...d,durationMinutes:Number(e.target.value)}))} />
          <p className="text-xs text-gray-500 mt-2">Timer behavior in game client; admin configures the value here.</p>
        </div>
        <div className="rounded-2xl border p-4">
          <label className="text-sm">Tags / Slug (for GitHub saves)</label>
          <input className="mt-1 w-full border rounded-xl px-3 py-2" placeholder="slug-or-tag" onChange={e=>mutateDraft(d=>({...d, slug: e.target.value?.trim()}))} />
          <p className="text-xs text-gray-500 mt-2">Use this to produce slug-aware save paths.</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['missions','powerups','scoring','notifications','monetization','import_export','settings','preview'].map(t => (
          <button key={t} className={`px-3 py-2 rounded-xl border ${tab===t?'bg-black text-white':''}`} onClick={()=>setTab(t)}>{t.replace('_',' ')}</button>
        ))}
      </div>

      {tab==='missions' && (
        <div className="rounded-2xl border p-4 space-y-4">
          <div className="text-sm text-gray-500">[Your existing Missions editor mounts here: MCQ A–E + radio correct, Short, Statement, geofence toggles, AR toggle + MapPicker, media preview normalization, etc.]</div>
          <button className="px-3 py-2 rounded-xl bg-gray-100" onClick={()=>{
            const sample = {
              id: Math.random().toString(36).slice(2),
              type: 'mcq',
              title: 'Sample MCQ',
              prompt: 'Which option is correct?',
              choices: ['A','B','C','D','E'],
              correctIndex: 0,
              geofence: { lat: 44.98, lng: -93.27, radius: 50 },
              mediaUrl: ''
            };
            mutateDraft(d => ({ ...d, missions: [...(d.missions||[]), sample] }));
          }}>Add Sample Mission</button>
        </div>
      )}

      {tab==='powerups' && <PowerUpsTab />}
      {tab==='scoring' && <ScoringSettingsTab />}
      {tab==='notifications' && <NotificationsTab />}
      {tab==='monetization' && <MonetizationTab />}
      {tab==='import_export' && <ImportExportPanel />}
      {tab==='settings' && <SettingsTab />}
      {tab==='preview' && (
        <PreviewPane mission={(draft.missions||[])[0]} game={draft} />
      )}

      <div className="rounded-2xl border p-4">
        <span className="text-sm text-gray-500">[Settings → Splash Mode (single/head2head/multi) goes here]</span>
      </div>
    </div>
  );
}

function AppShell() {
  const userEmail = getUserEmail();
  const { draft } = useUndo();
  const roles = draft?.roles || { ownerEmails: [], editorEmails: [], viewerEmails: [] };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <FirstRunModal />
      <RolesGate userEmail={userEmail} roles={roles} need="viewer" fallback={<div className="p-6 text-sm text-gray-600">Sign in to view admin (enter your email in Settings).</div>}>
        <TopBar />
        <Tabs />
      </RolesGate>
    </div>
  );
}

export default function AdminPage() {
  return (
    <UndoProvider initialDraft={defaultGame()}>
      <AppShell />
    </UndoProvider>
  );
}
