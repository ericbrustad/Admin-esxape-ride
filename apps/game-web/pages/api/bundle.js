import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const DEFAULT_SLUG = process.env.NEXT_PUBLIC_DEFAULT_GAME_SLUG || 'demo';
const DEFAULT_CHANNEL = process.env.NEXT_PUBLIC_DEFAULT_CHANNEL || 'published';

function normalizeChannel(value) {
  return String(value || '').trim().toLowerCase() === 'draft' ? 'draft' : 'published';
}

function ensureClient() {
  if (!SUPABASE_URL || !KEY) {
    throw new Error('Missing Supabase environment variables');
  }
  return createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let supabase;
  try {
    supabase = ensureClient();
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || 'Supabase configuration missing' });
  }

  const slug = String(req.query.game || req.query.slug || DEFAULT_SLUG).trim();
  const channel = normalizeChannel(req.query.channel || DEFAULT_CHANNEL);

  try {
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('slug', slug)
      .eq('channel', channel)
      .single();

    if (gameError || !game) {
      const message = gameError?.message || `Game not found for ${slug}@${channel}`;
      return res.status(404).json({ ok: false, error: message });
    }

    const gameId = game?.id || null;
    const missionQuery = supabase
      .from('missions')
      .select('*')
      .eq('channel', channel)
      .order('order_index', { ascending: true });
    const deviceQuery = supabase
      .from('devices')
      .select('*')
      .eq('channel', channel)
      .limit(1000);
    const powerupQuery = supabase
      .from('powerups')
      .select('*')
      .eq('channel', channel)
      .limit(1000);

    if (gameId) {
      missionQuery.eq('game_id', gameId);
      deviceQuery.eq('game_id', gameId);
      powerupQuery.eq('game_id', gameId);
    } else {
      missionQuery.eq('game_slug', slug);
      deviceQuery.eq('game_slug', slug);
      powerupQuery.eq('game_slug', slug);
    }

    const [missionsRes, devicesRes, powerupsRes] = await Promise.all([
      missionQuery,
      deviceQuery,
      powerupQuery.catch(() => ({ data: [], error: null })),
    ]);

    const missions = Array.isArray(missionsRes?.data) ? missionsRes.data : [];
    const devices = Array.isArray(devicesRes?.data) ? devicesRes.data : [];
    const powerups = Array.isArray(powerupsRes?.data) ? powerupsRes.data : [];

    return res.status(200).json({
      ok: true,
      _meta: { slug, channel, generatedAt: new Date().toISOString() },
      game,
      missions,
      devices,
      powerups,
      media: [],
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || 'Failed to load bundle' });
  }
}
