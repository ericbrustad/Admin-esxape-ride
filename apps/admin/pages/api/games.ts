/* CODEx NOTE (2025-10-27): Games API
   - GET /api/games?list=1[&channel=draft|published]
       Returns unique games by slug (prefers requested channel; falls back).
   - POST /api/games?channel=draft
       Upserts a game row keyed by (slug,channel) and returns {slug,channel}.
*/
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

function serverClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false }});
}

type GameRow = {
  slug: string;
  title?: string | null;
  channel: string;
  cover_image?: string | null;
  updated_at?: string | null;
};

type GameListResponse = {
  ok: true;
  games: GameRow[];
};

type ErrorResponse = {
  ok: false;
  error: string;
};

type UpsertResponse = {
  ok: true;
  slug: string;
  channel: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<GameListResponse | UpsertResponse | ErrorResponse>) {
  const supabase = serverClient();

  if (req.method === 'GET') {
    const wantList = String(req.query.list || '') === '1';
    const channel = String(req.query.channel || '').toLowerCase();
    if (!wantList) return res.status(400).json({ ok: false, error: 'missing ?list=1' });

    const { data, error } = await supabase
      .from('games')
      .select('slug,title,channel,cover_image,updated_at')
      .order('updated_at', { ascending: false });

    if (error) return res.status(500).json({ ok: false, error: error.message });

    const bySlug = new Map<string, GameRow>();
    for (const row of data || []) {
      if (!row?.slug) continue;
      if (!bySlug.has(row.slug)) {
        bySlug.set(row.slug, row as GameRow);
        continue;
      }
      const current = bySlug.get(row.slug)!;
      if (channel && row.channel === channel) {
        bySlug.set(row.slug, row as GameRow);
        continue;
      }
      if (!channel) {
        const currentDate = current.updated_at ? new Date(current.updated_at).getTime() : 0;
        const nextDate = row.updated_at ? new Date(row.updated_at).getTime() : 0;
        if (nextDate > currentDate) bySlug.set(row.slug, row as GameRow);
      }
    }

    return res.status(200).json({ ok: true, games: Array.from(bySlug.values()) });
  }

  if (req.method === 'POST') {
    const channel = String(req.query.channel || 'draft').toLowerCase() === 'published' ? 'published' : 'draft';
    const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) || {};
    const slug = String(body.slug || '').trim();
    const config = body.config || {};
    if (!slug) return res.status(400).json({ ok: false, error: 'missing slug' });

    const appearance = config?.appearance ?? {};
    const payload: Record<string, any> = {
      slug,
      channel,
      title: body.title ?? config?.game?.title ?? slug,
      type: body.type ?? config?.game?.type ?? null,
      cover_image: config?.game?.coverImage ?? null,
      config,
      appearance,
      theme: appearance,
      appearance_skin: config?.appearanceSkin ?? null,
      appearance_tone: config?.appearanceTone ?? 'light',
      short_description: config?.game?.shortDescription ?? null,
      long_description: config?.game?.longDescription ?? null,
      tags: Array.isArray(config?.game?.tags) ? config.game.tags : [],
    };
    if (config?.game?.mode) payload.mode = String(config.game.mode);

    const { data, error } = await supabase
      .from('games')
      .upsert(payload, { onConflict: 'slug,channel' })
      .select('slug,channel')
      .single();

    if (error) return res.status(500).json({ ok: false, error: error.message });

    return res.status(200).json({ ok: true, slug: data.slug, channel: data.channel });
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
