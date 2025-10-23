import { createClient } from '@supabase/supabase-js';

/** Browser (anon) client */
export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

/** Server (service role) client for API routes ONLY */
export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase URL or service role key missing');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export function publicUrl(bucket, path) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${url}/storage/v1/object/public/${bucket}/${path}`;
}

/** Upload a data:URL to storage (server-side) */
export async function uploadDataUrl(svc, bucket, path, dataUrl, contentType) {
  const comma = dataUrl.indexOf(',');
  const base64 = dataUrl.slice(comma + 1);
  const buffer = Buffer.from(base64, 'base64');
  const { data, error } = await svc.storage.from(bucket).upload(path, buffer, {
    contentType: contentType || 'application/octet-stream',
    upsert: true,
  });
  if (error) throw error;
  return data;
}
