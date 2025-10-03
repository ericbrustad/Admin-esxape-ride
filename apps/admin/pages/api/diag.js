// apps/admin/pages/api/diag.js
export default async function handler(_req, res) {
  const safe = (name) => Boolean(process.env[name]);
  res.status(200).json({
    ok: true,
    env: {
      REPO_OWNER: safe('REPO_OWNER'),
      REPO_NAME: safe('REPO_NAME'),
      GITHUB_TOKEN: safe('GITHUB_TOKEN'),
      GITHUB_BRANCH: process.env.GITHUB_BRANCH || 'main',
      GITHUB_BASE_DIR: process.env.GITHUB_BASE_DIR || '',
      NEXT_PUBLIC_GAME_ORIGIN: safe('NEXT_PUBLIC_GAME_ORIGIN'),
    }
  });
}
