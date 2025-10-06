// pages/api/list-media.js
function classify(url) {
  const s = url.toLowerCase();
  if (/\.(png|jpg|jpeg|webp)$/.test(s)) return 'image';
  if (/\.(gif)$/.test(s)) return 'gif';
  if (/\.(mp4|webm|mov)$/.test(s)) return 'video';
  if (/\.(mp3|wav|ogg|m4a)$/.test(s)) return 'audio';
  return 'other';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const requested = String(req.query.dir || '').replace(/[^a-z0-9_-]/gi, '');
    const dir = ['uploads', 'bundles', 'icons'].includes(requested) ? requested : 'uploads';

    const token  = process.env.GITHUB_TOKEN;
    const user   = process.env.GITHUB_USER;
    const repo   = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';

    const basePath = `public/media/${dir}`;
    const url = `https://api.github.com/repos/${user}/${repo}/contents/${basePath}?ref=${branch}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (!r.ok) return res.status(200).json({ items: [] });

    const arr = await r.json();
    const items = (Array.isArray(arr) ? arr : [])
      .filter(it => it.type === 'file')
      .map(it => {
        const urlPath = `/media/${dir}/${it.name}`;
        return { name: it.name, url: urlPath, type: classify(it.name) };
      });

    res.status(200).json({ items });
  } catch {
    res.status(200).json({ items: [] });
  }
}
