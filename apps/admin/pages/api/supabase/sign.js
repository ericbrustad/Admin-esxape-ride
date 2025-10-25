const allowedMethods = new Set(['GET']);

export default async function handler(req, res) {
  if (!allowedMethods.has(req.method)) {
    res.setHeader('Allow', Array.from(allowedMethods));
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const debug = req.query.debug === '1';

  try {
    const rawUrl = process.env.SUPABASE_URL || '';
    const baseUrl = rawUrl.trim().replace(/\/+$/, '');
    const srk = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const bucket = (req.query.bucket || process.env.SUPABASE_MEDIA_BUCKET || '').toString().trim();
    const path = (req.query.path || '').toString().trim().replace(/^\/+/, '');
    const expiresIn = Math.max(10, Math.min(3600, Number(req.query.expiresIn ?? 300))); // default 5 min

    if (!baseUrl || !srk) {
      return res.status(400).json({
        ok: false,
        error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
        ...(debug ? { hasUrl: !!baseUrl, hasSrk: !!srk, srkLen: srk.length || 0, rawUrl } : {}),
      });
    }

    if (!bucket || !path) {
      return res.status(400).json({ ok: false, error: 'Provide ?bucket= & ?path=' });
    }

    const url = `${baseUrl}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}`;

    let data = null;
    let text = null;

    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${srk}`,
          apikey: srk,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn }),
      });

      text = await r.text();
      data = text ? (JSON.parse.bind(JSON))(text) : null;

      if (!r.ok || !data?.signedURL) {
        return res.status(200).json({
          ok: false,
          error: (data && (data.message || data.error)) || text || `HTTP ${r.status}`,
          ...(debug ? { bucket, path, expiresIn } : {}),
        });
      }
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: e.message,
        ...(debug ? { bucket, path, expiresIn, baseUrl } : {}),
      });
    }

    // Supabase returns a relative /object/sign/... path — make it absolute
    return res.status(200).json({ ok: true, url: `${baseUrl}${data.signedURL}`, expiresIn });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message, ...(debug ? { stack: e.stack } : {}) });
  }
}
