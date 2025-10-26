import { listBuckets, listFiles } from "../../lib/supabaseHttp";

export default async function handler(req, res) {
  const bucket = String(req.query.bucket || "").trim();
  let prefix = String(req.query.prefix || "").trim();
  if (prefix && !prefix.endsWith("/")) prefix += "/";

  if (!bucket) {
    const { data, error } = await listBuckets();
    return res.status(200).json({
      ok: false,
      error: "Missing ?bucket= parameter.",
      files: [],
      available: (data || []).map((b) => b.name),
      bucketsError: error ?? null,
    });
  }

  try {
    const { data: buckets, error: lbErr } = await listBuckets();
    if (lbErr) {
      return res.status(200).json({ ok: false, error: lbErr, files: [] });
    }
    const exists = (buckets || []).some((b) => b.name === bucket);
    if (!exists) {
      return res.status(200).json({
        ok: false,
        error: `Bucket '${bucket}' not found`,
        available: (buckets || []).map((b) => b.name),
        files: [],
      });
    }

    const { data, error } = await listFiles(bucket, prefix || "", 1000, { column: "name", order: "asc" });
    if (error) return res.status(200).json({ ok: false, error, files: [] });
    const files = (data || []).map((f) => ({
      name: f.name,
      id: f.id ?? null,
      updated_at: f.updated_at ?? null,
      created_at: f.created_at ?? null,
      metadata: f.metadata ?? null,
    }));
    return res.status(200).json({ ok: true, bucket, prefix: prefix || "", files });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e?.message || String(e), files: [] });
  }
}
