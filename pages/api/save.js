export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';
  const filePath = 'public/missions.json';
  if (!token || !repo) return res.status(500).send('Missing GITHUB_TOKEN or GITHUB_REPO');
  try {
    const body = req.body || {}; const missions = body.missions;
    if (!missions || typeof missions !== 'object') return res.status(400).send('Invalid payload: expected { missions }');
    const content = Buffer.from(JSON.stringify(missions, null, 2)).toString('base64');
    const getUrl = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`;
    const getResp = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}`, 'Accept': 'application/vnd.github+json' } });
    let sha = undefined; if (getResp.ok) { const data = await getResp.json(); sha = data.sha; }
    const putUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
    const commitMessage = `chore: update missions.json via admin (${new Date().toISOString()})`;
    const putResp = await fetch(putUrl, { method:'PUT', headers:{ Authorization:`Bearer ${token}`, 'Accept':'application/vnd.github+json', 'Content-Type':'application/json' },
      body: JSON.stringify({ message:commitMessage, content, sha, branch }) });
    if (!putResp.ok) { const t = await putResp.text(); return res.status(500).send('GitHub update failed: '+t); }
    const result = await putResp.json(); return res.status(200).send({ ok:true, commit: result.commit?.sha });
  } catch (e) { return res.status(500).send(String(e?.message || e)); }
}