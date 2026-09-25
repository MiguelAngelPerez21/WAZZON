import { isSupabaseConfigured } from '@/lib/env';
import { logger } from '@/lib/logger';
import { supabasePublic } from '@/lib/supabase/public';
import { settingsSchema, type SettingsInput } from '@/validation/settings';

/**
 * Site settings.
 *
 * Branding and behaviour live in the database, never hard-coded in components,
 * so they can be changed without a deploy. No secret is ever stored here: the
 * table is publicly readable by design.
 */

export const DEFAULT_SETTINGS: SettingsInput = {
  site_name: 'Hallazgo',
  site_description: 'Descubre productos y ofertas seleccionadas una a una.',
  logo_url: null,
  affiliate_disclosure:
    'Algunos enlaces de esta web son enlaces de afiliado. Si realizas una compra a través ' +
    'de ellos, podemos recibir una comisión sin coste adicional para ti.',
  default_currency: 'EUR',
  default_market: 'ES',
  outbound_tracking_mode: 'direct',
};

function coerceSettings(rows: { key: string; value: unknown }[]): SettingsInput {
  const raw: Record<string, unknown> = { ...DEFAULT_SETTINGS };

  for (const row of rows) {
    if (row.key in DEFAULT_SETTINGS) {
      raw[row.key] = row.value;
    }
  }

  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn('settings.invalid_row', { issues: parsed.error.issues.map((i) => i.path) });
    return DEFAULT_SETTINGS;
  }

  return parsed.data;
}

export async function getSettings(): Promise<SettingsInput> {
  if (!isSupabaseConfigured) return DEFAULT_SETTINGS;

  const { data, error } = await supabasePublic.from('settings').select('key, value');

  if (error) {
    logger.error('settings.read_failed', { error });
    return DEFAULT_SETTINGS;
  }

  return coerceSettings(data ?? []);
}
