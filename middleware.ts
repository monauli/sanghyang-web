import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/admin/session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (pathname === '/panel-sanghyang/login') {
    // Sudah login tapi buka halaman login lagi -> langsung ke dashboard.
    if (session) return NextResponse.redirect(new URL('/panel-sanghyang', request.url));
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL('/panel-sanghyang/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/panel-sanghyang/:path*',
};
