import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AppRole } from '@/types/database';

export interface AdminIdentity {
  userId: string;
  email: string;
  fullName: string | null;
  role: AppRole;
}

/**
 * Resolves the current session and profile.
 *
 * `getUser()` (not `getSession()`) is used on purpose: it re-validates the JWT
 * against Supabase Auth instead of trusting a cookie that a client could have
 * tampered with.
 *
 * Wrapped in `cache()` so a single request performs one validation even when
 * several layouts/pages ask for it.
 */
export const getCurrentIdentity = cache(async (): Promise<AdminIdentity | null> => {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) return null;

  return {
    userId: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
  };
});

export async function isAdmin(): Promise<boolean> {
  const identity = await getCurrentIdentity();
  return identity?.role === 'admin';
}

/**
 * Server-side guard for every admin route, layout and server action.
 * Authorization is enforced here *and* by RLS in the database — the UI hiding
 * a button is never the security boundary.
 */
export async function requireAdmin(): Promise<AdminIdentity> {
  const identity = await getCurrentIdentity();

  if (!identity) {
    redirect('/admin/login');
  }

  if (identity.role !== 'admin') {
    redirect('/admin/login?error=forbidden');
  }

  return identity;
}
