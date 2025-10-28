/**
 * CODEx NOTE (2025-10-28): Robust Vercel status checker for the Admin footer/banner.
 * - Accepts VERCEL_TOKEN or VERCEL_API_TOKEN.
 * - Accepts project id from ?projectId=, or envs:
 *     VERCEL_PROJECT_ID_GAME, VERCEL_PROJECT_ID_ADMIN, VERCEL_PROJECT_ID (fallback).
 * - If ?project=game but GAME id is missing, falls back to Admin id so the UI doesn't show false errors.
 * - Returns { ok, state, url } on success, or { ok:false, error, missing:{...} } with booleans (no secrets).
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const TOKEN =
    process.env.VERCEL_API_TOKEN ||
    process.env.VERCEL_TOKEN || '';

  const teamId =
    process.env.VERCEL_TEAM_ID ||
    process.env.VERCEL_ORG_ID || '';

  // What caller asked for: 'admin' | 'game' | '' (default admin)
  const projectHint = String(req.query.project || req.query.p || 'admin').toLowerCase();

  // Direct override via query (?projectId=...)
  const fromQuery = (req.query.projectId && String(req.query.projectId).trim()) || '';

  // Env candidates (try the most specific first)
  const pidGame  = process.env.VERCEL_PROJECT_ID_GAME  || '';
  const pidAdmin = process.env.VERCEL_PROJECT_ID_ADMIN || '';
  const pidAny   = process.env.VERCEL_PROJECT_ID       || '';

  // Choose project id:
  let PROJECT_ID = fromQuery
    || (projectHint === 'game'  ? (pidGame  || pidAdmin || pidAny) : '')
    || (projectHint === 'admin' ? (pidAdmin || pidAny) : '')
    || pidAny
    || pidAdmin
    || pidGame;

  // Diagnostics when something is missing (no secrets)
  if (!TOKEN || !PROJECT_ID) {
    return res.status(200).json({
      ok: false,
      error: 'Missing VERCEL_TOKEN (or VERCEL_API_TOKEN) or project id',
      missing: {
        token: !TOKEN,
        projectId: !PROJECT_ID,
        // Extra hints:
        expects: {
          query_projectId: Boolean(fromQuery),
          project_hint: projectHint,
          env_pid_game: Boolean(pidGame),
          env_pid_admin: Boolean(pidAdmin),
          env_pid_any: Boolean(pidAny),
          teamId_present: Boolean(teamId),
        }
      }
    });
  }

  try {
    const qs = new URLSearchParams({ projectId: PROJECT_ID, limit: '1' });
    if (teamId) qs.set('teamId', teamId);
    const r = await fetch(`https://api.vercel.com/v13/deployments?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      // Make errors actionable but safe
      const msg = (j?.error?.message || `Vercel API ${r.status}`);
      return res.status(200).json({ ok: false, error: msg, apiStatus: r.status });
    }

    // v13 may return { deployments: [...] } or an array in some cases
    const list = Array.isArray(j?.deployments) ? j.deployments : (Array.isArray(j) ? j : []);
    const latest = list[0] || null;

    const rawUrl = latest?.url || '';
    const url = rawUrl ? (rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`) : '';

    return res.status(200).json({
      ok: true,
      state: latest?.readyState || latest?.state || 'unknown',
      url,
      projectId: PROJECT_ID,
      teamId: teamId || null,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(200).json({ ok: false, error: error?.message || 'Vercel status fetch failed' });
  }
}
