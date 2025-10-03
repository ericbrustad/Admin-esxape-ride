// components/MonetizationTab.jsx
import React from 'react';
import { useUndo } from './UndoProvider';

export default function MonetizationTab() {
  const { draft, mutateDraft } = useUndo();
  const m = draft.monetization || {};
  const set = (patch) => mutateDraft(d => ({ ...d, monetization: { ...d.monetization, ...patch }}));

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div>
        <label className="text-sm">Plan</label>
        <select className="mt-1 w-full border rounded-xl px-3 py-2" value={m.plan || 'one_time'} onChange={e=>set({plan:e.target.value})}>
          <option value="one_time">One-time</option>
          <option value="subscription_monthly">Subscription (Monthly)</option>
          <option value="subscription_yearly">Subscription (Yearly)</option>
        </select>
      </div>
      <div>
        <label className="text-sm">Price (USD)</label>
        <input className="mt-1 w-full border rounded-xl px-3 py-2" type="number" step="0.01" value={m.priceUSD ?? 9.99} onChange={e=>set({priceUSD:Number(e.target.value)})} />
      </div>
      <div>
        <label className="text-sm">Stripe Price ID</label>
        <input className="mt-1 w-full border rounded-xl px-3 py-2" value={m.stripePriceId || ''} onChange={e=>set({stripePriceId:e.target.value})} placeholder="price_123..." />
      </div>
      <p className="text-xs text-gray-500 md:col-span-3">Schema ready; wire to checkout later.</p>
    </div>
  );
}
