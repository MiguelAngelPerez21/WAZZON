import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { assertSupabaseConfigured, publicEnv } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Server-side Supabase client bound to the request cookies.
 *
 * Every query made through it is subject to Row Level Security under the
 * identity of the signed-in user (or `anon` when there is none).
 */
export async function createSupabaseServerClient() {
  // Fail with an actionable message instead of the opaque supabase-js one.
  assertSupabaseConfigured();

  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component: cookies are read-only there.
            // The middleware refreshes the session instead.
          }
        },
      },
    },
  );
}
