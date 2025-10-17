import { fetchDirectoryRecords, getSupabaseHealth, getSupabaseRestConfig } from '../../lib/supabase-directory.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { health, limit } = req.query || {};
  const { table } = getSupabaseRestConfig();

  if (health === '1') {
    const status = await getSupabaseHealth();
    const statusCode = status.ok ? 200 : 503;
    return res.status(statusCode).json({ ...status, table });
  }

  let limitNumber = 50;
  if (typeof limit === 'string' && limit.trim()) {
    const parsed = Number.parseInt(limit, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      limitNumber = Math.min(parsed, 500);
    }
  }

  const result = await fetchDirectoryRecords({ limit: limitNumber });
  const statusCode = result.ok ? 200 : result.reason === 'missing-credentials' ? 400 : 502;

  return res.status(statusCode).json({ ...result, table, limit: limitNumber });
}
