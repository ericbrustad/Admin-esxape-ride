// apps/admin/pages/api/games/index.js
// GET  -> list game slugs under public/games (monorepo-aware)
// POST -> create a game (published + draft) in ONE commit and return a small payload

import { bulkCommit, joinPath, listDirs } from '../../../lib/github.js';

// ---------- helpers ----------
function slugify(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
function genSlug() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `game-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function titleFromSlug(slug) {
  return slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
const pretty = obj => JSON.stringify(obj, null, 2) + '\n';

// ---------- route ----------
export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // primary path (BASE_DIR is added inside listDirs)
      const slugs = await listDirs('public/games');
      return res.status(200).json({ slugs });
    }

    if (req.method === 'POST') {
      const body = (req.body || {});
      const rawSlug = (body.slug ?? '').toString();
      const slug = slugify(rawSlug) || genSlug();
      const title = (body.title ?? titleFromSlug(slug)).toString();

      // Minimal defaults; your UI can overwrite later via /api/save
      const config = body.config ?? {
        game: { title, slug },
        theme: {
          missionDefault: {
            fontFamily: 'Inter, system-ui, Arial',
            fontSize: 18,
            textColor: '#e9eef2',
            backgroundColor: '#0b0c10'
          }
        }
      };

      const missions = body.missions ?? {
        id: `${slug}-suite-1`,
        version: 1,
        missions: [
          { id: 'intro-1', role: 'intro', type: 'statement', title: 'Welcome',
            content: { text: 'Welcome to the game!', styleEnabled: false } },
          { id: 'final-1', role: 'final', type: 'statement', title: 'Finish',
            content: { text: 'Great job!', styleEnabled: false } }
        ]
      };

      const pub   = joinPath('public/games', slug);
      const draft = joinPath('public/games', slug, 'draft');

      const files = [
        { path: joinPath(pub,   'config.json'),   content: pretty(config) },
        { path: joinPath(pub,   'missions.json'), content: pretty(missions) },
        { path: joinPath(draft, 'config.json'),   content: pretty(config) },
        { path: joinPath(draft, 'missions.json'), content: pretty(missions) },
      ];

      // ONE commit → prevents 4–5 deploys from a single button click
      const commit = await bulkCommit(files, `create game: ${slug}`);

      // Return refreshed list so the UI can immediately update its dropdown
      const slugs = await listDirs('public/games');

      return res
        .status(200)
        .json({
          ok: true,
          slug,
          commitUrl: commit.htmlUrl,
          slugs
        });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('api/games error:', err);
    const msg = (err && err.message) ? err.message : String(err);
    return res.status(500).json({ ok: false, error: msg });
  }
}
