import { supaService } from '../../../lib/supabase/server.js';

const TABLE = 'game_backpack_drops';

function supabaseReady() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function sanitizeSlug(value) {
  return String(value || '').trim().toLowerCase();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ ok: false, error: `Method ${req.method} Not Allowed` });
  }

  const slug = sanitizeSlug(req.query.slug);
  if (!slug) {
    return res.status(400).json({ ok: false, error: 'Missing slug' });
  }

  if (!supabaseReady()) {
    return res.status(200).json({ ok: false, reason: 'supabase-disabled', items: [] });
  }

  try {
    const service = supaService();
    const { data, error } = await service.from(TABLE).select('*', {
      filters: { slug },
      order: { column: 'dropped_at', ascending: false },
      limit: 200,
    });
    if (error) {
      return res.status(500).json({ ok: false, error: error.message || 'Supabase select failed' });
    }
    const items = Array.isArray(data)
      ? data.map((row) => ({
          id: row.id,
          slug: row.slug,
          pocket: row.pocket || '',
          item: row.item || null,
          lat: row.lat,
          lng: row.lng,
          accuracy: row.accuracy,
          droppedAt: row.dropped_at || row.created_at || null,
        }))
      : [];
    return res.status(200).json({ ok: true, items });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Supabase error' });
  }
}
