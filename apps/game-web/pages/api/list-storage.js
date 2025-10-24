import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const url = process.env.SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      return res.status(500).json({
        ok: false,
        error: 'Missing SUPABASE_URL or SERVICE_ROLE/ANON key in Preview env.',
      });
    }

    const supabase = createClient(url, key);

    // Optional: list buckets with ?action=buckets
    if ((req.query.action || '').toString() === 'buckets') {
      const { data, error } = await supabase.storage.listBuckets?.();
      if (error) return res.status(500).json({ ok: false, error: error.message });
      if (!data) return res.status(500).json({ ok: false, error: 'listBuckets not available in this supabase-js version' });
      return res.status(200).json({ ok: true, buckets: data });
    }

    const bucket = (req.query.bucket || 'media').toString(); // change if your bucket name is different
    const prefix = (req.query.prefix || '').toString();
    const limit = Number(req.query.limit) || 100;

    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit, sortBy: { column: 'name', order: 'asc' } });

    if (error) {
      return res.status(500).json({ ok: false, bucket, prefix, error: error.message });
    }
    return res.status(200).json({ ok: true, bucket, prefix, files: data ?? [] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
