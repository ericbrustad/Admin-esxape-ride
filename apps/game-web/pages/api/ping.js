import { envSummary, getProjectRef, listBuckets } from "../../lib/supabaseHttp";

export default async function handler(_req, res) {
  const out = {
    ok: true,
    time: new Date().toISOString(),
    env: {
      ...envSummary(),
      hasAnonKey: !!process.env.SUPABASE_ANON_KEY || !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
    projectRef: getProjectRef(),
    buckets: [],
    storageError: null,
  };
  try {
    const { data, error } = await listBuckets();
    if (error) {
      out.ok = false;
      out.storageError = error;
    } else {
      out.buckets = (data || []).map((b) => b.name);
    }
  } catch (e) {
    out.ok = false;
    out.storageError = e?.message || String(e);
  }
  res.status(200).json(out);
}
