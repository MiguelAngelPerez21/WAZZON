/**
 * Metadata import contracts.
 *
 * Adding a new source (an official marketplace API, a product feed, a CSV
 * importer...) means implementing `MetadataProvider` and registering it — no
 * changes to the Quick Add flow, the validation layer or the database.
 */

export interface MetadataImage {
  url: string;
  alt?: string | undefined;
}

export interface MetadataResult {
  title?: string | undefined;
  description?: string | undefined;
  images?: MetadataImage[] | undefined;
  price?: number | undefined;
  previousPrice?: number | undefined;
  currency?: string | undefined;
  canonicalUrl?: string | undefined;
  /** Slug of the detected `providers` row, when recognised. */
  provider?: string | undefined;
  externalId?: string | undefined;
  /** Which extractor produced each piece of data (debugging / UI hints). */
  rawSource?: string | undefined;
}

export interface MetadataInput {
  /** URL as submitted by the admin. */
  url: URL;
  /** URL after redirects were followed (may equal `url`). */
  finalUrl: URL;
  /** Page HTML, or `null` for providers that do not need it (APIs, feeds). */
  html: string | null;
}

export interface MetadataProvider {
  readonly id: string;
  /** Providers that parse the page declare this, so the registry fetches once. */
  readonly requiresHtml: boolean;
  canHandle(url: URL): boolean;
  extract(input: MetadataInput): Promise<MetadataResult> | MetadataResult;
}

export type MetadataFieldStatus = 'detected' | 'missing';

export type MetadataFieldName =
  'title' | 'description' | 'images' | 'price' | 'currency' | 'canonicalUrl';

export interface MetadataExtractionReport {
  result: MetadataResult;
  /** Per-field detection state, surfaced in the Quick Add UI. */
  fields: Record<MetadataFieldName, MetadataFieldStatus>;
  /** Providers that contributed data, in priority order. */
  usedProviders: string[];
  /** Non-fatal problems (e.g. remote site blocked us). */
  warnings: string[];
  /**
   * URL actually reached after following redirects. Known even when the page
   * could not be read, because redirects happen before the response body.
   */
  finalUrl: string;
  /** Whether the submitted link bounced through at least one redirect. */
  redirected: boolean;
  /** Whether the page could be downloaded at all. */
  fetched: boolean;
}
