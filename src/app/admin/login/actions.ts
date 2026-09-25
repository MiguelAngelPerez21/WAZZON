'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { errorState, safeInternalPath, type ActionState } from '@/lib/action-state';
import { logger } from '@/lib/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const credentialsSchema = z.object({
  email: z.string().trim().email('Introduce un correo válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
  next: z.string().optional(),
});

export async function signInAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next'),
  });

  if (!parsed.success) {
    return errorState('Revisa los datos introducidos.', parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Deliberately generic: never reveal whether the account exists.
    logger.warn('auth.sign_in_failed', { reason: error.message });
    return errorState('Credenciales incorrectas.');
  }

  redirect(safeInternalPath(parsed.data.next, '/admin'));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}
