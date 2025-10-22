// pages/api/admin-meta.js
// Surface repo + deployment metadata for the admin banner.

export default async function handler(req, res) {
  try {
    const branch = (
      process.env.REPO_BRANCH ||
      process.env.GITHUB_BRANCH ||
      process.env.VERCEL_GIT_COMMIT_REF ||
      process.env.COMMIT_REF ||
      'main'
    );
    const commit = (
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.GITHUB_SHA ||
      process.env.COMMIT_SHA ||
      ''
    );
    const owner = process.env.REPO_OWNER || process.env.VERCEL_GIT_REPO_OWNER || '';
    const repo = (
      process.env.REPO_NAME ||
      process.env.VERCEL_GIT_REPO_SLUG ||
      process.env.npm_package_name ||
      ''
    );
    const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
    const deploymentUrl = (
      process.env.DEPLOYMENT_URL ||
      process.env.VERCEL_DEPLOYMENT_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.VERCEL_BRANCH_URL ||
      vercelUrl
    );
    const deploymentState = process.env.DEPLOYMENT_STATE || process.env.VERCEL_ENV || '';

    res.status(200).json({
      ok: true,
      branch,
      commit,
      owner,
      repo,
      vercelUrl,
      deploymentUrl,
      deploymentState,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(200).json({ ok: false, error: err?.message || 'failed to read admin meta' });
  }
}
