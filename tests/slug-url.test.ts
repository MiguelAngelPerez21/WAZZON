import { describe, expect, it } from 'vitest';

import { isValidSlug, slugify, uniqueSlug } from '@/domain/slug';
import { extractHostname, normalizeUrlForDedupe, stripHash } from '@/domain/url';
import { resolveSiteUrl } from '@/lib/env';

describe('slugify', () => {
  it('produces database-compatible slugs', () => {
    expect(slugify('Auriculares Bluetooth')).toBe('auriculares-bluetooth');
    expect(slugify('  ¡Oferta!  50% dto.  ')).toBe('oferta-50-dto');
  });

  it('strips diacritics and handles ñ', () => {
    expect(slugify('Cámara Réflex')).toBe('camara-reflex');
    expect(slugify('Año Nuevo')).toBe('ano-nuevo');
  });

  it('never ends with a separator, even after truncation', () => {
    const slug = slugify('a'.repeat(78) + ' bb');
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('satisfies the CHECK constraint it mirrors', () => {
    for (const input of ['Producto 1', 'ÉÈÊ', 'emoji 🎉 test', '---raro---']) {
      const slug = slugify(input);
      if (slug) expect(isValidSlug(slug), slug).toBe(true);
    }
  });
});

describe('isValidSlug', () => {
  it('rejects malformed slugs', () => {
    expect(isValidSlug('Valid')).toBe(false);
    expect(isValidSlug('-leading')).toBe(false);
    expect(isValidSlug('trailing-')).toBe(false);
    expect(isValidSlug('double--dash')).toBe(false);
    expect(isValidSlug('a'.repeat(81))).toBe(false);
    expect(isValidSlug('ok-slug-9')).toBe(true);
  });
});

describe('uniqueSlug', () => {
  it('returns the base slug when it is free', () => {
    expect(uniqueSlug('Mi Producto', new Set())).toBe('mi-producto');
  });

  it('appends an incrementing suffix when taken', () => {
    expect(uniqueSlug('Mi Producto', new Set(['mi-producto']))).toBe('mi-producto-2');
    expect(uniqueSlug('Mi Producto', new Set(['mi-producto', 'mi-producto-2']))).toBe(
      'mi-producto-3',
    );
  });

  it('falls back to a generic root for unsluggable titles', () => {
    expect(uniqueSlug('!!!', new Set())).toBe('producto');
  });

  it('keeps the result within the column limit', () => {
    const taken = new Set(['a'.repeat(80)]);
    expect(uniqueSlug('a'.repeat(120), taken).length).toBeLessThanOrEqual(80);
  });
});

describe('normalizeUrlForDedupe', () => {
  it('ignores tracking parameters, www, trailing slash and casing', () => {
    const a = normalizeUrlForDedupe(
      'https://www.Example.com/producto/123/?utm_source=ig&color=rojo',
    );
    const b = normalizeUrlForDedupe('https://example.com/producto/123?color=rojo&gclid=abc');
    expect(a).toBe('example.com/producto/123?color=rojo');
    expect(a).toBe(b);
  });

  it('sorts the remaining parameters so order does not matter', () => {
    expect(normalizeUrlForDedupe('https://a.com/p?b=2&a=1')).toBe(
      normalizeUrlForDedupe('https://a.com/p?a=1&b=2'),
    );
  });

  it('keeps different products apart', () => {
    expect(normalizeUrlForDedupe('https://a.com/p/1')).not.toBe(
      normalizeUrlForDedupe('https://a.com/p/2'),
    );
  });

  it('returns null for non-http input', () => {
    expect(normalizeUrlForDedupe('not a url')).toBeNull();
    expect(normalizeUrlForDedupe('ftp://a.com/x')).toBeNull();
  });
});

describe('extractHostname / stripHash', () => {
  it('extracts a lowercase hostname without www', () => {
    expect(extractHostname('https://WWW.Tienda.com/x')).toBe('tienda.com');
    expect(extractHostname('nope')).toBeNull();
  });

  it('removes the fragment', () => {
    expect(stripHash('https://a.com/p#reviews')).toBe('https://a.com/p');
    expect(stripHash('nope')).toBe('nope');
  });
});

describe('resolveSiteUrl', () => {
  it('always prefers the explicitly configured origin', () => {
    expect(
      resolveSiteUrl({
        explicit: 'https://midominio.com',
        vercelProduction: 'proyecto.vercel.app',
        vercelPreview: 'proyecto-git-rama.vercel.app',
      }),
    ).toBe('https://midominio.com');
  });

  it('falls back to the Vercel production host, then to the preview host', () => {
    expect(
      resolveSiteUrl({
        vercelProduction: 'proyecto.vercel.app',
        vercelPreview: 'preview.vercel.app',
      }),
    ).toBe('https://proyecto.vercel.app');
    expect(resolveSiteUrl({ vercelPreview: 'preview.vercel.app' })).toBe(
      'https://preview.vercel.app',
    );
  });

  it('does not double the scheme when the host already carries one', () => {
    expect(resolveSiteUrl({ vercelProduction: 'https://proyecto.vercel.app' })).toBe(
      'https://proyecto.vercel.app',
    );
  });

  it('treats empty and whitespace-only values as absent', () => {
    expect(resolveSiteUrl({ explicit: '   ', vercelProduction: 'proyecto.vercel.app' })).toBe(
      'https://proyecto.vercel.app',
    );
    expect(resolveSiteUrl({ explicit: '', vercelProduction: '' })).toBe('http://localhost:3000');
  });

  it('only lands on localhost when nothing at all is configured', () => {
    expect(resolveSiteUrl({})).toBe('http://localhost:3000');
  });
});
