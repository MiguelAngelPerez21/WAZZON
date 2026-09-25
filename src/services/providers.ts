import 'server-only';

import { logger } from '@/lib/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Slug of the only marketplace this site publishes.
 *
 * The database keeps the full multi-provider model (`providers` table,
 * `offers.provider_id` FK, public "tienda" filter). What changed is the *admin
 * UX*: the editor no longer picks a store, so the write path resolves it here.
 * Supporting a second marketplace later means re-exposing the selector and
 * passing an explicit id to the product service — nothing schema-level.
 */
export const DEFAULT_PROVIDER_SLUG = 'temu';

const DEFAULT_PROVIDER = {
  name: 'Temu',
  slug: DEFAULT_PROVIDER_SLUG,
  domains: ['temu.com', 'www.temu.com', 'm.temu.com'],
  allows_redirect_tracking: false,
  active: true,
};

export class DefaultProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DefaultProviderError';
  }
}

/**
 * Resolves the id of the Temu provider, creating the row if a database was
 * migrated before it existed.
 *
 * Creation is an upsert on the unique `slug`, so concurrent requests can never
 * produce a duplicate: the second one resolves to the row the first inserted.
 */
export async function resolveDefaultProviderId(): Promise<string> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('providers')
    .select('id')
    .eq('slug', DEFAULT_PROVIDER_SLUG)
    .maybeSingle();

  if (error) {
    logger.error('providers.default_lookup_failed', { error });
    throw new DefaultProviderError('No se ha podido determinar la tienda por defecto.');
  }

  if (data) return data.id;

  logger.warn('providers.default_missing', { slug: DEFAULT_PROVIDER_SLUG });

  const { data: created, error: upsertError } = await supabase
    .from('providers')
    .upsert(DEFAULT_PROVIDER, { onConflict: 'slug' })
    .select('id')
    .single();

  if (upsertError || !created) {
    logger.error('providers.default_create_failed', { error: upsertError });
    throw new DefaultProviderError(
      'Falta la tienda por defecto (Temu) y no se ha podido crear. Aplica las migraciones de Supabase.',
    );
  }

  return created.id;
}
