// apps/admin/pages/api/diag.js
import { getEnvSnapshot } from '../../lib/github.js';

export default async function handler(_req, res) {
  try {
    const snap = getEnvSnapshot();
    res.status(200).json({
      ok: true,
      env: {
        REPO_OWNER: snap.OWNER,
        REPO_NAME: snap.REPO,
        GITHUB_TOKEN: snap.TOKEN,
        GITHUB_BRANCH: snap.BRANCH,
        GITHUB_BASE_DIR: snap.BASE_DIR || '',
        NEXT_PUBLIC_GAME_ORIGIN: Boolean(process.env.NEXT_PUBLIC_GAME_ORIGIN),
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
