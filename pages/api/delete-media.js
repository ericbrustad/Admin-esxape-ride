// /pages/api/delete-media.js (Next.js Pages Router)
// If using App Router, export a handler for DELETE/POST accordingly.

const fs = require('fs/promises');
const pathMod = require('path');

function assertSafePath(p) {
  if (!p || typeof p !== 'string') throw new Error('Missing path');
  if (!p.startsWith('public/media/')) throw new Error('Unsafe path');
  return p;
}

async function deleteFromLocal(p) {
  // Make sure we only delete under public/media
  const ROOT = process.cwd();
  const abs = pathMod.join(ROOT, p);
  const mediaRoot = pathMod.join(ROOT, 'public', 'media');
  if (!abs.startsWith(mediaRoot)) throw new Error('Unsafe absolute path');
  await fs.unlink(abs);
  return { ok: true };
}

async function deleteFromGitHub(p) {
  const owner  = process.env.GITHUB_OWNER;
  const repo   = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';
  const token  = process.env.GITHUB_TOKEN; // Fine‑grained: "Contents: Read & Write" or classic: repo scope

  if (!owner || !repo || !token) {
    throw new Error('GitHub env not configured (GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN)');
  }

  // 1) Lookup SHA
  const infoRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(p)}?ref=${encodeURIComponent(branch)}`,
    { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'media-delete' } }
  );

  if (!infoRes.ok) {
    const body = await infoRes.text();
    throw new Error(`lookup failed [${infoRes.status}]: ${body}`);
  }
  const info = await infoRes.json();
  const sha = info?.sha;
  if (!sha) throw new Error('No SHA for file');

  // 2) Delete with JSON body (GitHub expects DELETE with {message, sha, branch})
  const delRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(p)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'media-delete',
      },
      body: JSON.stringify({
        message: `delete ${p}`,
        sha,
        branch,
        // Optional: specify committer if needed by your repository settings
        // committer: { name: 'Bot', email: 'bot@example.com' },
      }),
    }
  );

  if (!delRes.ok) {
    const body = await delRes.text();
    throw new Error(`delete failed [${delRes.status}]: ${body}`);
  }

  return { ok: true };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST' && req.method !== 'DELETE') {
      res.setHeader('Allow', ['POST', 'DELETE']);
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const { path } = req.body || {};
    const safePath = assertSafePath(path);

    const useGitHub = !!(process.env.GITHUB_OWNER && process.env.GITHUB_REPO && process.env.GITHUB_TOKEN);
    const result = useGitHub ? await deleteFromGitHub(safePath) : await deleteFromLocal(safePath);

    return res.status(200).json({ ok: true, result });
  } catch (e) {
    const msg = e?.message || String(e);
    return res.status(400).json({ ok: false, error: msg });
  }
}
