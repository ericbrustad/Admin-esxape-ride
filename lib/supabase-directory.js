// lib/supabase-directory.js
// Helper utilities for talking to Supabase's REST API without shipping the full SDK.
// The helpers only run on the server (API routes) so service keys never leak.

const DEFAULT_DIRECTORY_TABLE = process.env.SUPABASE_DIRECTORY_TABLE || 'directories';

function readEnv(name) {
  try {
    if (typeof process === 'undefined' || !process.env) return '';
    return process.env[name] || '';
  } catch {
    return '';
  }
}

export function getSupabaseRestConfig() {
  const url = readEnv('SUPABASE_URL') || readEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY') || readEnv('SUPABASE_SERVICE_KEY');
  const anonKey = readEnv('SUPABASE_ANON_KEY') || readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  return {
    url: typeof url === 'string' ? url.trim().replace(/\/$/, '') : '',
    serviceKey: typeof serviceKey === 'string' ? serviceKey.trim() : '',
    anonKey: typeof anonKey === 'string' ? anonKey.trim() : '',
    table: DEFAULT_DIRECTORY_TABLE,
  };
}

function ensureFetch() {
  if (typeof fetch !== 'function') {
    throw new Error('Global fetch API is unavailable in this runtime');
  }
}

export async function supabaseRest({ path, method = 'GET', headers = {}, body, signal, useServiceKey = true }) {
  ensureFetch();
  const config = getSupabaseRestConfig();
  const key = useServiceKey ? config.serviceKey : config.anonKey;

  if (!config.url || !key) {
    return {
      ok: false,
      status: 'missing-credentials',
      error: 'Supabase URL or key missing',
      response: null,
    };
  }

  const endpoint = `${config.url}${path.startsWith('/') ? '' : '/'}${path}`;
  const requestInit = {
    method,
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Accept': 'application/json',
      ...headers,
    },
    signal,
  };

  if (body !== undefined) {
    if (typeof body === 'string' || body instanceof Uint8Array) {
      requestInit.body = body;
    } else {
      requestInit.body = JSON.stringify(body);
      requestInit.headers['Content-Type'] = requestInit.headers['Content-Type'] || 'application/json';
    }
  }

  const response = await fetch(endpoint, requestInit);
  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text().catch(() => null);
  }

  if (!response.ok) {
    return {
      ok: false,
      status: 'http-error',
      error: data?.message || data?.error || response.statusText || 'Supabase request failed',
      statusCode: response.status,
      data,
    };
  }

  return {
    ok: true,
    status: 'ok',
    statusCode: response.status,
    data,
  };
}

export async function fetchDirectoryRecords({ limit = 50 } = {}) {
  const config = getSupabaseRestConfig();
  if (!config.url || !config.serviceKey) {
    return {
      ok: false,
      reason: 'missing-credentials',
      data: [],
      error: 'Supabase service role key missing; configure SUPABASE_SERVICE_ROLE_KEY.',
      checkedAt: new Date().toISOString(),
    };
  }

  const tableName = config.table;
  const query = new URLSearchParams({
    select: '*',
    order: 'updated_at.desc',
  });
  if (limit > 0) {
    query.set('limit', String(limit));
  }
  const path = `/rest/v1/${encodeURIComponent(tableName)}?${query.toString()}`;
  const response = await supabaseRest({ path });

  if (!response.ok) {
    const statusCode = response.statusCode || 0;
    const detail = typeof response.data === 'object' && response.data !== null ? response.data : {};
    const detailCode = detail.code || detail.error || '';

    if (statusCode === 404 || detailCode === 'PGRST116') {
      return {
        ok: false,
        reason: 'table-missing',
        data: [],
        error: 'Supabase directories table missing. Create the table before syncing.',
        detail: detail,
        checkedAt: new Date().toISOString(),
      };
    }

    if (statusCode === 401 || statusCode === 403) {
      return {
        ok: false,
        reason: 'unauthorized',
        data: [],
        error: 'Supabase rejected the credentials supplied.',
        detail,
        checkedAt: new Date().toISOString(),
      };
    }

    return {
      ok: false,
      reason: 'request-failed',
      data: [],
      error: response.error || 'Supabase request failed.',
      detail,
      checkedAt: new Date().toISOString(),
    };
  }

  const rows = Array.isArray(response.data) ? response.data : [];

  return {
    ok: true,
    reason: 'ok',
    data: rows,
    checkedAt: new Date().toISOString(),
  };
}

export async function getSupabaseHealth() {
  const config = getSupabaseRestConfig();
  if (!config.url || !config.serviceKey) {
    return {
      ok: false,
      status: 'missing-credentials',
      message: 'Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable directory sync.',
      checkedAt: new Date().toISOString(),
    };
  }

  const result = await fetchDirectoryRecords({ limit: 1 });
  if (result.ok) {
    return {
      ok: true,
      status: 'connected',
      message: `Supabase reachable — fetched ${result.data.length} record(s).`,
      checkedAt: result.checkedAt,
    };
  }

  return {
    ok: false,
    status: result.reason,
    message: result.error,
    detail: result.detail,
    checkedAt: result.checkedAt,
  };
}
