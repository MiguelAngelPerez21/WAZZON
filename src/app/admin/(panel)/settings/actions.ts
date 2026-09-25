'use server';

import { revalidatePath } from 'next/cache';

import { errorState, successState, type ActionState } from '@/lib/action-state';
import { requireAdmin } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { settingsSchema } from '@/validation/settings';

function text(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

export async function saveSettingsAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = settingsSchema.safeParse({
    site_name: text(formData, 'site_name'),
    site_description: text(formData, 'site_description'),
    logo_url: text(formData, 'logo_url') || null,
    affiliate_disclosure: text(formData, 'affiliate_disclosure'),
    default_currency: text(formData, 'default_currency'),
    default_market: text(formData, 'default_market'),
    outbound_tracking_mode: text(formData, 'outbound_tracking_mode'),
  });

  if (!parsed.success) {
    return errorState('Revisa los campos marcados.', parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();

  // Settings are a key/value table, so one upsert per key.
  const rows = Object.entries(parsed.data).map(([key, value]) => ({ key, value }));
  const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });

  if (error) {
    logger.error('settings.save_failed', { error });
    return errorState('No se ha podido guardar la configuración.');
  }

  revalidatePath('/', 'layout');
  revalidatePath('/admin', 'layout');
  return successState('Configuración guardada.');
}
