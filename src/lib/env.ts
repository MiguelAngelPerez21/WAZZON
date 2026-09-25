import { z } from 'zod';

/**
 * Environment access.
 *
 * `NEXT_PUBLIC_*` variables must be referenced statically (not via a dynamic
 * key) so that Next.js can inline them into the client bundle — hence the
 * explicit object literal below.
 *
 * Nothing here throws at import time: the app must remain buildable on a
 * machine without credentials. Missing configuration degrades to
 * `isSupabaseConfigured === false`, which makes the data layer return empty
 * results instead of crashing the build.
 */

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/**
 * Resolves the public origin of the site.
 *
 * Canonicals, `robots.txt`, the sitemap, every Open Graph URL and the
 * same-origin check of the click beacon all derive from this value, and the
 * statically rendered routes bake it in at BUILD time. Falling back to
 * `localhost` on a real deployment would therefore ship broken canonicals and
 * reject every tracking beacon, so the Vercel system variables are consulted
 * first and `localhost` is only ever the last resort (i.e. local development).
 */
export function resolveSiteUrl(candidates: {
  explicit?: string | undefined;
  vercelProduction?: string | undefined;
  vercelPreview?: string | undefined;
}): string {
  const explicit = candidates.explicit?.trim();
  if (explicit) return explicit;

  // Vercel exposes these as bare hostnames, without a scheme.
  const host = candidates.vercelProduction?.trim() || candidates.vercelPreview?.trim();
  if (host) return `https://${host.replace(/^https?:\/\//, '')}`;

  return 'http://localhost:3000';
}

const rawPublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  // Supabase renamed the client-side key: legacy projects expose an "anon" JWT,
  // newer ones a `sb_publishable_...` key. Both are public by design and both
  // are accepted here. The references must stay static so Next can inline them.
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    '',
  NEXT_PUBLIC_SITE_URL: resolveSiteUrl({
    explicit: process.env.NEXT_PUBLIC_SITE_URL,
    vercelProduction: process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
    vercelPreview: process.env.NEXT_PUBLIC_VERCEL_URL,
  }),
};

const parsedPublicEnv = publicEnvSchema.safeParse(rawPublicEnv);

/** True when Supabase credentials are present and well-formed. */
export const isSupabaseConfigured = parsedPublicEnv.success;

export const publicEnv: PublicEnv = parsedPublicEnv.success
  ? parsedPublicEnv.data
  : {
      NEXT_PUBLIC_SUPABASE_URL: rawPublicEnv.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: rawPublicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_SITE_URL: rawPublicEnv.NEXT_PUBLIC_SITE_URL,
    };

/** Absolute site URL without a trailing slash. Used for canonicals/sitemaps. */
export const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');

/** Human-readable list of what is wrong with the current configuration. */
export function supabaseConfigProblems(): string[] {
  if (parsedPublicEnv.success) return [];

  return parsedPublicEnv.error.issues.map((issue) => {
    const name = issue.path.join('.') || 'variable';
    const value = rawPublicEnv[name as keyof typeof rawPublicEnv] ?? '';
    const state = value === '' ? 'ausente o vacía' : `presente (${value.length} caracteres)`;
    return `${name}: ${state} — ${issue.message}`;
  });
}

/**
 * Throws when Supabase is not configured. Call this from code paths that
 * genuinely cannot continue (mutations, auth), never from read paths that can
 * degrade to an empty state.
 */
export function assertSupabaseConfigured(): void {
  if (isSupabaseConfigured) return;

  throw new Error(
    [
      'Supabase no está configurado. Revisa .env.local y reinicia `npm run dev`',
      '(Next.js sólo lee los archivos .env al arrancar).',
      '',
      ...supabaseConfigProblems(),
      '',
      'Se acepta NEXT_PUBLIC_SUPABASE_ANON_KEY o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    ].join('\n'),
  );
}
