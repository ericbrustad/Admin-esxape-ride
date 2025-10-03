// pages/index.jsx
// Full replacement admin page that integrates the Admin Enhancements Pack
// and the "stable baseline" features you listed.
// - URL sync (?game, ?mission)
// - Games dropdown + New Game modal
// - Missions editor (MCQ A–E + radio correct, Short, Statement)
// - Optional geofence with MapPicker, AR toggle
// - Media previews with Dropbox/Drive normalization (video & image)
// - Geofence media types (image/video for fence events)
// - SMS rules field per mission
// - Settings with Splash Mode (single/head2head/multi)
// - Slug-aware GitHub saves (path builder + stub hook inside publish)

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

// -------- Helpers

function normalizeMediaUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    // Google Drive share links → direct-ish view
    if (u.hostname.includes('drive.google.com')) {
      // support /file/d/<id>/view?usp=sharing
      const parts = u.pathname.split('/');
      const idx = parts.indexOf('d');
      if (idx >= 0 && parts[idx+1]) {
        const id = parts[idx+1];
        return `https://drive.google.com/uc?export=download&id=${id}`;
      }
      // support open?id=<id>
      if (u.searchParams.get('id')) {
        const id = u.searchParams.get('id');
        return `https://drive.google.com/uc?export=download&id=${id}`;
      }
    }
    // Dropbox share → raw
    if (u.hostname.includes('dropbox.com')) {
      u.searchParams.set('raw', '1');
      return u.toString();
    }
    return url;
  } catch (_) {
    return url;
  }
}

function isVideo(url='') {
  return /\.(mp4|webm|mov|m4v)$/i.test(url) || url.includes('drive.google.com') || url.includes('dropbox.com');
}

function isImage(url='') {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(url);
}

// Slug-aware path builder for GitHub/API save (you wire the network call)
function buildSavePath(game) {
  const slug = (game.slug || game.title || 'game').toLowerCase().replace(/[^a-z0-9\-]+/g,'-').replace(/\-+/g,'-').replace(/^\-|\-$/g,'');
  const id = game.id;
  return `configs/${slug || 'game'}/${id}.json`;
}

// -------- UI: MapPicker (simple stub using lat/lng fields + "Use my location")

function MapPicker({ value, onChange }) {
  const { lat=44.9778, lng=-93.2650, radius=50 } = value || {};
  const set = (patch) => onChange({ ...value, ...patch });

  const useMyLocation = () => {
    if (navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition((pos)=>{
        set({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) });
      });
    }
  };

  return (
    <div className="grid md:grid-cols-3 gap-3">
      <div>
        <label className="text-sm">Latitude</label>
        <input className="mt-1 w-full border rounded-xl px-3 py-2" type="number" step="0.000001" value={lat} onChange={e=>set({lat: Number(e.target.value)})} />
      </div>
      <div>
        <label className="text-sm">Longitude</label>
        <input className="mt-1 w-full border rounded-xl px-3 py-2" type="number" step="0.000001" value={lng} onChange={e=>set({lng: Number(e.target.value)})} />
      </div>
      <div>
        <label className="text-sm">Radius (m)</label>
        <input className="mt-1 w-full border rounded-xl px-3 py-2" type="number" value={radius} onChange={e=>set({radius: Number(e.target.value)})} />
      </div>
      <div className="md:col-span-3">
        <button type="button" className="px-3 py-2 rounded-xl bg-gray-100" onClick={useMyLocation}>Use my location</button>
      </div>
      <p className="text-xs text-gray-500 md:col-span-3">Hook up a real map if you like; these fields are saved in the mission.</p>
    </div>
  );
}

// -------- UI: MediaPreview (normalizes Drive/Dropbox, renders image or video)

function MediaPreview({ url }) {
  const norm = normalizeMediaUrl(url);
  if (!norm) return <p className="text-xs text-gray-500">No media set.</p>;
  if (isVideo(norm)) return <video className="w-full rounded-xl" controls src={norm} />;
  if (isImage(norm)) return <img className="w-full rounded-xl" alt="preview" src={norm} />;
  return <a className="text-sm text-blue-600 underline" href={norm} target="_blank" rel="noreferrer">Open media</a>;
}

// -------- Missions Editor (MCQ/Short/Statement, geofence, AR toggle, SMS rules, media)

function MissionRow({ mission, onChange, onDelete, onSelect, selected }) {
  return (
    <div className={`rounded-2xl border p-3 flex items-center justify-between ${selected ? 'bg-gray-50' : ''}`}>
      <div className="flex items-center gap-3">
        <input className="border rounded-xl px-2 py-1 w-28" value={mission.title||''} onChange={e=>onChange({ ...mission, title: e.target.value })} placeholder="Title" />
        <span className="text-xs text-gray-500">{mission.type}</span>
      </div>
      <div className="flex items-center gap-2">
        <button className="px-3 py-1 rounded-xl bg-gray-100" onClick={onSelect}>Edit</button>
        <button className="px-3 py-1 rounded-xl bg-gray-100" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}

function MissionEditor({ mission, onChange }) {
  if (!mission) return <p className="text-sm text-gray-500">Select a mission to edit.</p>;

  const update = (patch) => onChange({ ...mission, ...patch });

  const setChoice = (i, val) => {
    const list = [...(mission.choices||[])];
    list[i] = val;
    update({ choices: list });
  };

  const ensureChoices = () => {
    const list = [...(mission.choices||[])];
    while (list.length < 5) list.push('');
    return list.slice(0,5);
  };

  const choices = ensureChoices();

  return (
    <div className="rounded-2xl border p-4 space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm">Title</label>
          <input className="mt-1 w-full border rounded-xl px-3 py-2" value={mission.title||''} onChange={e=>update({title:e.target.value})} />
        </div>
        <div>
          <label className="text-sm">Type</label>
          <select className="mt-1 w-full border rounded-xl px-3 py-2" value={mission.type} onChange={e=>update({type:e.target.value})}>
            <option value="mcq">Multiple Choice</option>
            <option value="short">Short Answer</option>
            <option value="statement">Statement</option>
          </select>
        </div>
      </div>

      {mission.type !== 'statement' && (
        <div>
          <label className="text-sm">Prompt</label>
          <textarea className="mt-1 w-full border rounded-xl px-3 py-2" rows={3} value={mission.prompt||''} onChange={e=>update({prompt:e.target.value})} />
        </div>
      )}

      {mission.type === 'statement' && (
        <div>
          <label className="text-sm">Statement Text</label>
          <textarea className="mt-1 w-full border rounded-xl px-3 py-2" rows={3} value={mission.text||''} onChange={e=>update({text:e.target.value})} />
        </div>
      )}

      {mission.type === 'mcq' && (
        <div className="grid md:grid-cols-2 gap-3">
          {choices.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <label className="text-sm w-5">{String.fromCharCode(65+i)}:</label>
              <input className="flex-1 border rounded-xl px-3 py-2" value={c} onChange={e=>setChoice(i, e.target.value)} placeholder={`Choice ${String.fromCharCode(65+i)}`} />
              <label className="text-xs flex items-center gap-1">
                <input type="radio" name="correct" checked={mission.correctIndex===i} onChange={()=>update({correctIndex:i})} />
                correct
              </label>
            </div>
          ))}
        </div>
      )}

      {/* Geofence & AR */}
      <div className="rounded-xl border p-3 space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={!!mission.geofence} onChange={e=>update({ geofence: e.target.checked ? (mission.geofence || { lat:44.98, lng:-93.27, radius:50 }) : null })} />
            Enable geofence
          </label>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={!!mission.arEnabled} onChange={e=>update({ arEnabled: e.target.checked })} />
            AR overlay for this mission
          </label>
        </div>

        {mission.geofence && (
          <MapPicker value={mission.geofence} onChange={(v)=>update({geofence:v})} />
        )}

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm">Fence media URL (image/video)</label>
            <input className="mt-1 w-full border rounded-xl px-3 py-2" value={mission.fenceMediaUrl||''} onChange={e=>update({fenceMediaUrl:e.target.value})} placeholder="https://..." />
            <div className="mt-2"><MediaPreview url={mission.fenceMediaUrl} /></div>
          </div>
          <div>
            <label className="text-sm">Mission media URL (image/video)</label>
            <input className="mt-1 w-full border rounded-xl px-3 py-2" value={mission.mediaUrl||''} onChange={e=>update({mediaUrl:e.target.value})} placeholder="https://..." />
            <div className="mt-2"><MediaPreview url={mission.mediaUrl} /></div>
          </div>
        </div>
      </div>

      {/* SMS Rules */}
      <div className="rounded-xl border p-3 space-y-2">
        <label className="text-sm">SMS rule (optional)</label>
        <input className="w-full border rounded-xl px-3 py-2" placeholder="e.g., send 'Hint' after 5 minutes" value={mission.smsRule || ''} onChange={e=>update({smsRule:e.target.value})} />
        <p className="text-xs text-gray-500">Wire to your SMS backend later; stored in mission for now.</p>
      </div>

    </div>
  );
}

// -------- Games dropdown + New Game modal

function NewGameModal({ open, onClose, onCreate }) {
  const [title, setTitle] = React.useState('New Game');
  const [duration, setDuration] = React.useState(0);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-2">Create Game</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm">Title</label>
            <input className="mt-1 w-full border rounded-xl px-3 py-2" value={title} onChange={e=>setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">Duration (minutes, 0 = infinite)</label>
            <input className="mt-1 w-full border rounded-xl px-3 py-2" type="number" value={duration} onChange={e=>setDuration(Number(e.target.value))} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button className="px-4 py-2 rounded-xl bg-gray-100" onClick={onClose}>Cancel</button>
          <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={()=>{ onCreate({ title, durationMinutes: duration }); onClose(); }}>Create</button>
        </div>
      </div>
    </div>
  );
}

function GamesBar() {
  const { draft, mutateDraft } = useUndo();
  const [showNew, setShowNew] = React.useState(false);
  const [games, setGames] = React.useState([draft]); // simple in-memory list for demo
  const [selectedId, setSelectedId] = React.useState(draft.id);

  React.useEffect(()=>{
    // URL ?game sync → if matches, select (demo purpose only; real app would load)
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const gid = sp.get('game');
    if (gid && gid !== selectedId) setSelectedId(gid);
  }, []);

  const addGame = (meta) => {
    const g = defaultGame();
    g.title = meta.title || g.title;
    g.durationMinutes = typeof meta.durationMinutes === 'number' ? meta.durationMinutes : g.durationMinutes;
    setGames(gs => [...gs, g]);
    setSelectedId(g.id);
    mutateDraft(() => g);
  };

  const selectGame = (id) => {
    const g = games.find(x=>x.id===id);
    if (g) mutateDraft(() => g);
    setSelectedId(id);
  };

  return (
    <div className="rounded-2xl border p-4 flex flex-wrap gap-3 items-center">
      <select className="border rounded-xl px-3 py-2" value={selectedId} onChange={e=>selectGame(e.target.value)}>
        {games.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
      </select>
      <button className="px-3 py-2 rounded-xl bg-gray-100" onClick={()=>setShowNew(true)}>New Game</button>
      <NewGameModal open={showNew} onClose={()=>setShowNew(false)} onCreate={addGame} />
      <span className="text-xs text-gray-500">URL sync active (?game={selectedId})</span>
    </div>
  );
}

// -------- Top Bar with Publish wired to path builder

function TopBar() {
  const { draft, undo, publish, discardDraft } = useUndo();
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [lastPath, setLastPath] = React.useState('');
  useAutosave(draft);

  const doPublish = async () => {
    setPublishing(true);
    const path = buildSavePath(draft);
    // TODO: replace with your actual GitHub/API save:
    // await saveToGitHub({ path, content: JSON.stringify(draft, null, 2) });
    await publish(); // persists to local 'published'
    setLastPath(path);
    setPublishing(false);
  };

  return (
    <div className="flex items-center justify-between gap-3 p-3 border-b">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Admin</h1>
        <span className="text-xs text-gray-500">Draft: {draft?.title || ''}</span>
      </div>
      <div className="flex items-center gap-2">
        <button className="px-3 py-2 rounded-xl bg-gray-100" onClick={undo}>Undo</button>
        <button className="px-3 py-2 rounded-xl bg-gray-100" onClick={()=>setConfirmDiscard(true)}>Discard Draft</button>
        <button className="px-3 py-2 rounded-xl bg-black text-white" onClick={doPublish}>Publish</button>
      </div>
      {lastPath && <span className="text-[11px] text-gray-500">Saved path: {lastPath}</span>}
      <ConfirmDialog open={confirmDiscard} title="Discard draft?" message="Revert all unsaved changes back to last published state." onCancel={()=>setConfirmDiscard(false)} onConfirm={()=>{ discardDraft(); setConfirmDiscard(false); }} />
      <ConfirmDialog open={publishing} title="Publishing..." message="Saving current draft as published." onCancel={()=>{}} onConfirm={()=>{}} />
    </div>
  );
}

// -------- Main Tabs (includes stable baseline areas)

function Tabs() {
  const { draft, mutateDraft } = useUndo();
  const [tab, setTab] = React.useState('missions');
  const [selectedMissionId, setSelectedMissionId] = React.useState(null);

  // URL sync for ?game & ?mission
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('game', draft.id);
    if (selectedMissionId) url.searchParams.set('mission', selectedMissionId);
    else url.searchParams.delete('mission');
    window.history.replaceState({}, '', url.toString());
  }, [draft?.id, selectedMissionId]);

  const missions = draft.missions || [];
  const selectedMission = missions.find(m => m.id === selectedMissionId) || null;

  const updateMission = (next) => {
    const arr = missions.map(m => m.id === next.id ? next : m);
    mutateDraft(d => ({ ...d, missions: arr }));
  };

  const addMission = (type='mcq') => {
    const m = {
      id: Math.random().toString(36).slice(2),
      type,
      title: type==='mcq' ? 'New MCQ' : type==='short' ? 'New Short' : 'New Statement',
      prompt: type==='statement' ? '' : 'Your prompt here...',
      text: type==='statement' ? 'Your statement here...' : '',
      choices: type==='mcq' ? ['A','B','C','D','E'] : [],
      correctIndex: type==='mcq' ? 0 : undefined,
      geofence: null,
      arEnabled: false,
      fenceMediaUrl: '',
      mediaUrl: '',
      smsRule: ''
    };
    mutateDraft(d => ({ ...d, missions: [...missions, m] }));
    setSelectedMissionId(m.id);
  };

  const deleteMission = (id) => {
    const arr = missions.filter(m => m.id !== id);
    mutateDraft(d => ({ ...d, missions: arr }));
    if (selectedMissionId === id) setSelectedMissionId(null);
  };

  return (
    <div className="p-4 space-y-6">
      <GamesBar />

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-4">
          <label className="text-sm">Game Title</label>
          <input className="mt-1 w-full border rounded-xl px-3 py-2" value={draft.title||''} onChange={e=>mutateDraft(d=>({...d,title:e.target.value}))} />
        </div>
        <div className="rounded-2xl border p-4">
          <label className="text-sm">Game Duration (minutes, 0 = infinite)</label>
          <input className="mt-1 w-full border rounded-xl px-3 py-2" type="number" value={draft.durationMinutes ?? 0} onChange={e=>mutateDraft(d=>({...d,durationMinutes:Number(e.target.value)}))} />
          <p className="text-xs text-gray-500 mt-2">Client shows count-up if 0, count-down otherwise with warnings from Notifications.</p>
        </div>
        <div className="rounded-2xl border p-4">
          <label className="text-sm">Tags / Slug (for GitHub saves)</label>
          <input className="mt-1 w-full border rounded-xl px-3 py-2" placeholder="slug-or-tag" onChange={e=>mutateDraft(d=>({...d, slug: e.target.value?.trim()}))} />
          <p className="text-xs text-gray-500 mt-2">Used to build the save path.</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap">
        {['missions','powerups','scoring','notifications','monetization','import_export','settings','preview'].map(t => (
          <button key={t} className={`px-3 py-2 rounded-xl border ${tab===t?'bg-black text-white':''}`} onClick={()=>setTab(t)}>{t.replace('_',' ')}</button>
        ))}
      </div>

      {/* MISSIONS TAB */}
      {tab==='missions' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex gap-2">
              <button className="px-3 py-2 rounded-xl bg-gray-100" onClick={()=>addMission('mcq')}>+ MCQ</button>
              <button className="px-3 py-2 rounded-xl bg-gray-100" onClick={()=>addMission('short')}>+ Short</button>
              <button className="px-3 py-2 rounded-xl bg-gray-100" onClick={()=>addMission('statement')}>+ Statement</button>
            </div>
            {missions.length===0 && <p className="text-sm text-gray-500">No missions yet.</p>}
            <div className="space-y-2">
              {missions.map(m => (
                <MissionRow
                  key={m.id}
                  mission={m}
                  selected={m.id===selectedMissionId}
                  onSelect={()=>setSelectedMissionId(m.id)}
                  onDelete={()=>deleteMission(m.id)}
                  onChange={(next)=>updateMission(next)}
                />
              ))}
            </div>
          </div>
          <div>
            <MissionEditor mission={selectedMission} onChange={updateMission} />
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Inline Preview</h4>
              <PreviewPane mission={selectedMission} game={draft} />
            </div>
          </div>
        </div>
      )}

      {tab==='powerups' && <PowerUpsTab />}
      {tab==='scoring' && <ScoringSettingsTab />}
      {tab==='notifications' && <NotificationsTab />}
      {tab==='monetization' && <MonetizationTab />}
      {tab==='import_export' && <ImportExportPanel />}
      {tab==='settings' && (
        <div className="grid md:grid-cols-2 gap-6">
          <SettingsTab />
          <div className="rounded-2xl border p-4 space-y-3">
            <h3 className="text-lg font-semibold">Splash Mode</h3>
            <select className="w-full border rounded-xl px-3 py-2" value={draft.splashMode || 'single'} onChange={e=>mutateDraft(d=>({...d, splashMode: e.target.value}))}>
              <option value="single">Single</option>
              <option value="head2head">Head-to-Head</option>
              <option value="multi">Multi</option>
            </select>
            <p className="text-xs text-gray-500">Game client reads this to change layout/logic.</p>
          </div>
        </div>
      )}
      {tab==='preview' && (
        <PreviewPane mission={(draft.missions||[])[0]} game={draft} />
      )}
    </div>
  );
}

// -------- App shell with Roles

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

// -------- Export page

export default function AdminPage() {
  return (
    <UndoProvider initialDraft={defaultGame()}>
      <AppShell />
    </UndoProvider>
  );
}
