import type { CatalogSort } from '@/repositories/catalog';

export type SearchParams = Record<string, string | string[] | undefined>;

const SORTS: CatalogSort[] = ['recent', 'price_asc', 'price_desc', 'popular'];

export function readParam(params: SearchParams, key: string): string | undefined {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function readPage(params: SearchParams): number {
  const raw = readParam(params, 'pagina');
  const page = Number.parseInt(raw ?? '1', 10);
  return Number.isFinite(page) && page > 0 ? Math.min(page, 500) : 1;
}

export function readSort(params: SearchParams): CatalogSort {
  const raw = readParam(params, 'orden');
  return SORTS.find((sort) => sort === raw) ?? 'recent';
}

export function readFlag(params: SearchParams, key: string): boolean {
  return readParam(params, key) === '1';
}

/** Search text is capped so a huge query can never reach the database. */
export function readQuery(params: SearchParams): string | undefined {
  return readParam(params, 'q')?.slice(0, 120);
}

/** Rebuilds the current URL with a different page number. */
export function buildPageHref(basePath: string, params: SearchParams, page: number): string {
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (key === 'pagina') continue;
    const single = Array.isArray(value) ? value[0] : value;
    if (typeof single === 'string' && single.length > 0) next.set(key, single);
  }

  if (page > 1) next.set('pagina', String(page));

  const query = next.toString();
  return query ? `${basePath}?${query}` : basePath;
}
