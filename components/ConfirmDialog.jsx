// components/ConfirmDialog.jsx
import React from 'react';

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button className="px-4 py-2 rounded-xl bg-gray-100" onClick={onCancel}>Cancel</button>
          <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
