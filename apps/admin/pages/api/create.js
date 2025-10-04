// apps/admin/pages/api/create.js
import { upsertJson, joinPath } from '../../lib/github.js';

function sanitizeSlug(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')     // keep letters, numbers, hyphens
    .replace(/^-+|-+$/g, '')          // trim hyphens
    .slice(0, 60);
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const raw = (req.body?.slug ?? req.query?.slug ?? '').toString();
    const slug = sanitizeSlug(raw);
    if (!slug) return res.status(400).json({ error: 'Missing or invalid slug' });

    // Defaults (safe to customize)
    const config = req.body?.config ?? {
      game: { title: 'New Game', slug },
      theme: {
        missionDefault: {
          fontFamily: 'Inter, system-ui, Arial',
          fontSize: 18,
          textColor: '#e9eef2',
          backgroundColor: '#0b0c10'
        }
      }
    };

    const missions = req.body?.missions ?? {
      id: `${slug}-suite-1`,
      version: 1,
      missions: [
        { id: 'intro-1', role: 'intro', type: 'statement', title: 'Welcome', content: { text: 'Welcome to the game!', styleEnabled: false } },
        { id: 'final-1', role: 'final', type: 'statement', title: 'Finish',  content: { text: 'Great job!', styleEnabled: false } }
      ]
    };

    const basePub   = joinPath('public/games', slug);
    const baseDraft = joinPath('public/games', slug, 'draft');

    const results = [];
    // published
    results.push(await upsertJson(joinPath(basePub,   'config.json'),   config,   `create(config): ${slug}`));
    results.push(await upsertJson(joinPath(basePub,   'missions.json'), missions, `create(missions): ${slug}`));
    // draft
    results.push(await upsertJson(joinPath(baseDraft, 'config.json'),   config,   `create draft(config): ${slug}`));
    results.push(await upsertJson(joinPath(baseDraft, 'missions.json'), missions, `create draft(missions): ${slug}`));

    return res.status(200).json({ ok: true, slug, created: results.length });
  } catch (err) {
    console.error('create error:', err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
