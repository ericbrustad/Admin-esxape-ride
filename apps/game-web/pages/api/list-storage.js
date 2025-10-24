import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      return res.status(500).json({ ok: false, error: 'Missing SUPABASE env vars' });
    }

    const supabase = createClient(url, key);

    const bucket = (req.query.bucket || 'media').toString();
    const prefix = (req.query.prefix || '').toString().replace(/^\/+|\/+$/g, '');
    const limit = Number(req.query.limit) || 1000;
    const recursive = (req.query.recursive || req.query.tree) === '1';

    // Validate bucket name first
    const { data: buckets, error: bucketsErr } = await supabase.storage.listBuckets();
    if (bucketsErr) {
      return res.status(500).json({ ok: false, error: bucketsErr.message });
    }
    const names = (buckets || []).map(b => b.name);
    if (!names.includes(bucket)) {
      return res.status(404).json({ ok: false, error: `Bucket '${bucket}' not found`, available: names });
    }

    async function listDir(dir) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(dir || '', { limit, sortBy: { column: 'name', order: 'asc' } });
      if (error) throw error;

      if (!recursive) {
        return (data || []).map(it => ({ ...it, path: (dir ? dir + '/' : '') + it.name }));
      }

      const out = [];
      for (const it of data || []) {
        const path = (dir ? dir + '/' : '') + it.name;
        out.push({ ...it, path });
        // Folders have no metadata
        if (!it.metadata) {
          const kids = await listDir(path);
          out.push(...kids);
        }
      }
      return out;
    }

    const files = await listDir(prefix);
    return res.status(200).json({ ok: true, bucket, prefix, count: files.length, files });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
