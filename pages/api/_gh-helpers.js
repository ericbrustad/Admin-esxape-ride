// pages/api/_gh-helpers.js

export function ghEnv() {
  const token  = process.env.GITHUB_TOKEN;
  // OWNER: prefer explicit owner, then Vercel inferred, then legacy user var
  const owner  = process.env.GITHUB_OWNER || process.env.VERCEL_GIT_REPO_OWNER || process.env.GITHUB_USER;
  // REPO: prefer explicit repo, else Vercel inferred
  const repo   = process.env.GITHUB_REPO   || process.env.VERCEL_GIT_REPO_SLUG;
  // BRANCH: might be empty (we’ll resolve); prefer explicit, else Vercel ref
  const branch = process.env.GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || '';

  if (!token) throw new Error('Missing GITHUB_TOKEN (must have repo scope; SSO-authorize if org)');
  if (!owner) throw new Error('Missing GITHUB_OWNER (or VERCEL_GIT_REPO_OWNER)');
  if (!repo)  throw new Error('Missing GITHUB_REPO (or VERCEL_GIT_REPO_SLUG)');

  return { token, owner, repo, branch };
}

export function ghHeaders(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'EsxAdmin/1.0',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...extra,
  };
}

export async function resolveBranch({ token, owner, repo, branch }) {
  if (branch) return branch;
  // fallback to repo default branch
  const r = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: ghHeaders(token),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`Cannot resolve branch for ${owner}/${repo} (HTTP ${r.status}). Check OWNER/REPO/TOKEN.`);
  const info = await r.json();
  return info?.default_branch || 'main';
}

export async function getFileJSON({ token, owner, repo, ref, path }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`;
  const r = await fetch(url, { headers: ghHeaders(token), cache: 'no-store' });
  if (!r.ok) return null;
  const j = await r.json();
  const decoded = Buffer.from(j.content || '', 'base64').toString('utf8') || '{}';
  return { json: JSON.parse(decoded), sha: j.sha, raw: j };
}

export async function putFile({ token, owner, repo, ref, path, contentString, message }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  // include sha if file exists (update)
  let sha;
  const head = await fetch(`${url}?ref=${encodeURIComponent(ref)}`, { headers: ghHeaders(token) });
  if (head.ok) {
    const h = await head.json();
    sha = h.sha;
  }
  const body = {
    message,
    content: Buffer.from(contentString).toString('base64'),
    ...(sha ? { sha } : {}),
    branch: ref,
  };
  const r = await fetch(url, {
    method: 'PUT',
    headers: ghHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text();
    // surface owner/repo/path/ref for easier debugging (never leak token)
    throw new Error(`GitHub PUT ${path} -> ${r.status}. Owner=${owner} Repo=${repo} Ref=${ref}. Body=${text}`);
  }
  return r.json();
}

export async function deleteFile({ token, owner, repo, ref, path, sha, message }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const r = await fetch(url, {
    method: 'DELETE',
    headers: ghHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ message, sha, branch: ref }),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`GitHub DELETE ${path} -> ${r.status}. Owner=${owner} Repo=${repo} Ref=${ref}. Body=${text}`);
  }
  return r.json();
}
