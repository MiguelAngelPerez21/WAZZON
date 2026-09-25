import 'server-only';

import { logger } from '@/lib/logger';
import { GenericJsonLdProvider } from '@/providers/metadata/json-ld';
import { GenericOpenGraphProvider } from '@/providers/metadata/open-graph';
import type {
  MetadataExtractionReport,
  MetadataInput,
  MetadataProvider,
  MetadataResult,
} from '@/providers/metadata/types';
import { SafeFetchError, safeFetchHtml } from '@/security/safe-fetch';
import { UnsafeUrlError, validatePublicHttpUrl } from '@/security/url-guard';

/**
 * Provider registry, ordered by priority.
 *
 * JSON-LD wins over Open Graph because schema.org `Product` data is structured
 * and typed, whereas OG tags are free-form. Future official-API providers must
 * be registered *before* the generic ones and declare `requiresHtml = false`.
 *
 * No fictional providers are registered: if a marketplace does not publish
 * usable public metadata, the admin fills the form manually.
 */
const providers: MetadataProvider[] = [new GenericJsonLdProvider(), new GenericOpenGraphProvider()];

/** Merges results giving priority to the first provider that filled a field. */
function mergeResults(results: MetadataResult[]): MetadataResult {
  const merged: MetadataResult = {};

  for (const result of results) {
    merged.title ??= result.title;
    merged.description ??= result.description;
    merged.images ??= result.images;
    merged.price ??= result.price;
    merged.previousPrice ??= result.previousPrice;
    merged.currency ??= result.currency;
    merged.canonicalUrl ??= result.canonicalUrl;
    merged.externalId ??= result.externalId;
  }

  return merged;
}

export class MetadataExtractionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'MetadataExtractionError';
    this.code = code;
  }
}

/**
 * Fetches a URL safely and runs every capable provider over it.
 *
 * Partial results are normal and expected: fields that could not be obtained
 * are reported as `missing` so the UI can ask the admin to fill them in. Data
 * is never invented.
 */
export async function extractMetadata(rawUrl: string): Promise<MetadataExtractionReport> {
  let url: URL;
  try {
    url = validatePublicHttpUrl(rawUrl);
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      throw new MetadataExtractionError(error.reason, error.message);
    }
    throw error;
  }

  const candidates = providers.filter((provider) => provider.canHandle(url));
  const needsHtml = candidates.some((provider) => provider.requiresHtml);

  const warnings: string[] = [];
  let html: string | null = null;
  let finalUrl = url;
  let fetched = false;

  if (needsHtml) {
    try {
      const response = await safeFetchHtml(url.toString());
      html = response.html;
      finalUrl = response.finalUrl;
      fetched = true;
    } catch (error) {
      if (error instanceof UnsafeUrlError) {
        // A redirect landed on a private address: this is a hard failure.
        throw new MetadataExtractionError(error.reason, error.message);
      }
      if (error instanceof SafeFetchError) {
        // Not an application error: plenty of marketplaces answer non-browser
        // clients with a challenge page. The redirects that ran before the
        // refusal are still real information, so keep the resolved URL.
        if (error.finalUrl) {
          try {
            finalUrl = validatePublicHttpUrl(error.finalUrl);
          } catch {
            // Keep the original URL; the guard already refused this one.
          }
        }
        logger.info('metadata.fetch_rejected', { code: error.code, host: url.hostname });
      } else {
        logger.error('metadata.fetch_unexpected_error', { host: url.hostname, error });
        warnings.push('Error inesperado al leer la página.');
      }
    }
  }

  const input: MetadataInput = { url, finalUrl, html };
  const results: MetadataResult[] = [];
  const usedProviders: string[] = [];

  for (const provider of candidates) {
    if (provider.requiresHtml && html === null) continue;
    try {
      const result = await provider.extract(input);
      if (Object.values(result).some((value) => value !== undefined)) {
        results.push(result);
        usedProviders.push(provider.id);
      }
    } catch (error) {
      logger.warn('metadata.provider_failed', { provider: provider.id, error });
      warnings.push(`El extractor "${provider.id}" no ha podido procesar la página.`);
    }
  }

  const merged = mergeResults(results);

  // The landing page reached after the redirects is a better canonical URL
  // than the short affiliate link, so fall back to it when the page itself
  // declared none. This is observed data, never a guess.
  merged.canonicalUrl ??= finalUrl.toString();

  return {
    result: merged,
    fields: {
      title: merged.title ? 'detected' : 'missing',
      description: merged.description ? 'detected' : 'missing',
      images: merged.images && merged.images.length > 0 ? 'detected' : 'missing',
      price: merged.price !== undefined ? 'detected' : 'missing',
      currency: merged.currency ? 'detected' : 'missing',
      canonicalUrl: merged.canonicalUrl ? 'detected' : 'missing',
    },
    usedProviders,
    warnings,
    finalUrl: finalUrl.toString(),
    redirected: finalUrl.toString() !== url.toString(),
    fetched,
  };
}
