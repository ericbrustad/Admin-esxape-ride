// pages/api/admin-meta.js
// Surface repo + deployment metadata for the admin banner.

import { promises as fs } from 'fs';
import path from 'path';

async function readGitMeta() {
  try {
    const headPath = path.join(process.cwd(), '.git', 'HEAD');
    const head = await fs.readFile(headPath, 'utf8');
    const trimmed = head.trim();

    if (trimmed.startsWith('ref:')) {
      const ref = trimmed.split(' ')[1]?.trim();
      if (!ref) return { branch: '', commit: '' };
      const branch = ref.split('/').pop() || '';
      const refPath = path.join(process.cwd(), '.git', ref);

      try {
        const commit = (await fs.readFile(refPath, 'utf8')).trim();
        return { branch, commit };
      } catch {
        try {
          const packedPath = path.join(process.cwd(), '.git', 'packed-refs');
          const packed = await fs.readFile(packedPath, 'utf8');
          const match = packed.split('\n').find((line) => line.trim().endsWith(` ${ref}`));
          if (match) {
            const commit = match.split(' ')[0]?.trim() || '';
            return { branch, commit };
          }
        } catch {}
      }

      return { branch, commit: '' };
    }

    // Detached HEAD – the HEAD file already stores the commit SHA.
    return { branch: '', commit: trimmed };
  } catch {
    return { branch: '', commit: '' };
  }
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
    const gitMeta = await readGitMeta();
    const branch = envBranch || gitMeta.branch || 'main';
    const commit = envCommit || gitMeta.commit || '';
    const owner = process.env.REPO_OWNER || process.env.VERCEL_GIT_REPO_OWNER || '';
    const repo = process.env.REPO_NAME || process.env.VERCEL_GIT_REPO_SLUG || '';
    const vercelUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : (process.env.NEXT_PUBLIC_VERCEL_URL || '');

    res.status(200).json({
      ok: true,
      branch,
      commit,
      owner,
      repo,
      vercelUrl,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(200).json({ ok: false, error: err?.message || 'failed to read admin meta' });
  }
}
