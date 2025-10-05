// pages/api/upload.js
// Minimal JSON upload: { path: "public/media/uploads/...", contentBase64: "...", message?: "commit msg" }

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Use POST' });

    const { path, contentBase64, message } = req.body || {};
    if (!path || !contentBase64) return res.status(400).json({ ok:false, error:'Missing path or contentBase64' });

    const owner  = process.env.REPO_OWNER || process.env.GH_OWNER;
    const repo   = process.env.REPO_NAME  || process.env.GITHUB_REPO || 'Admin-esxape-ride';
    const token  = process.env.GITHUB_TOKEN;
    const branch = process.env.GITHUB_BRANCH || 'main';
    const baseDir = (process.env.GITHUB_BASE_DIR || '').replace(/^\/+|\/+$/g,'');

    if (!owner || !repo || !token) {
      return res.status(500).json({ ok:false, error:'Missing GitHub env (REPO_OWNER, REPO_NAME, GITHUB_TOKEN)' });
    }

    const fullPath = baseDir ? `${baseDir}/${path}` : path;

    // Lookup SHA if file exists
    const headUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(fullPath)}?ref=${branch}`;
    let sha;
    const head = await fetch(headUrl, {
      headers:{ Authorization:`Bearer ${token}`, Accept:'application/vnd.github+json' }
    });
    if (head.ok) {
      const j = await head.json();
      sha = j.sha;
    }

    // Put file
    const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(fullPath)}`;
    const put = await fetch(putUrl, {
      method:'PUT',
      headers:{ Authorization:`Bearer ${token}`, Accept:'application/vnd.github+json' },
      body: JSON.stringify({
        message: message || `upload ${path}`,
        content: contentBase64,
        branch,
        sha
      }),
    });

    const jr = await put.json();
    if (!put.ok) {
      return res.status(put.status).json({ ok:false, error: jr?.message || 'upload failed', response: jr });
    }

    return res.status(200).json({ ok:true, path, html_url: jr?.content?.html_url });
  } catch (e) {
    return res.status(500).json({ ok:false, error: String(e) });
  }
}
