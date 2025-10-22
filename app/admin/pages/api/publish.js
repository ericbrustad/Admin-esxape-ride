/**
 * POST /api/publish?slug=<game_slug>
 * Calls publish_game RPC to snapshot draft → published.
 */
import { getServiceClient } from '../../lib/supabase/client';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const slug = req.query.slug || req.body?.slug;
  if (!slug) return res.status(400).json({ error: 'slug required' });
  try {
    const svc = getServiceClient();
    const { error } = await svc.rpc('publish_game', { p_game_slug: slug });
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'publish failed' });
  }
}
