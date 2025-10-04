// pages/api/save-config.js
export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('POST only');
  const url = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/save${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: req.body?.config }) });
  const t = await r.text();
  res.status(r.status).send(t);
}
