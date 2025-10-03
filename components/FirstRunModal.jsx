// components/FirstRunModal.jsx
import React, { useState } from 'react';
import { getUserEmail, setUserEmail } from '../lib/identity';

export default function FirstRunModal() {
  const [email, setEmail] = useState(getUserEmail() || '');
  const [open, setOpen] = useState(!getUserEmail());

  if (!open) return null;
  const save = () => {
    if (email && email.includes('@')) {
      setUserEmail(email);
      setOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-2">Welcome</h2>
        <p className="text-sm text-gray-600 mb-4">Enter your email to unlock owner controls (change later in Settings).</p>
        <input className="w-full border rounded-xl px-3 py-2 mb-4" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
        <div className="flex justify-end gap-3">
          <button className="px-4 py-2 rounded-xl bg-gray-100" onClick={()=>setOpen(false)}>Skip</button>
          <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
