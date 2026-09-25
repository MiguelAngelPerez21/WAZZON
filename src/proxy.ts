import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { isSupabaseConfigured, publicEnv } from '@/lib/env';

/**
 * Refreshes the Supabase session cookie on every request and performs a first,
 * cheap authentication check for `/admin/*`.
 *
 * This is the Next.js "proxy" convention (formerly `middleware.ts`). It is a
 * convenience layer, NOT the security boundary: every admin route, layout and
 * server action re-checks authorization server-side (see `requireAdmin`), and
 * RLS enforces it again in the database.
 */
export default async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLoginRoute = pathname === '/admin/login';

  if (!user && pathname.startsWith('/admin') && !isLoginRoute) {
    const loginUrl = new URL('/admin/login', request.url);
    // Only a path is ever propagated, never an absolute URL: no open redirect.
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isLoginRoute) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
