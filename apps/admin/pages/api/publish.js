// apps/admin/pages/api/publish.js
import { ghGet, upsertJson, joinPath } from '../../lib/github';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { slug } = req.body || {};
    if (!slug) return res.status(400).json({ error: 'Missing slug' });

    const srcBase = joinPath('public/games', slug, 'draft');
    const dstBase = joinPath('public/games', slug);

    const read = async (p) => {
      const r = await ghGet(p);
      if (r.status !== 200 || !r.data || r.data.type !== 'file') return null;
      // r.data.content is base64; decode
      const buff = Buffer.from(r.data.content || '', 'base64');
      try { return JSON.parse(buff.toString('utf8')); } catch { return null; }
    };

    const cfg = await read(joinPath(srcBase, 'config.json'));
    const mis = await read(joinPath(srcBase, 'missions.json'));

    const results = [];
    if (cfg) results.push(await upsertJson(joinPath(dstBase, 'config.json'), cfg, `publish(config): ${slug}`));
    if (mis) results.push(await upsertJson(joinPath(dstBase, 'missions.json'), mis, `publish(missions): ${slug}`));

    return res.status(200).json({ ok: true, results });
  } catch (err) {
    console.error('publish error:', err);
    return res.status(500).json({ error: String(err && err.message || err) });
  }
}
