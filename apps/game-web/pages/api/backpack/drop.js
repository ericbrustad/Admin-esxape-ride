import { randomUUID } from 'crypto';
import { supaService } from '../../../../lib/supabase/server.js';

const TABLE = 'game_backpack_drops';

function supabaseReady() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function sanitizeSlug(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, error: `Method ${req.method} Not Allowed` });
  }

  const { slug: rawSlug, pocket = '', item = null, location = null } = req.body || {};
  const slug = sanitizeSlug(rawSlug);
  if (!slug || !item || typeof item !== 'object') {
    return res.status(400).json({ ok: false, error: 'Missing slug or item' });
  }

  const entry = {
    id: typeof randomUUID === 'function' ? randomUUID() : `drop_${Date.now()}`,
    slug,
    pocket: String(pocket || ''),
    item,
    lat: normalizeNumber(location?.lat),
    lng: normalizeNumber(location?.lng),
    accuracy: normalizeNumber(location?.accuracy),
    dropped_at: new Date().toISOString(),
  };

  if (!supabaseReady()) {
    return res.status(200).json({ ok: false, reason: 'supabase-disabled', entry });
  }

  try {
    const service = supaService();
    const { error } = await service.from(TABLE).insert(entry);
    if (error) {
      return res.status(500).json({ ok: false, error: error.message || 'Supabase insert failed', entry });
    }
    return res.status(200).json({ ok: true, entry });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Supabase error', entry });
  }
}
