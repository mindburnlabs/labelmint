import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAccessToken } from './lib/auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow access to auth pages
  if (pathname.startsWith('/auth')) {
    return NextResponse.next();
  }

  // Allow access to API routes (they handle their own auth)
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Check for admin access token
  const token = getAccessToken();

  if (!token && !pathname.startsWith('/auth')) {
    // Redirect to login if no token and not on auth page
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};