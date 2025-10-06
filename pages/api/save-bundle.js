// pages/api/save-bundle.js
import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { slug = 'default' } = req.query;
    const { missions, config } = req.body;

    const root = path.join(process.cwd(), 'public/games');
    const dir =
      slug === 'default'
        ? path.join(process.cwd(), 'public')
        : path.join(root, slug);

    fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(
      path.join(dir, 'missions.json'),
      JSON.stringify(missions, null, 2)
    );
    fs.writeFileSync(
      path.join(dir, 'config.json'),
      JSON.stringify(config, null, 2)
    );

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
