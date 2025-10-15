// middleware.js
import { NextResponse } from 'next/server';

export function middleware(req) {
  // Global bypass when the toggle is on
  if (process.env.AUTH_DISABLE === '1') {
    return NextResponse.next();
  }

  // Keep or add your real auth checks below if you have them.
  // Example (pseudocode):
  // const isLoggedIn = req.cookies.get('session')?.value;
  // if (!isLoggedIn && req.nextUrl.pathname !== '/login') {
  //   const url = req.nextUrl.clone();
  //   url.pathname = '/login';
  //   return NextResponse.redirect(url);
  // }

  return NextResponse.next();
}

// Guard everything except Next internals & public assets.
export const config = {
  matcher: ['/((?!_next|static|favicon.ico|api/public).*)'],
};
