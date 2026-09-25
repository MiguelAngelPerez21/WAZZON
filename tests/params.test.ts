import { describe, expect, it } from 'vitest';

import { errorState, idleState, safeInternalPath, successState } from '@/lib/action-state';
import {
  buildPageHref,
  readFlag,
  readPage,
  readParam,
  readQuery,
  readSort,
  type SearchParams,
} from '@/lib/catalog-params';

describe('readParam', () => {
  it('normalises arrays, blanks and non-strings', () => {
    const params: SearchParams = { a: 'x', b: ['y', 'z'], c: '  ', d: undefined };
    expect(readParam(params, 'a')).toBe('x');
    expect(readParam(params, 'b')).toBe('y');
    expect(readParam(params, 'c')).toBeUndefined();
    expect(readParam(params, 'd')).toBeUndefined();
    expect(readParam(params, 'missing')).toBeUndefined();
  });
});

describe('readPage', () => {
  it('defaults to 1 and clamps hostile input', () => {
    expect(readPage({})).toBe(1);
    expect(readPage({ pagina: '3' })).toBe(3);
    expect(readPage({ pagina: '0' })).toBe(1);
    expect(readPage({ pagina: '-4' })).toBe(1);
    expect(readPage({ pagina: 'abc' })).toBe(1);
    expect(readPage({ pagina: '999999' })).toBe(500);
  });
});

describe('readSort', () => {
  it('only accepts known sort keys', () => {
    expect(readSort({})).toBe('recent');
    expect(readSort({ orden: 'price_asc' })).toBe('price_asc');
    expect(readSort({ orden: 'popular' })).toBe('popular');
    // An injected value must never reach the SQL function.
    expect(readSort({ orden: 'id; drop table products' })).toBe('recent');
  });
});

describe('readFlag / readQuery', () => {
  it('treats only "1" as enabled', () => {
    expect(readFlag({ destacados: '1' }, 'destacados')).toBe(true);
    expect(readFlag({ destacados: 'true' }, 'destacados')).toBe(false);
    expect(readFlag({}, 'destacados')).toBe(false);
  });

  it('caps the search text', () => {
    expect(readQuery({ q: 'zapatillas' })).toBe('zapatillas');
    expect(readQuery({ q: 'a'.repeat(500) })?.length).toBe(120);
    expect(readQuery({})).toBeUndefined();
  });
});

describe('buildPageHref', () => {
  it('preserves the current filters and drops page 1', () => {
    const params: SearchParams = { q: 'zapa', orden: 'price_asc', pagina: '4' };
    expect(buildPageHref('/productos', params, 2)).toBe(
      '/productos?q=zapa&orden=price_asc&pagina=2',
    );
    expect(buildPageHref('/productos', params, 1)).toBe('/productos?q=zapa&orden=price_asc');
  });

  it('returns the bare path when there is nothing to keep', () => {
    expect(buildPageHref('/ofertas', {}, 1)).toBe('/ofertas');
  });
});

describe('action state helpers', () => {
  it('builds consistent shapes', () => {
    expect(idleState).toEqual({ status: 'idle' });
    expect(successState('ok')).toEqual({ status: 'success', message: 'ok' });
    expect(errorState('bad')).toEqual({ status: 'error', message: 'bad' });
    expect(errorState('bad', { title: ['requerido'] })).toEqual({
      status: 'error',
      message: 'bad',
      fieldErrors: { title: ['requerido'] },
    });
  });
});

describe('safeInternalPath', () => {
  it('accepts in-app paths', () => {
    expect(safeInternalPath('/admin/products', '/admin')).toBe('/admin/products');
  });

  it('rejects anything that could leave the site (open redirect)', () => {
    expect(safeInternalPath('//evil.com', '/admin')).toBe('/admin');
    expect(safeInternalPath('https://evil.com', '/admin')).toBe('/admin');
    expect(safeInternalPath('javascript:alert(1)', '/admin')).toBe('/admin');
    expect(safeInternalPath('', '/admin')).toBe('/admin');
    expect(safeInternalPath(null, '/admin')).toBe('/admin');
    expect(safeInternalPath(undefined, '/admin')).toBe('/admin');
  });
});
