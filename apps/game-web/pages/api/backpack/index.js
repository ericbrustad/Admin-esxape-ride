import { supaService } from '../../../lib/supabase/server.js';

const TABLE = 'game_backpacks';

function supabaseReady() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function sanitizeSlug(value) {
  return String(value || '').trim().toLowerCase();
}

export default async function handler(req, res) {
  const { method } = req;
  if (method === 'GET') {
    const slug = sanitizeSlug(req.query.slug);
    if (!slug) {
      return res.status(400).json({ ok: false, error: 'Missing slug' });
    }
    if (!supabaseReady()) {
      return res.status(200).json({ ok: false, reason: 'supabase-disabled' });
    }
    try {
      const service = supaService();
      const { data, error } = await service.from(TABLE).select('*', { filters: { slug }, single: true });
      if (error) {
        return res.status(500).json({ ok: false, error: error.message || 'Supabase select failed' });
      }
      const state = data?.state || null;
      return res.status(200).json({ ok: true, state, updatedAt: data?.updated_at || null });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message || 'Supabase error' });
    }
  }

  if (method === 'PUT') {
    const { slug: rawSlug, state } = req.body || {};
    const slug = sanitizeSlug(rawSlug);
    if (!slug || typeof state !== 'object') {
      return res.status(400).json({ ok: false, error: 'Missing slug or state' });
    }
    if (!supabaseReady()) {
      return res.status(200).json({ ok: false, reason: 'supabase-disabled' });
    }
    try {
      const service = supaService();
      const payload = {
        slug,
        state,
        updated_at: new Date().toISOString(),
      };
      const { error } = await service.from(TABLE).upsert(payload);
      if (error) {
        return res.status(500).json({ ok: false, error: error.message || 'Supabase upsert failed' });
      }
      return res.status(200).json({ ok: true });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message || 'Supabase error' });
    }
  }

  res.setHeader('Allow', ['GET', 'PUT']);
  return res.status(405).json({ ok: false, error: `Method ${method} Not Allowed` });
}
