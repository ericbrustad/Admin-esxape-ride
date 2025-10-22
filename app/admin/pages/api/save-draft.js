/**
 * POST /api/save-draft
 * Body: { game, config, missions = [], devices = [], assignments = [] }
 * Writes everything to channel='draft' in Supabase.
 */
import { getServiceClient } from '../../lib/supabase/client';
import { newId, toSlug } from '../../lib/ids';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { game, config, missions = [], devices = [], assignments = [] } = req.body || {};
    if (!game?.slug) return res.status(400).json({ error: 'game.slug required' });

    const svc = getServiceClient();
    const slug = toSlug(game.slug);

    // ensure game
    let { data: g, error: gErr } = await svc.from('games').select('*').eq('slug', slug).maybeSingle();
    if (gErr) throw gErr;
    if (!g) {
      const gid = newId('g');
      const ins = await svc.from('games').insert({
        id: gid, slug, title: game.title || slug, type: game.type || 'Hunt', mode: game.mode || 'single'
      }).select().single();
      if (ins.error) throw ins.error;
      g = ins.data;
    }

    // wipe draft snapshot
    const { data: draftMs } = await svc.from('missions').select('id').eq('game_id', g.id).eq('channel', 'draft');
    if (draftMs?.length) {
      await svc.from('mission_media').delete().in('mission_id', draftMs.map(m => m.id));
    }
    await svc.from('missions').delete().eq('game_id', g.id).eq('channel', 'draft');
    await svc.from('devices').delete().eq('game_id', g.id).eq('channel', 'draft');
    await svc.from('game_configs').delete().eq('game_id', g.id).eq('channel', 'draft');

    // insert config
    const cfgIns = await svc.from('game_configs').insert({
      id: newId('cfg'),
      game_id: g.id,
      channel: 'draft',
      config: config || {}
    });
    if (cfgIns.error) throw cfgIns.error;

    // insert missions
    const missionIdBySlug = {};
    for (let i = 0; i < missions.length; i++) {
      const m = missions[i];
      const ms = toSlug(m.mission_slug || m.title || `m${i+1}`);
      const id = newId('m');
      missionIdBySlug[ms] = id;
      const ins = await svc.from('missions').insert({
        id,
        game_id: g.id,
        mission_slug: ms,
        title: m.title || ms,
        type: m.type || 'statement',
        rewards_points: m.rewards_points || 0,
        content: m.content || {},
        order_index: m.order_index ?? i,
        channel: 'draft'
      });
      if (ins.error) throw ins.error;
    }

    // insert devices
    for (const d of devices) {
      const id = newId('d');
      const ins = await svc.from('devices').insert({
        id,
        game_id: g.id,
        device_key: toSlug(d.device_key || d.type || 'device'),
        type: d.type || 'powerup',
        lat: d.lat ?? null,
        lng: d.lng ?? null,
        pickup_radius: d.pickup_radius ?? 100,
        effect_seconds: d.effect_seconds ?? 120,
        icon_key: d.icon_key || '',
        channel: 'draft'
      });
      if (ins.error) throw ins.error;
    }

    // mission_media (by mission_slug + media.slug)
    const neededSlugs = [...new Set(assignments.map(a => a.media_slug).filter(Boolean))];
    let mediaBySlug = {};
    if (neededSlugs.length) {
      const { data: medias, error } = await svc.from('media').select('id, slug').in('slug', neededSlugs);
      if (error) throw error;
      for (const m of (medias || [])) mediaBySlug[m.slug] = m.id;
    }

    for (const a of assignments) {
      const mId = missionIdBySlug[toSlug(a.mission_slug)];
      const mediaId = mediaBySlug[toSlug(a.media_slug || '')];
      if (!mId || !mediaId) continue; // skip if missing
      const ins = await svc.from('mission_media').insert({
        mission_id: mId,
        media_id: mediaId,
        role: a.role || 'cover',
        slot: a.slot ?? 0
      });
      if (ins.error) throw ins.error;
    }

    return res.status(200).json({ ok: true, slug, game_id: g.id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'save-draft failed' });
  }
}
