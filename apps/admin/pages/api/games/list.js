import { serverClient } from '../../../lib/supabaseClient';

function normalizeChannel(value, fallback = 'draft') {
  const v = String(value || fallback).toLowerCase();
  return v === 'published' ? 'published' : 'draft';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const supabase = serverClient();
  if (!supabase) {
    return res.status(200).json({ ok: true, games: [], note: 'Supabase not configured. Returning empty list.' });
  }

  try {
    const { data, error } = await supabase
      .from('games')
      .select('id, slug, title, channel, status, is_published, published_at, updated_at')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const games = (data || [])
      .filter(g => g?.slug)
      .map(g => {
        const channel = normalizeChannel(
          g.channel ?? g.status ?? (g.is_published ? 'published' : 'draft')
        );
        return {
          slug: g.slug,
          title: g.title || g.slug,
          channel,
          published: channel === 'published',
          updated_at: g.updated_at || g.published_at || null,
        };
      });

    return res.status(200).json({ ok: true, games });
  } catch (e) {
    return res.status(200).json({
      ok: true,
      games: [],
      note: 'No accessible games found (table missing or RLS). UI will still render.',
      error: String(e?.message || e),
    });
  }
}
