/**
 * POST /api/upload
 * Body: { fileName, dataUrl, kind, tags, gameSlug }
 * Stores file in Supabase Storage (bucket: admin-media) and upserts a row in `media`.
 * NOTE: For large files, switch to signed URL flow.
 */
import { getServiceClient, publicUrl, uploadDataUrl } from '../../lib/supabase/client';
import { newId, toSlug } from '../../lib/ids';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { fileName, dataUrl, kind = 'image', tags = [], gameSlug = 'library' } = req.body || {};
    if (!fileName || !dataUrl) return res.status(400).json({ error: 'fileName and dataUrl required' });

    const svc = getServiceClient();

    const safeName = fileName.replace(/[^a-z0-9._-]/gi, '_');
    const path = `mediapool/${kind}/${safeName}`;
    await uploadDataUrl(svc, 'admin-media', path, dataUrl);

    const slug = toSlug(safeName.replace(/\.[a-z0-9]+$/i, ''));
    const url = publicUrl('admin-media', path);

    // upsert media row
    const id = newId('med');
    const { data: existing } = await svc.from('media').select('id').eq('slug', slug).maybeSingle();
    const payload = { id: existing?.id || id, slug, name: safeName, kind, bucket: 'admin-media', path, public_url: url, tags };
    const resp = existing?.id
      ? await svc.from('media').update(payload).eq('id', existing.id).select()
      : await svc.from('media').insert(payload).select();
    if (resp.error) throw resp.error;

    return res.status(200).json({ ok: true, media: resp.data?.[0] || payload });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'upload failed' });
  }
}
