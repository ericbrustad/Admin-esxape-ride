import { bulkCommit, joinPath, listDirs } from '../../lib/github.js';

function slugify(s) {
  return String(s || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
function genSlug() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `game-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
const pretty = obj => JSON.stringify(obj, null, 2) + '\n';

export default async function handler(req, res) {
  if (!['POST','GET'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rawSlug = (req.body?.slug ?? req.query?.slug ?? '').toString();
    const slug = slugify(rawSlug) || genSlug();

    // Do not block if it exists; this route is idempotent
    await listDirs('public/games'); // sanity (throws if env bad)

    const config = req.body?.config ?? {
      game: { title: (req.body?.title ?? slug.replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())), slug },
      theme: { missionDefault: { fontFamily: 'Inter, system-ui, Arial', fontSize: 18, textColor: '#e9eef2', backgroundColor: '#0b0c10' } }
    };
    const missions = req.body?.missions ?? {
      id: `${slug}-suite-1`,
      version: 1,
      missions: [
        { id: 'intro-1', role: 'intro', type: 'statement', title: 'Welcome', content: { text: 'Welcome to the game!', styleEnabled: false } },
        { id: 'final-1', role: 'final', type: 'statement', title: 'Finish',  content: { text: 'Great job!', styleEnabled: false } }
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

    const commit = await bulkCommit(files, `create game: ${slug}`);
    return res.status(200).json({ ok: true, slug, wrote: files.map(f => f.path), commitUrl: commit.htmlUrl });
  } catch (err) {
    console.error('create error:', err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
