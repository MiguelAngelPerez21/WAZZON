import type { MetadataFieldStatus, MetadataFieldName } from '@/providers/metadata/types';

/**
 * How much of the form the importer managed to fill in.
 *
 * `imported`        — everything needed to publish came from the page.
 * `assisted-manual` — the page did not expose enough public metadata. This is
 *                     a normal outcome, not a failure: marketplaces are free
 *                     not to publish Open Graph or JSON-LD, and several
 *                     (Temu among them) answer non-browser clients with a
 *                     challenge page. The editor fills in the gaps by hand.
 */
export type MetadataImportMode = 'imported' | 'assisted-manual';

/**
 * Fields a product needs before it can be published.
 *
 * Deliberately excludes `currency` (falls back to the configured default),
 * `description` and `previousPrice` (genuinely optional) and `canonicalUrl`
 * (derived from the affiliate link when absent).
 */
export const PUBLISHABLE_FIELDS = ['title', 'price', 'images'] as const;

export function resolveImportMode(
  fields: Partial<Record<MetadataFieldName, MetadataFieldStatus>>,
): MetadataImportMode {
  return PUBLISHABLE_FIELDS.every((field) => fields[field] === 'detected')
    ? 'imported'
    : 'assisted-manual';
}
