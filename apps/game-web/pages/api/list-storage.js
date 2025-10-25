import { createClient } from '../../lib/supabase-lite.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const url = process.env.SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anon = process.env.SUPABASE_ANON_KEY;
    if (!url || (!service && !anon)) {
      return res.status(500).json({ ok: false, error: 'Missing SUPABASE env vars' });
    }

    const key = service || anon;
    const keyType = service ? 'service' : 'anon';
    const projectRef = new URL(url).hostname.split('.')[0];
    const supabase = createClient(url, key);

    if ((req.query.action || '') === 'status') {
      const { data, error } = await supabase.storage.listBuckets?.();
      return res.status(200).json({
        ok: !error,
        projectRef,
        keyType,
        buckets: data ?? null,
        error: error?.message ?? null,
      });
    }

    const bucket = (req.query.bucket || 'media').toString();
    const prefix = (req.query.prefix || '').toString().replace(/^\/+|\/+$/g, '');
    const limit = Number(req.query.limit) || 1000;

    // Validate bucket (best-effort)
    const { data: buckets, error: bucketsErr } = await supabase.storage.listBuckets?.();
    if (bucketsErr) {
      // If listBuckets isn’t allowed (anon) we’ll skip validation and try to list files anyway
      console.warn('listBuckets error:', bucketsErr.message);
    } else if (buckets && !buckets.map(b => b.name).includes(bucket)) {
      return res.status(404).json({ ok: false, error: `Bucket '${bucket}' not found`, available: buckets.map(b => b.name) });
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix || '', { limit, sortBy: { column: 'name', order: 'asc' } });

    if (error) return res.status(500).json({ ok: false, error: error.message, bucket, prefix });
    return res.status(200).json({ ok: true, projectRef, keyType, bucket, prefix, count: (data || []).length, files: data || [] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
