import { upsertJson, listDirs, joinPath } from '../../lib/github.js';

function slugify(s) {
  return String(s || '').trim().toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
function genSlug() {
  const d = new Date(); const pad = n => String(n).padStart(2, '0');
  return `game-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
function toTitle(slug) {
  return slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default async function handler(req, res) {
  if (!['POST','GET'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rawSlug = (req.body?.slug ?? req.query?.slug ?? '').toString();
    const slug = slugify(rawSlug) || genSlug();
    const title = (req.body?.title ?? req.query?.title ?? toTitle(slug)).toString();

    const existing = await listDirs('public/games');
    const already = existing.includes(slug);

    const basePub   = joinPath('public/games', slug);
    const baseDraft = joinPath('public/games', slug, 'draft');

    const config = req.body?.config ?? {
      game: { title, slug },
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

    const results = [];
    // published
    results.push(await upsertJson(joinPath(basePub,   'config.json'),   config,   `${already ? 'update' : 'create'}(config): ${slug}`));
    results.push(await upsertJson(joinPath(basePub,   'missions.json'), missions, `${already ? 'update' : 'create'}(missions): ${slug}`));
    // draft
    results.push(await upsertJson(joinPath(baseDraft, 'config.json'),   config,   `${already ? 'update draft' : 'create draft'}(config): ${slug}`));
    results.push(await upsertJson(joinPath(baseDraft, 'missions.json'), missions, `${already ? 'update draft' : 'create draft'}(missions): ${slug}`));

    return res.status(200).json({ ok: true, slug, existed: already, results });
  } catch (err) {
    console.error('create error:', err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
