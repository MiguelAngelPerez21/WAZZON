import 'server-only';

import { lookup } from 'node:dns/promises';

import { logger } from '@/lib/logger';
import { UnsafeUrlError, isBlockedIpLiteral, validatePublicHttpUrl } from '@/security/url-guard';

/**
 * Server-only hardened HTTP client used exclusively by the metadata importer.
 *
 * Guarantees:
 *  - only http/https, public IP destinations (DNS is resolved and checked);
 *  - redirects are followed manually and re-validated at every hop;
 *  - hard timeout and hard response-size cap;
 *  - `Content-Type` must be HTML — we never download arbitrary binaries;
 *  - no cookies, no credentials, no authentication headers are ever sent;
 *  - the response is parsed as inert text; remote HTML/JS is never executed.
 */

export const FETCH_TIMEOUT_MS = 8_000;
/**
 * Affiliate links are short links: `temu.to/x` -> tracking hop -> localised
 * `temu.com` product page is already three hops before the page is reached, so
 * a limit of 3 used to abort legitimate chains. Every hop is still fully
 * re-validated, so a larger budget does not weaken the SSRF defence; it only
 * costs time, which the 8 s timeout already bounds.
 */
export const MAX_REDIRECTS = 6;
export const MAX_RESPONSE_BYTES = 768 * 1024; // 768 KB

const ALLOWED_CONTENT_TYPES = ['text/html', 'application/xhtml+xml', 'text/plain'];

const USER_AGENT = 'Mozilla/5.0 (compatible; AffiliateCommerceBot/1.0; +metadata-preview-only)';

export class SafeFetchError extends Error {
  readonly code:
    | 'unsafe_url'
    | 'timeout'
    | 'network'
    | 'too_many_redirects'
    | 'unsupported_content_type'
    | 'response_too_large'
    | 'http_error';

  readonly status?: number;

  /**
   * Last URL that passed every safety check before the failure.
   *
   * A marketplace that answers 403 to non-browser clients still performs its
   * redirects, so this is genuine, verified information: it is the page the
   * affiliate link actually points at. Callers use it to pre-fill the landing
   * URL instead of discarding the whole attempt.
   */
  readonly finalUrl?: string;

  constructor(
    code: SafeFetchError['code'],
    message: string,
    options: { status?: number; finalUrl?: URL } = {},
  ) {
    super(message);
    this.name = 'SafeFetchError';
    this.code = code;
    if (options.status !== undefined) this.status = options.status;
    if (options.finalUrl !== undefined) this.finalUrl = options.finalUrl.toString();
  }
}

/**
 * Resolves the hostname and rejects it when *any* returned address is private.
 *
 * Residual risk: a DNS-rebinding attacker could return a public address here
 * and a private one at connect time. Node's global fetch does not expose a
 * connection-level hook to pin the resolved address, so the risk is mitigated
 * rather than eliminated — see SECURITY.md.
 */
export async function assertResolvesToPublicAddress(url: URL): Promise<void> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');

  // Literal IPs were already validated synchronously.
  if (isBlockedIpLiteral(hostname)) {
    throw new UnsafeUrlError('private_address', 'La URL apunta a una dirección interna.');
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError('dns_resolution_failed', 'No se ha podido resolver el dominio.');
  }

  if (addresses.length === 0) {
    throw new UnsafeUrlError('dns_resolution_failed', 'El dominio no resuelve a ninguna IP.');
  }

  for (const { address } of addresses) {
    if (isBlockedIpLiteral(address)) {
      throw new UnsafeUrlError(
        'private_address',
        'El dominio resuelve a una dirección interna o reservada.',
      );
    }
  }
}

/** Validates a URL both syntactically and at the DNS level. */
export async function assertSafeRemoteUrl(raw: string): Promise<URL> {
  const url = validatePublicHttpUrl(raw);
  await assertResolvesToPublicAddress(url);
  return url;
}

async function readCappedText(response: Response): Promise<string> {
  const declaredLength = Number.parseInt(response.headers.get('content-length') ?? '', 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new SafeFetchError('response_too_large', 'La respuesta es demasiado grande.');
  }

  const body = response.body;
  if (!body) return '';

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        throw new SafeFetchError('response_too_large', 'La respuesta es demasiado grande.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
    await body.cancel().catch(() => undefined);
  }

  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
}

export interface SafeHtmlResponse {
  /** URL actually fetched after following redirects. */
  finalUrl: URL;
  html: string;
}

export async function safeFetchHtml(rawUrl: string): Promise<SafeHtmlResponse> {
  let currentUrl = await assertSafeRemoteUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        // `omit` guarantees none of our cookies travel to the remote host.
        credentials: 'omit',
        cache: 'no-store',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new SafeFetchError('timeout', 'La petición ha superado el tiempo límite.', {
          finalUrl: currentUrl,
        });
      }
      logger.warn('metadata.fetch_failed', { host: currentUrl.hostname, error });
      throw new SafeFetchError('network', 'No se ha podido acceder a la URL.', {
        finalUrl: currentUrl,
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel().catch(() => undefined);

      if (!location) {
        throw new SafeFetchError('http_error', 'Redirección sin destino.', {
          status: response.status,
          finalUrl: currentUrl,
        });
      }
      if (hop === MAX_REDIRECTS) {
        throw new SafeFetchError('too_many_redirects', 'Demasiadas redirecciones.', {
          finalUrl: currentUrl,
        });
      }

      const nextUrl = new URL(location, currentUrl).toString();
      // Re-validate: a redirect is a brand new destination.
      currentUrl = await assertSafeRemoteUrl(nextUrl);
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new SafeFetchError(
        'http_error',
        `El servidor remoto respondió con un error (${response.status}).`,
        { status: response.status, finalUrl: currentUrl },
      );
    }

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.some((allowed) => contentType.includes(allowed))) {
      await response.body?.cancel().catch(() => undefined);
      throw new SafeFetchError('unsupported_content_type', 'La URL no devuelve una página HTML.', {
        finalUrl: currentUrl,
      });
    }

    let html: string;
    try {
      html = await readCappedText(response);
    } catch (error) {
      if (error instanceof SafeFetchError) {
        throw new SafeFetchError(error.code, error.message, { finalUrl: currentUrl });
      }
      throw error;
    }

    return { finalUrl: currentUrl, html };
  }

  throw new SafeFetchError('too_many_redirects', 'Demasiadas redirecciones.', {
    finalUrl: currentUrl,
  });
}
