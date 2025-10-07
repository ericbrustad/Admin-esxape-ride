// pages/api/config.js
import { ghEnv, resolveBranch, getFileJSON } from './_gh-helpers';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const { slug } = req.query;
    const path = (slug && slug !== 'default')
      ? `public/games/${slug}/config.json`
      : 'public/config.json';

    const { token, owner, repo, branch } = ghEnv();
    const ref = await resolveBranch({ token, owner, repo, branch });

    const read = await getFileJSON({ token, owner, repo, ref, path });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(read?.json || {});
  } catch {
    return res.status(200).json({});
  }
}
