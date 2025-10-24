// for apps/game-web/pages/api/list-storage.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not fucking allowed' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    // Use SERVICE_ROLE here because this is server-side only.
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const bucket = (req.query.bucket || 'media').toString();
  const prefix = (req.query.prefix || '').toString();

  const { data, error } = await supabase.storage
    .from(bucket)
    .list(prefix, {
      limit: Number(req.query.limit) || 100,
      sortBy: { column: 'name', order: 'asc' },
    });

  if (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
  return res.status(200).json({ ok: true, bucket, prefix, files: data ?? [] });
}
