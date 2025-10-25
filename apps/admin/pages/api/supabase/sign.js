export default async function handler(req, res) {
  try {
    const baseUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
    const srk = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const bucket = (req.query.bucket || process.env.SUPABASE_MEDIA_BUCKET || '').toString().trim();
    const path = (req.query.path || '').toString().trim();
    const expiresIn = Math.max(10, Math.min(60 * 60, Number(req.query.expiresIn || 300))); // default 5 min

    if (!baseUrl || !srk) return res.status(400).json({ ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
    if (!bucket || !path) return res.status(400).json({ ok: false, error: 'Provide ?bucket= & ?path=' });

    const url = `${baseUrl}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${srk}`,
        apikey: srk,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn }),
    });

    const data = await r.json().catch(() => null);
    if (!r.ok || !data?.signedURL) {
      return res.status(200).json({ ok: false, error: data?.message || data || `HTTP ${r.status}` });
    }

    // Supabase returns a relative /object/sign/... path — make it absolute
    return res.status(200).json({ ok: true, url: `${baseUrl}${data.signedURL}`, expiresIn });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
