import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

// Server-side client (service key stays on the server only)
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!supabase) {
    return res.status(500).json({
      ok: false,
      error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    });
  }

  const bucket = (req.query.bucket || 'media').toString();
  const prefix = (req.query.prefix || '').toString();

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

    if (error) {
      return res.status(200).json({
        ok: false,
        bucket,
        prefix,
        error: error.message,
      });
    }

    return res.status(200).json({
      ok: true,
      bucket,
      prefix,
      files: data || [],
    });
  } catch (e) {
    return res.status(200).json({
      ok: false,
      bucket,
      prefix,
      error: e?.message || 'Unknown error',
    });
  }
}

