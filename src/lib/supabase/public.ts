import { createClient } from '@supabase/supabase-js';

import { publicEnv } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Anonymous, cookie-less client for public content.
 *
 * Using it (instead of the cookie-bound server client) keeps public pages
 * statically renderable/cacheable, and guarantees that visitors always see
 * exactly what RLS exposes to the `anon` role — an admin session can never
 * accidentally leak draft content into a cached public page.
 */
export const supabasePublic = createClient<Database>(
  publicEnv.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-key-placeholder',
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'affiliate-commerce-platform' } },
  },
);
