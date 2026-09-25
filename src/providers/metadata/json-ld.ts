import { parse } from 'node-html-parser';

import {
  sanitizeCanonicalUrl,
  sanitizeCurrency,
  sanitizeDescription,
  sanitizeImageList,
  sanitizePrice,
  sanitizeText,
  sanitizeTitle,
} from '@/providers/metadata/sanitize';
import type { MetadataInput, MetadataProvider, MetadataResult } from '@/providers/metadata/types';

/**
 * JSON-LD (schema.org `Product`) extractor.
 *
 * JSON-LD blocks are parsed as data with `JSON.parse`; they are never evaluated
 * as JavaScript. Malformed blocks are skipped silently.
 */
export class GenericJsonLdProvider implements MetadataProvider {
  readonly id = 'json-ld';
  readonly requiresHtml = true;

  canHandle(): boolean {
    return true;
  }

  extract({ html, finalUrl }: MetadataInput): MetadataResult {
    if (!html) return {};

    const root = parse(html);
    const blocks = root.querySelectorAll('script[type="application/ld+json"]');

    for (const block of blocks) {
      const nodes = safeParseJson(block.text);
      for (const node of nodes) {
        const product = findProductNode(node);
        if (!product) continue;

        const offer = findOfferNode(product['offers']);

        const images = sanitizeImageList(toArray(product['image']), finalUrl).map((url) => ({
          url,
        }));

        const result: MetadataResult = {
          title: sanitizeTitle(product['name']),
          description: sanitizeDescription(product['description']),
          images: images.length > 0 ? images : undefined,
          price: offer ? sanitizePrice(offer['price'] ?? offer['lowPrice']) : undefined,
          currency: offer ? sanitizeCurrency(offer['priceCurrency']) : undefined,
          canonicalUrl: sanitizeCanonicalUrl(product['url'] ?? offer?.['url'], finalUrl),
          externalId: sanitizeText(product['sku'] ?? product['mpn'], 120),
          rawSource: this.id,
        };

        // Only return once we actually found something useful.
        if (result.title || result.price !== undefined || result.images) {
          return result;
        }
      }
    }

    return {};
  }
}

type JsonObject = Record<string, unknown>;

function safeParseJson(raw: string): unknown[] {
  const text = raw.trim();
  if (!text) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function hasType(node: JsonObject, expected: string): boolean {
  const type = node['@type'];
  if (typeof type === 'string') return type.toLowerCase() === expected;
  if (Array.isArray(type)) {
    return type.some((item) => typeof item === 'string' && item.toLowerCase() === expected);
  }
  return false;
}

/** Depth-limited search for a schema.org Product node (handles @graph). */
function findProductNode(node: unknown, depth = 0): JsonObject | null {
  if (depth > 4) return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findProductNode(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (!isJsonObject(node)) return null;
  if (hasType(node, 'product')) return node;

  const graph = node['@graph'];
  if (graph) return findProductNode(graph, depth + 1);

  return null;
}

function findOfferNode(value: unknown): JsonObject | null {
  for (const candidate of toArray(value)) {
    if (!isJsonObject(candidate)) continue;
    if (hasType(candidate, 'offer') || hasType(candidate, 'aggregateoffer')) return candidate;
    if ('price' in candidate || 'lowPrice' in candidate) return candidate;
  }
  return null;
}
