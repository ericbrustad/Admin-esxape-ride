// pages/api/upload-url.js
export const config = { api: { bodyParser: { sizeLimit: '32mb' } } };
export const runtime = 'nodejs';

import { ghEnv, resolveBranch, ghHeaders } from './_gh-helpers';

const EXT_FROM_MIME = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp',
  'image/gif': '.gif', 'image/svg+xml': '.svg',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
  'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/ogg': '.ogg', 'audio/mp4': '.m4a',
};

function classify(mimeOrName='') {
  const s = String(mimeOrName).toLowerCase();
  if (s.includes('gif') || /\.gif(\?|$)/.test(s)) return 'gif';
  if (s.startsWith('image/') || /\.(png|jpe?g|webp|svg)(\?|$)/.test(s)) return 'image';
  if (s.startsWith('video/') || /\.(mp4|webm|mov)(\?|$)/.test(s)) return 'video';
  if (s.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)(\?|$)/.test(s)) return 'audio';
  return 'image'; // sensible default for unknown images
}

function safeBase(name='file') {
  return name.replace(/[^\w.\-]+/g, '-').replace(/^-+|-+$/g, '');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Use POST' });
  try {
    const { url, name } = req.body || {};
    if (!url) return res.status(400).json({ ok:false, error:'Missing url' });

    // fetch the remote asset
    const r = await fetch(url, { headers: { 'User-Agent': 'EsxAdmin/1.0' } });
    if (!r.ok) return res.status(r.status).json({ ok:false, error:`Fetch failed (${r.status})` });
    const buf = Buffer.from(await r.arrayBuffer());

    const mime = r.headers.get('content-type') || '';
    const type = classify(mime || url);
    const ext  = EXT_FROM_MIME[mime] || (url.match(/\.[a-z0-9]+(?=$|\?)/i)?.[0] ?? '');
    const base = safeBase(name || url.split('/').pop() || `file${ext || ''}`);
    const filename = `${Date.now()}-${base}${ext || ''}`;

    const { token, owner, repo, branch } = ghEnv();
    const ref = await resolveBranch({ token, owner, repo, branch });

    const path = `public/media/uploads/${type}/${filename}`;
    const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

    // include sha if exists (overwrite)
    let sha;
    const head = await fetch(`${putUrl}?ref=${encodeURIComponent(ref)}`, { headers: ghHeaders(token) });
    if (head.ok) { const h = await head.json(); sha = h.sha; }

    const body = {
      message: `upload-from-url ${filename}`,
      content: buf.toString('base64'),
      ...(sha ? { sha } : {}),
      branch: ref,
    };

    const put = await fetch(putUrl, {
      method: 'PUT',
      headers: ghHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });

    if (!put.ok) return res.status(put.status).json({ ok:false, error: await put.text() });

    return res.status(200).json({
      ok: true,
      url: `/${path.replace(/^public\//, '')}`, // e.g. /media/uploads/image/1234-file.png
      type,
      path,
    });
  } catch (e) {
    return res.status(500).json({ ok:false, error: e?.message || String(e) });
  }
}
