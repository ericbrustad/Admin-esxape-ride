// pages/api/save-bundle.js
import { ghEnv, resolveBranch, putFile } from './_gh-helpers';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { slug = 'default' } = req.query;
    const { missions, config } = req.body;

    const { token, owner, repo, branch } = ghEnv();
    const ref = await resolveBranch({ token, owner, repo, branch });

    const folder = slug === 'default' ? 'public' : `public/games/${slug}`;

    await putFile({
      token, owner, repo, ref,
      path: `${folder}/missions.json`,
      contentString: JSON.stringify(missions, null, 2),
      message: `update ${folder}/missions.json via Admin UI`,
    });

    await putFile({
      token, owner, repo, ref,
      path: `${folder}/config.json`,
      contentString: JSON.stringify(config, null, 2),
      message: `update ${folder}/config.json via Admin UI`,
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
