// pages/api/game.js
import { ghEnv, ghHeaders, resolveBranch } from './_gh-helpers';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { slug = 'default', channel = 'published' } = req.query;

    const { token, owner, repo, branch } = ghEnv();
    const ref = await resolveBranch({ token, owner, repo, branch });

    const path = slug === 'default'
      ? 'public/missions.json'
      : `public/games/${slug}/missions.json`;

    // Recommit identical content to create a "publish" commit & version stamp
    const read = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`,
      { headers: ghHeaders(token), cache: 'no-store' }
    );
    if (!read.ok) return res.status(404).json({ ok: false, error: 'missions.json not found (save first)' });
    const file = await read.json();

    const put = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: ghHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        message: `publish ${slug} → ${channel} via Admin UI`,
        content: file.content,
        sha: file.sha,
        branch: ref,
      }),
    });
    if (!put.ok) return res.status(put.status).json({ ok: false, error: await put.text() });

    res.json({ ok: true, version: new Date().toISOString().replace('T', ' ').slice(0, 19) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
