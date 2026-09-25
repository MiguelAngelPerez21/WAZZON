/**
 * URL normalisation used for duplicate detection.
 *
 * Two affiliate links that point at the same product usually differ only in
 * tracking parameters, so we strip everything that does not identify the
 * product before comparing.
 */

const TRACKING_PARAM_PREFIXES = ['utm_', '_'];

const TRACKING_PARAMS = new Set([
  'gclid',
  'fbclid',
  'msclkid',
  'ttclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'ref',
  'ref_',
  'refer',
  'referrer',
  'source',
  'spm',
  'sh',
  'share',
  'share_id',
  'shareid',
  'aff',
  'affid',
  'affiliate',
  'tag',
  'ascsubtag',
  'linkcode',
  'psc',
  'th',
  'pd_rd_r',
  'pd_rd_w',
  'pd_rd_wg',
  'pf_rd_p',
  'pf_rd_r',
  '_encoding',
]);

function isTrackingParam(name: string): boolean {
  const key = name.toLowerCase();
  if (TRACKING_PARAMS.has(key)) return true;
  return TRACKING_PARAM_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * Returns a stable, comparable representation of a URL, or `null` when the
 * input is not a usable absolute URL.
 */
export function normalizeUrlForDedupe(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const host = url.hostname
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/\.$/, '');

  const params = [...url.searchParams.entries()]
    .filter(([name]) => !isTrackingParam(name))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const query = params.map(([name, value]) => `${name}=${value}`).join('&');
  const path = url.pathname.replace(/\/+$/, '') || '/';

  return `${host}${path}${query ? `?${query}` : ''}`;
}

/** Hostname in lowercase without the `www.` prefix, or null when invalid. */
export function extractHostname(raw: string): string | null {
  try {
    return new URL(raw.trim()).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Strips our own tracking parameters from a URL before showing it in the UI.
 * (The stored affiliate URL is never modified.)
 */
export function stripHash(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = '';
    return url.toString();
  } catch {
    return raw;
  }
}
