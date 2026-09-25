import { parse } from 'node-html-parser';

import {
  sanitizeCanonicalUrl,
  sanitizeCurrency,
  sanitizeDescription,
  sanitizeImageList,
  sanitizePrice,
  sanitizeTitle,
} from '@/providers/metadata/sanitize';
import type { MetadataInput, MetadataProvider, MetadataResult } from '@/providers/metadata/types';

/**
 * Open Graph / Twitter Cards / standard HTML head extractor.
 *
 * Reads only publicly served, machine-readable metadata that sites publish for
 * exactly this purpose. It does not execute scripts and does not crawl beyond
 * the single URL provided.
 */
export class GenericOpenGraphProvider implements MetadataProvider {
  readonly id = 'open-graph';
  readonly requiresHtml = true;

  canHandle(): boolean {
    return true;
  }

  extract({ html, finalUrl }: MetadataInput): MetadataResult {
    if (!html) return {};

    const root = parse(html, {
      // `parse` builds an inert tree; scripts are data, never executed.
      blockTextElements: { script: true, noscript: false, style: false, pre: false },
    });

    const meta = (selector: string): string | undefined => {
      const element = root.querySelector(selector);
      const content = element?.getAttribute('content');
      return content ?? undefined;
    };

    const title =
      sanitizeTitle(meta('meta[property="og:title"]')) ??
      sanitizeTitle(meta('meta[name="twitter:title"]')) ??
      sanitizeTitle(root.querySelector('title')?.text);

    const description =
      sanitizeDescription(meta('meta[property="og:description"]')) ??
      sanitizeDescription(meta('meta[name="twitter:description"]')) ??
      sanitizeDescription(meta('meta[name="description"]'));

    const rawImages = [
      ...root
        .querySelectorAll('meta[property="og:image"], meta[property="og:image:secure_url"]')
        .map((element) => element.getAttribute('content')),
      meta('meta[name="twitter:image"]'),
      meta('meta[name="twitter:image:src"]'),
    ].filter((value): value is string => typeof value === 'string');

    const images = sanitizeImageList(rawImages, finalUrl).map((url) => ({ url }));

    const price =
      sanitizePrice(meta('meta[property="product:price:amount"]')) ??
      sanitizePrice(meta('meta[property="og:price:amount"]')) ??
      sanitizePrice(meta('meta[itemprop="price"]'));

    const previousPrice = sanitizePrice(meta('meta[property="product:original_price:amount"]'));

    const currency =
      sanitizeCurrency(meta('meta[property="product:price:currency"]')) ??
      sanitizeCurrency(meta('meta[property="og:price:currency"]')) ??
      sanitizeCurrency(meta('meta[itemprop="priceCurrency"]'));

    const canonicalUrl =
      sanitizeCanonicalUrl(
        root.querySelector('link[rel="canonical"]')?.getAttribute('href'),
        finalUrl,
      ) ?? sanitizeCanonicalUrl(meta('meta[property="og:url"]'), finalUrl);

    return {
      title,
      description,
      images: images.length > 0 ? images : undefined,
      price,
      previousPrice,
      currency,
      canonicalUrl,
      rawSource: this.id,
    };
  }
}
