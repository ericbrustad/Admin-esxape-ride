const getSupabaseUrl = () =>
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const getServiceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function authHeaders(key) {
  return {
    Authorization: `Bearer ${key}`,
    apikey: key,
    "Content-Type": "application/json",
  };
}

export function getProjectRef() {
  const url = getSupabaseUrl();
  const m = url.match(/https?:\/\/([a-zA-Z0-9-]+)\.supabase\.co/);
  return m ? m[1] : null;
}

export async function listBuckets() {
  const url = getSupabaseUrl();
  const key = getServiceKey();
  if (!url || !key) {
    return { data: null, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" };
  }
  const r = await fetch(`${url}/storage/v1/buckets`, { headers: authHeaders(key) });
  if (!r.ok) return { data: null, error: (await r.text()) || r.statusText };
  return { data: await r.json(), error: null };
}

export async function listFiles(bucket, prefix = "", limit = 1000, sortBy = { column: "name", order: "asc" }) {
  const url = getSupabaseUrl();
  const key = getServiceKey();
  if (!url || !key) {
    return { data: null, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" };
  }
  const body = { prefix, limit, sortBy };
  const r = await fetch(`${url}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
    method: "POST",
    headers: authHeaders(key),
    body: JSON.stringify(body),
  });
  if (!r.ok) return { data: null, error: (await r.text()) || r.statusText };
  // Returns an array of objects with fields like: name, id, updated_at, created_at, metadata, etc.
  return { data: await r.json(), error: null };
}

export function envSummary() {
  return {
    hasUrl: !!getSupabaseUrl(),
    hasServiceKey: !!getServiceKey(),
  };
}

export function getDefaults() {
  return {
    bucket: process.env.NEXT_PUBLIC_SUPABASE_MEDIA_BUCKET || process.env.SUPABASE_MEDIA_BUCKET || "game-media",
    prefix: process.env.NEXT_PUBLIC_SUPABASE_MEDIA_PREFIX || process.env.SUPABASE_MEDIA_PREFIX || "",
  };
}
