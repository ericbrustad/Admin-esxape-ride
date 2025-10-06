// pages/api/games.js
import { ghEnv, ghHeaders, resolveBranch, getFileJSON, putFile, deleteFile } from './_gh-helpers';

export default async function handler(req, res) {
  try {
    const { token, owner, repo, branch } = ghEnv();
    const ref = await resolveBranch({ token, owner, repo, branch });

    // GET — list games (hydrate title/mode from each config.json)
    if (req.method === 'GET') {
      const r = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/public/games?ref=${encodeURIComponent(ref)}`,
        { headers: ghHeaders(token), cache: 'no-store' }
      );
      if (!r.ok) return res.json({ ok: true, games: [] });

      const items = await r.json();
      const dirs = (Array.isArray(items) ? items : [])
        .filter(i => i.type === 'dir')
        .map(i => i.name);

      const games = await Promise.all(dirs.map(async (slug) => {
        const cfg = await getFileJSON({ token, owner, repo, ref, path: `public/games/${slug}/config.json` });
        return {
          slug,
          title: cfg?.json?.game?.title || slug,
          mode: cfg?.json?.splash?.mode || 'single',
        };
      }));

      return res.json({ ok: true, games });
    }

    // POST — create a new game
    if (req.method === 'POST') {
      const { title, type, mode, timer } = req.body;
      const slug = String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'game';

      const dir = `public/games/${slug}`;

      await putFile({
        token, owner, repo, ref,
        path: `${dir}/config.json`,
        contentString: JSON.stringify({
          game: { title, type },
          splash: { enabled: true, mode },
          timer,
          map: { centerLat: 44.9778, centerLng: -93.2650, defaultZoom: 13 },
        }, null, 2),
        message: `create ${dir}/config.json via Admin UI`,
      });

      await putFile({
        token, owner, repo, ref,
        path: `${dir}/missions.json`,
        contentString: JSON.stringify({ version: '1.0.0', missions: [] }, null, 2),
        message: `create ${dir}/missions.json via Admin UI`,
      });

      return res.json({ ok: true, slug });
    }

    // DELETE — delete entire game folder (delete each file inside)
    if (req.method === 'DELETE') {
      const slug = String(req.query.slug || '');
      if (!slug) return res.status(400).json({ ok: false, error: 'Missing slug' });

      const list = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/public/games/${slug}?ref=${encodeURIComponent(ref)}`,
        { headers: ghHeaders(token), cache: 'no-store' }
      );
      if (!list.ok) return res.json({ ok: false, error: 'Folder not found' });
      const files = await list.json();

      for (const f of files) {
        await deleteFile({
          token, owner, repo, ref,
          path: f.path,
          sha: f.sha,
          message: `delete ${f.path} via Admin UI`,
        });
      }
      return res.json({ ok: true });
    }

    res.status(405).end();
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
