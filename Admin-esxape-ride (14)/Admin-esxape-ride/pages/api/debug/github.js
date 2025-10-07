// pages/api/debug/github.js
// ✅ correct
import {
  ghEnv,
  ghHeaders,
  resolveBranch,
  getFileJSON,
  putFile,
  deleteFile,
} from '../_gh-helpers';

// (Optional but recommended for Buffer/fetch on Node runtime)
export const runtime = 'nodejs';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const { token, owner, repo, branch } = ghEnv();
    const ref = await resolveBranch({ token, owner, repo, branch });

    const repoResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: ghHeaders(token), cache: 'no-store'
    });
    const repoJson = await repoResp.json().catch(()=>null);

    const listResp = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/public?ref=${encodeURIComponent(ref)}`,
      { headers: ghHeaders(token), cache: 'no-store' }
    );
    const listOk = listResp.ok;
    const listBody = listOk ? await listResp.json() : await listResp.text();

    res.status(200).json({
      ok: true,
      resolved: { owner, repo, ref },
      repo: { ok: repoResp.ok, default_branch: repoJson?.default_branch, private: repoJson?.private },
      listPublic: { ok: listOk, sample: listOk ? (Array.isArray(listBody) ? listBody.map(i=>({name:i.name,type:i.type})).slice(0,10) : listBody) : listBody }
    });
  } catch (e) {
    res.status(500).json({ ok:false, error: e.message });
  }
}
