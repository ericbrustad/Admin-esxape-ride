import { createClient } from '@supabase/supabase-js';

function serverClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase configuration');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function normalizeChannel(value, fallback = 'draft') {
  const raw = typeof value === 'string' ? value : Array.isArray(value) ? value[0] : fallback;
  return String(raw || fallback).trim().toLowerCase() === 'published' ? 'published' : 'draft';
}

function mapGameRow(row) {
  if (!row) return null;
  const config = row.config || {};
  const gameMeta = config.game || {};
  const splash = config.splash || {};
  return {
    slug: row.slug,
    title: row.title || gameMeta.title || row.slug,
    status: row.status || (row.channel === 'published' ? 'published' : 'draft'),
    channel: row.channel || 'draft',
    mode: splash.mode || gameMeta.mode || 'single',
    updatedAt: row.updated_at || null,
    createdAt: row.created_at || null,
    config,
  };
}

function parseRequestBody(req) {
  if (req.body == null) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}');
    } catch (error) {
      return {};
    }
  }
  return req.body;
}

export default async function handler(req, res) {
  let supabase;
  try {
    supabase = serverClient();
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || 'Supabase configuration missing' });
  }

  if (req.method === 'GET') {
    try {
      const channel = normalizeChannel(req.query.channel, 'draft');
      const slugFilterRaw = req.query.slug;
      const slugFilter = typeof slugFilterRaw === 'string' ? slugFilterRaw.trim() : Array.isArray(slugFilterRaw) ? slugFilterRaw[0]?.trim() : '';

      let query = supabase
        .from('games')
        .select('*')
        .eq('channel', channel)
        .order('updated_at', { ascending: false });

      if (slugFilter) {
        query = query.eq('slug', slugFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const list = Array.isArray(data) ? data : data ? [data] : [];
      const games = list.map(mapGameRow).filter(Boolean);
      return res.status(200).json({ ok: true, games });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error?.message || 'Failed to load games' });
    }
  }

  if (req.method === 'POST') {
    try {
      const channel = normalizeChannel(req.query.channel, 'draft');
      const body = parseRequestBody(req);

      const slug = String(body.slug || '').trim();
      const config = body.config || {};
      if (!slug) {
        return res.status(400).json({ ok: false, error: 'missing slug' });
      }

      const appearance = config.appearance ?? {};
      const appearanceSkin = config.appearanceSkin ?? null;
      const appearanceTone = config.appearanceTone ?? 'light';
      const gameMeta = config.game ?? {};
      const tags = Array.isArray(gameMeta.tags) ? gameMeta.tags : [];

      const payload = {
        slug,
        channel,
        title: body.title ?? gameMeta.title ?? slug,
      type: body.type ?? gameMeta.type ?? null,
      cover_image: gameMeta.coverImage ?? body.coverImage ?? null,
      config,
      map: config?.map || {},
      appearance,
      theme: appearance,
        appearance_skin: appearanceSkin,
        appearance_tone: appearanceTone,
        mode: body.mode ?? gameMeta.mode ?? null,
        short_description: body.shortDescription ?? gameMeta.shortDescription ?? null,
        long_description: body.longDescription ?? gameMeta.longDescription ?? null,
        tags,
        status: channel === 'published' ? 'published' : 'draft',
      };

      const { data, error } = await supabase
        .from('games')
        .upsert(payload, { onConflict: 'slug,channel' })
        .select('id, slug, channel')
        .single();

      if (error) throw error;

      return res.status(200).json({ ok: true, game: data, slug: data?.slug || slug, channel });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error?.message || 'Failed to upsert game' });
    }
  }

  res.setHeader('Allow', 'GET,POST');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
