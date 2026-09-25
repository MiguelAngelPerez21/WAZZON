/**
 * Hosts whose images we are allowed to render through the Next.js image
 * optimizer. Anything outside this list is rendered as a plain <img> so that
 * our optimizer never becomes an open proxy for arbitrary remote content.
 *
 * Extend it with `NEXT_PUBLIC_IMAGE_ALLOWED_HOSTS` (comma separated).
 */
export const DEFAULT_IMAGE_ALLOWED_HOSTS = [
  // Marketplaces we expect to link to first.
  'img.kwcdn.com',
  'aimg.kwcdn.com',
  'm.media-amazon.com',
  'images-na.ssl-images-amazon.com',
  'ae01.alicdn.com',
  'ae-pic-a1.aliexpress-media.com',
  'img.mirastatic.com',
];

function parseHostList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

/** Supabase Storage lives under the project host, so derive it from the URL. */
function supabaseHost(rawUrl: string | undefined): string[] {
  if (!rawUrl) return [];
  try {
    return [new URL(rawUrl).hostname.toLowerCase()];
  } catch {
    return [];
  }
}

/**
 * Static `process.env.NEXT_PUBLIC_*` references so Next.js can inline the
 * values into the client bundle. Also consumed by `next.config.ts`.
 */
export const IMAGE_ALLOWED_HOSTS: string[] = Array.from(
  new Set([
    ...DEFAULT_IMAGE_ALLOWED_HOSTS,
    ...parseHostList(process.env.NEXT_PUBLIC_IMAGE_ALLOWED_HOSTS),
    ...supabaseHost(process.env.NEXT_PUBLIC_SUPABASE_URL),
  ]),
);

/** Whether a URL may go through the Next.js image optimizer. */
export function isOptimizableImageHost(rawUrl: string): boolean {
  try {
    const { hostname, protocol } = new URL(rawUrl);
    if (protocol !== 'https:') return false;
    return IMAGE_ALLOWED_HOSTS.includes(hostname.toLowerCase());
  } catch {
    return false;
  }
}
