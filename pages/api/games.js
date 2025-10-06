// pages/api/games.js
import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const root = path.join(process.cwd(), 'public/games');
  fs.mkdirSync(root, { recursive: true });

  // 🟢 GET — list all games
  if (req.method === 'GET') {
    const list = fs.readdirSync(root).filter(f =>
      fs.existsSync(path.join(root, f, 'missions.json'))
    );

    const games = list.map(slug => {
      const file = path.join(root, slug, 'config.json');
      const cfg = fs.existsSync(file)
        ? JSON.parse(fs.readFileSync(file, 'utf8'))
        : {};
      return {
        slug,
        title: cfg.game?.title || slug,
        mode: cfg.splash?.mode || 'single',
      };
    });

    return res.json({ ok: true, games });
  }

  // 🟡 POST — create new game
  if (req.method === 'POST') {
    const { title, type, mode, timer } = req.body;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const dir = path.join(root, slug);
    fs.mkdirSync(dir, { recursive: true });

    const cfg = {
      game: { title, type },
      splash: { enabled: true, mode },
      timer,
      map: { centerLat: 44.9778, centerLng: -93.2650, defaultZoom: 13 },
    };

    fs.writeFileSync(
      path.join(dir, 'config.json'),
      JSON.stringify(cfg, null, 2)
    );
    fs.writeFileSync(
      path.join(dir, 'missions.json'),
      JSON.stringify({ version: '1.0.0', missions: [] }, null, 2)
    );

    return res.json({ ok: true, slug });
  }

  // 🔴 DELETE — remove a game by slug
  if (req.method === 'DELETE') {
    const { slug } = req.query;
    if (!slug) return res.status(400).json({ ok: false, error: 'Missing slug' });
    const dir = path.join(root, slug);
    fs.rmSync(dir, { recursive: true, force: true });
    return res.json({ ok: true });
  }

  res.status(405).end();
}
