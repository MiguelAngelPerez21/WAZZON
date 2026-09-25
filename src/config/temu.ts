/**
 * Temu link recognition.
 *
 * This site publishes Temu exclusively (see `src/services/providers.ts`), and
 * Temu affiliate links rarely point straight at the product page: they are
 * usually short links that bounce through an official redirector before
 * landing on `temu.com`.
 *
 * Knowing which hosts belong to Temu lets us do two things, and only two:
 *
 *  1. follow the HTTP redirect chain to the real landing page (every hop is
 *     re-validated by `src/security/url-guard.ts`, so this is not a bypass);
 *  2. degrade to assisted manual entry — instead of a hard error — when Temu
 *     serves a page with no public metadata.
 *
 * It does NOT enable scraping, headless browsers, login, or any request Temu
 * would not serve to an ordinary visitor.
 */

/**
 * Registrable domains operated by Temu. Matching is suffix-based, so every
 * subdomain is covered: `www.temu.com`, `m.temu.com`, `app.temu.com`,
 * `share.temu.com`…
 *
 * `temu.to` is the official short-link domain used by the share and affiliate
 * tools. Add a domain here only if you have verified it belongs to Temu — an
 * unverified entry would let a look-alike host inherit Temu's redirect
 * handling.
 */
export const TEMU_DOMAINS = ['temu.com', 'temu.to'] as const;

function normaliseHost(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^\[|\]$/g, '');
}

/** Whether a hostname belongs to Temu (exact domain or any subdomain). */
export function isTemuHost(hostname: string): boolean {
  const host = normaliseHost(hostname);
  return TEMU_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/**
 * Whether a URL points at Temu. Accepts a parsed `URL` or a raw string; an
 * unparseable string is simply "not Temu" rather than an error, because this
 * only selects a UX path — the security checks live in the URL guard.
 */
export function isTemuUrl(value: URL | string): boolean {
  if (typeof value !== 'string') return isTemuHost(value.hostname);
  try {
    return isTemuHost(new URL(value.trim()).hostname);
  } catch {
    return false;
  }
}
