import { serverClient } from '../../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { slug, snapshot } = req.body || {};
    if (!slug || !snapshot) {
      return res.status(400).json({ ok: false, error: 'Missing slug or snapshot' });
    }

    const supabase = serverClient();
    const payload = {
      slug,
      channel: 'published',
      data: snapshot,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('games').upsert(payload, { onConflict: 'slug' });
    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.status(200).json({ ok: true, published: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || String(error) });
  }
}

