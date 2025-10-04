// pages/api/diag.js
import { env } from '../../src/lib/github';

export default async function handler(_req, res) {
  try {
    const { OWNER, REPO, TOKEN, BRANCH, BASE_DIR } = env();
    res.status(200).json({
      ok: true,
      env: {
        REPO_OWNER: !!OWNER,
        REPO_NAME: !!REPO,
        GITHUB_TOKEN: !!TOKEN,
        GITHUB_BRANCH: BRANCH,
        GITHUB_BASE_DIR: BASE_DIR || '',
        NEXT_PUBLIC_GAME_ORIGIN: !!process.env.NEXT_PUBLIC_GAME_ORIGIN
      }
    });
  } catch (err) {
    res.status(500).json({ ok:false, error: String(err?.message || err) });
  }
}
