import { NextResponse } from 'next/server';

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|api/admin-protection).*)',
  ],
};

const REALM = 'Esx Admin';
const USER = process.env.BASIC_AUTH_USER || 'Eric';
const PASS = process.env.BASIC_AUTH_PASS || 'someStrongPassword';
const DEFAULT_PROTECTED = (() => {
  const raw = process.env.ADMIN_PASSWORD_PROTECTED ?? process.env.ADMIN_PROTECTED ?? '0';
  return raw === '1' || raw?.toString().toLowerCase() === 'true';
})();

let cachedFlag = DEFAULT_PROTECTED;
let cachedAt = 0;
const CACHE_MS = 10_000;

function unauthorized() {
  return new NextResponse('Auth required', {
    status: 401,
    headers: { 'WWW-Authenticate': `Basic realm="${REALM}"` },
  });
}

async function loadProtectionFlag(request) {
  const now = Date.now();
  if (now - cachedAt < CACHE_MS) return cachedFlag;
  try {
    const url = new URL('/api/admin-protection', request.url);
    url.searchParams.set('mode', 'edge');
    const res = await fetch(url.toString(), { cache: 'no-store', method: 'GET' });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (typeof data?.protected === 'boolean') {
        cachedFlag = data.protected;
        cachedAt = now;
        return cachedFlag;
      }
    }
  } catch (err) {
    // ignore network errors and fall back to default
  }
  cachedFlag = DEFAULT_PROTECTED;
  cachedAt = now;
  return cachedFlag;
}

export async function middleware(request) {
  const needsProtection = await loadProtectionFlag(request);
  if (!needsProtection) {
    return NextResponse.next();
  }

  const auth = request.headers.get('authorization') || '';
  const [scheme, encoded] = auth.split(' ');
  if (scheme !== 'Basic' || !encoded) return unauthorized();
  try {
    const decoded = globalThis.atob(encoded);
    const idx = decoded.indexOf(':');
    if (idx < 0) return unauthorized();
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);
    if (user === USER && pass === PASS) return NextResponse.next();
  } catch (err) {
    return unauthorized();
  }
  return unauthorized();
}
