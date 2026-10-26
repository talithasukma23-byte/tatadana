import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Proteksi server-side seluruh rute Admin Portal (/admin)
  if (pathname.startsWith('/admin')) {
    const sessionCookie = req.cookies.get('tatadana_session')?.value;

    if (!sessionCookie) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      const rawVal = sessionCookie.trim().replace(/^"|"$/g, '');
      let jsonStr = '';
      try {
        jsonStr = Buffer.from(rawVal, 'base64').toString('utf-8');
      } catch {
        jsonStr = rawVal;
      }

      const session = JSON.parse(jsonStr);
      const role = session?.role;

      // HANYA superadmin atau admin yang berhak membuka halaman /admin
      if (role !== 'superadmin' && role !== 'admin') {
        const dashboardUrl = new URL('/dashboard', req.url);
        return NextResponse.redirect(dashboardUrl);
      }
    } catch {
      const loginUrl = new URL('/login', req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
