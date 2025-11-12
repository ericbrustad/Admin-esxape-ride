// apps/admin/pages/api/diag-save.js
// Purpose: One-file, non-UI diagnostic to pinpoint why game saves to Supabase are failing.
// Usage:
//   1) Add this file to the copy branch at the exact path above.
//   2) Run locally or deploy, then open /api/diag-save in your browser.
//   3) Paste the JSON result back to me; it will reveal env/key issues, RLS issues, and upsert failures.
// Notes:
//   • Does NOT modify your UI or DB (it inserts a temporary row and deletes it if service role is present).
//   • Requires @supabase/supabase-js to be installed in the workspace that builds this API route.
//   • Looks for tables: games, missions, devices. Adjust list at TABLES if your naming differs.

import { createClient } from '@supabase/supabase-js'

function tail(v, n = 6) {
  if (!v) return 'missing'
  return `…${String(v).slice(-n)}`
}

function assertEnv(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env: ${name}`)
  return v
}

function serializeError(err) {
  if (!err) return null
  const out = {
    message: err.message || String(err),
  }
  if (err.code) out.code = err.code
  if (err.details) out.details = err.details
  if (err.hint) out.hint = err.hint
  return out
}

const TABLES = ['games', 'missions', 'devices']

export default async function handler(req, res) {
  const started = new Date().toISOString()
  const report = { ok: false, started, checks: [], env: {}, advice: [] }
  const add = (ok, step, info = null) => report.checks.push({ ok, step, info })

  try {
    // 1) Validate env
    const url = assertEnv('NEXT_PUBLIC_SUPABASE_URL')
    const anon = assertEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY || null

    report.env.NEXT_PUBLIC_SUPABASE_URL = url
    report.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = tail(anon)
    report.env.SUPABASE_SERVICE_ROLE_KEY = service ? tail(service) : 'missing'
    add(true, 'env:found', {
      url_host: url.replace(/^https?:\/\//, '').split('/')[0],
      anon_tail: tail(anon),
      service_tail: service ? tail(service) : 'missing',
    })

    // 2) Create anon client & basic read checks (proves URL/anon + RLS for selects)
    const anonClient = createClient(url, anon, { auth: { persistSession: false } })
    add(true, 'client:anon:created')

    for (const t of TABLES) {
      const { data, error } = await anonClient.from(t).select('id').limit(1)
      add(!error, `anon:select(${t})`, error ? serializeError(error) : { rows: data?.length || 0 })
      if (error && /permission denied|RLS/.test(error.message || '')) {
        report.advice.push(`RLS likely blocks anon SELECT on ${t}. Either adjust policies or ensure reads happen via an API route with service role.`)
      }
    }

    // 3) If service role is present, attempt a transactional-ish upsert into games
    if (service) {
      const srv = createClient(url, service, { auth: { persistSession: false } })
      add(true, 'client:service:created')

      const slug = `diag-${Date.now()}`
      const payload = {
        slug,
        title: 'Diag Save',
        updated_at: new Date().toISOString(),
      }

      const { data: up, error: upErr } = await srv
        .from('games')
        .upsert(payload, { onConflict: 'slug' })
        .select('id, slug, title')
        .maybeSingle()

      add(!upErr, 'service:upsert(games)', upErr ? serializeError(upErr) : up)

      if (upErr) {
        // Common hints
        const msg = (upErr.message || '').toLowerCase()
        if (msg.includes('column') && msg.includes('slug')) {
          report.advice.push('Check that public.games has a slug column, and that it is included in the insert payload.')
        }
        if (msg.includes('on conflict')) {
          report.advice.push("Add a UNIQUE INDEX on games.slug or change onConflict to your unique key (e.g., id). Example SQL: CREATE UNIQUE INDEX IF NOT EXISTS idx_games_slug ON public.games(slug);")
        }
        if (msg.includes('permission')) {
          report.advice.push('Even with service role, permission errors can happen if you point to the wrong project URL/key. Verify keys and project.')
        }
      } else {
        // Clean up the test row so we don’t leave noise
        await srv.from('games').delete().eq('slug', slug)
        add(true, 'service:cleanup(games)', { slug })
      }
    } else {
      add(false, 'service:upsert(games)', 'skipped (no SUPABASE_SERVICE_ROLE_KEY)')
      report.advice.push('Set SUPABASE_SERVICE_ROLE_KEY in Vercel/Local for API routes; never expose it to the browser.')
    }

    // 4) Extra: check body size limit hint for large saves
    add(true, 'api:bodyParser:default', 'If game saves are large, consider adding export const config = { api: { bodyParser: { sizeLimit: "2mb" } } } to your save route.')

    report.ok = true
    return res.status(200).json(report)
  } catch (e) {
    add(false, 'exception', serializeError(e))
    report.ok = false
    return res.status(500).json(report)
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
}
