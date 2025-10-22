// pages/api/admin-meta.js
// Surface repo + deployment metadata for the admin banner.

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function readGitValue(args, fallback = '') {
  try {
    const { stdout = '' } = await execFileAsync('git', args, { cwd: process.cwd() });
    return stdout.trim() || fallback;
  } catch (err) {
    console.warn('[admin-meta] git command failed', args?.join?.(' '), err?.message || err);
    return fallback;
  }
}

function parseRepoSlug(remoteUrl = '') {
  const raw = String(remoteUrl || '').trim();
  if (!raw) return { owner: '', repo: '' };
  try {
    if (raw.startsWith('git@')) {
      const [, pathPart = ''] = raw.split(':');
      const [owner = '', repoWithExt = ''] = pathPart.replace(/\.git$/, '').split('/');
      return { owner, repo: repoWithExt };
    }
    const url = new URL(raw);
    const segments = url.pathname.replace(/\.git$/, '').split('/').filter(Boolean);
    if (segments.length >= 2) {
      return { owner: segments[segments.length - 2], repo: segments[segments.length - 1] };
    }
  } catch (err) {
    console.warn('[admin-meta] failed to parse remote url', err?.message || err);
  }
  return { owner: '', repo: '' };
}

export default async function handler(req, res) {
  try {
    const envBranch = (
      process.env.REPO_BRANCH ||
      process.env.GITHUB_BRANCH ||
      process.env.VERCEL_GIT_COMMIT_REF ||
      process.env.COMMIT_REF ||
      ''
    );
    const envCommit = (
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.GITHUB_SHA ||
      process.env.COMMIT_SHA ||
      ''
    );
    const envOwner = process.env.REPO_OWNER || process.env.VERCEL_GIT_REPO_OWNER || '';
    const envRepo = process.env.REPO_NAME || process.env.VERCEL_GIT_REPO_SLUG || '';
    const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';

    const branch = envBranch || await readGitValue(['rev-parse', '--abbrev-ref', 'HEAD'], 'main');
    const commit = envCommit || await readGitValue(['rev-parse', 'HEAD'], '');
    let owner = envOwner;
    let repo = envRepo;

    if (!owner || !repo) {
      const remote = await readGitValue(['config', '--get', 'remote.origin.url'], '');
      const parsed = parseRepoSlug(remote);
      owner = owner || parsed.owner;
      repo = repo || parsed.repo;
    }

    const payload = {
      ok: true,
      branch,
      commit,
      commitShort: commit ? commit.slice(0, 7) : '',
      owner,
      repo,
      vercelUrl,
      fetchedAt: new Date().toISOString(),
    };

    res.status(200).json(payload);
  } catch (err) {
    console.error('[admin-meta] failed', err);
    res.status(200).json({ ok: false, error: err?.message || 'failed to read admin meta' });
  }
}
