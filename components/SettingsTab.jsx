// components/SettingsTab.jsx
import React, { useState } from 'react';
import { useUndo } from './UndoProvider';
import { getUserEmail, setUserEmail } from '../lib/identity';

export default function SettingsTab() {
  const { draft, mutateDraft } = useUndo();
  const roles = draft.roles || { ownerEmails: [], editorEmails: [], viewerEmails: [] };

  const [adminEmail, setAdminEmail] = useState(() => getUserEmail() || '');
  const [owners, setOwners] = useState((roles.ownerEmails||[]).join(', '));
  const [editors, setEditors] = useState((roles.editorEmails||[]).join(', '));
  const [viewers, setViewers] = useState((roles.viewerEmails||[]).join(', '));

  const parseList = (s) => s.split(',').map(e => e.trim()).filter(Boolean);

  const saveAll = () => {
    if (adminEmail) setUserEmail(adminEmail);
    mutateDraft(d => ({
      ...d,
      roles: {
        ownerEmails: parseList(owners),
        editorEmails: parseList(editors),
        viewerEmails: parseList(viewers)
      }
    }));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border p-4 space-y-3">
        <h3 className="text-lg font-semibold">Admin Identity</h3>
        <p className="text-sm text-gray-600">Stored locally; used for role checks.</p>
        <input className="w-full border rounded-xl px-3 py-2" placeholder="you@example.com" value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} />
      </div>

      <div className="rounded-2xl border p-4 space-y-3">
        <h3 className="text-lg font-semibold">Roles & Access</h3>
        <label className="text-sm">Owners (comma-separated emails)</label>
        <input className="w-full border rounded-xl px-3 py-2" placeholder="owner1@example.com, owner2@example.com" value={owners} onChange={e=>setOwners(e.target.value)} />
        <label className="text-sm">Editors (comma-separated emails)</label>
        <input className="w-full border rounded-xl px-3 py-2" placeholder="editor1@example.com" value={editors} onChange={e=>setEditors(e.target.value)} />
        <label className="text-sm">Viewers (comma-separated emails)</label>
        <input className="w-full border rounded-xl px-3 py-2" placeholder="viewer1@example.com" value={viewers} onChange={e=>setViewers(e.target.value)} />

        <div className="flex justify-end">
          <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={saveAll}>Save Settings</button>
        </div>
        <p className="text-xs text-gray-500">No code edits required; adjust here anytime.</p>
      </div>
    </div>
  );
}
