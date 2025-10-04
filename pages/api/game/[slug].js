// pages/api/game/[slug].js
// Robust game data fetcher used by Admin Test / preview.
// GET /api/game/<slug>?channel=published|draft
import { readJson, joinPath } from '../../../lib/github.js';

function okJson(res, obj) { return res.status(200).json({ ok:true, ...obj }); }
function errJson(res, code, obj) { return res.status(code).json({ ok:false, ...obj }); }

export default async function handler(req, res) {
  try {
    const { slug } = req.query;
    if (!slug || typeof slug !== 'string' || slug.trim() === '') {
      return errJson(res, 400, { error: 'Missing slug in path' });
    }
    const channel = (req.query.channel || 'published').toLowerCase();
    const tryOrder = [];

    // Candidate file locations (search order)
    // 1) mirrored game published/draft under game/public/games/<slug>[/draft]
    // 2) admin public/games/<slug>[/draft]
    // 3) legacy admin public/draft or public root (fallback)
    const baseSlug = slug.trim();

    // build list of base paths to try for the requested channel
    if (channel === 'draft') {
      tryOrder.push(joinPath('game/public/games', baseSlug, 'draft'));
      tryOrder.push(joinPath('public/games', baseSlug, 'draft'));
      tryOrder.push(joinPath('public', 'draft')); // legacy
    } else {
      // published channel
      tryOrder.push(joinPath('game/public/games', baseSlug));
      tryOrder.push(joinPath('public/games', baseSlug));
      tryOrder.push('public'); // legacy
    }

    const attempted = [];
    let found = false;
    let config = null;
    let missions = null;
    let usedBase = null;

    for (const base of tryOrder) {
      // try config then missions
      attempted.push({ base, configPath: joinPath(base, 'config.json'), missionsPath: joinPath(base, 'missions.json') });

      // readJson returns parsed JSON or null
      const cfg = await readJson(joinPath(base, 'config.json'));
      const mis = await readJson(joinPath(base, 'missions.json'));

      if (cfg || mis) {
        usedBase = base;
        config = cfg || null;
        missions = mis || null;
        found = true;
        break;
      }
    }

    // If nothing found, return clear diagnostics (no opaque 500)
    if (!found) {
      return errJson(res, 404, {
        error: 'No config or missions.json found for slug',
        slug: baseSlug,
        channel,
        attempted
      });
    }

    // If config found but missions missing, provide a safe default
    if (config && !missions) missions = { missions: [] };

    return okJson(res, {
      slug: baseSlug,
      channel,
      usedBase,
      config,
      missions,
      attempted
    });
  } catch (err) {
    console.error('api/game/[slug] error:', err);
    return errJson(res, 500, { error: String(err?.message || err), stack: err?.stack });
  }
}
