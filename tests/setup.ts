/**
 * Vitest global setup.
 *
 * Provides deterministic public env values so modules that read them at import
 * time behave the same on every machine and in CI.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
process.env.NEXT_PUBLIC_SITE_URL ??= 'https://example.test';
