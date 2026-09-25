import { describe, expect, it } from 'vitest';

import { GenericOpenGraphProvider } from '@/providers/metadata/open-graph';
import {
  sanitizeCanonicalUrl,
  sanitizeCurrency,
  sanitizeDescription,
  sanitizeImageList,
  sanitizeImageUrl,
  sanitizePrice,
  sanitizeText,
  sanitizeTitle,
} from '@/providers/metadata/sanitize';

const BASE = new URL('https://tienda.example.com/producto/123');

describe('sanitizeText', () => {
  it('drops markup, control characters and collapses whitespace', () => {
    expect(sanitizeText('<b>Hola</b>   mundo', 100)).toBe('Hola mundo');
    expect(sanitizeText('<script>alert(1)</script>Texto', 100)).toBe('alert(1) Texto');
    expect(sanitizeText('a\u0000b\u007fc', 100)).toBe('a b c');
  });

  it('truncates to the requested length', () => {
    expect(sanitizeText('a'.repeat(50), 10)?.length).toBe(10);
  });

  it('returns undefined instead of an empty string', () => {
    expect(sanitizeText('   ', 10)).toBeUndefined();
    expect(sanitizeText('<p></p>', 10)).toBeUndefined();
    expect(sanitizeText(42, 10)).toBeUndefined();
    expect(sanitizeText(null, 10)).toBeUndefined();
  });
});

describe('sanitizeTitle / sanitizeDescription', () => {
  it('applies the documented limits', () => {
    expect(sanitizeTitle('a'.repeat(500))?.length).toBe(180);
    expect(sanitizeDescription('a'.repeat(5000))?.length).toBe(2000);
  });
});

describe('sanitizeImageUrl', () => {
  it('resolves relative URLs against the page URL', () => {
    expect(sanitizeImageUrl('/img/a.jpg', BASE)).toBe('https://tienda.example.com/img/a.jpg');
    expect(sanitizeImageUrl('//cdn.example.com/a.jpg', BASE)).toBe('https://cdn.example.com/a.jpg');
  });

  it('rejects anything that is not public https', () => {
    expect(sanitizeImageUrl('http://tienda.example.com/a.jpg', BASE)).toBeUndefined();
    expect(sanitizeImageUrl('data:image/png;base64,AAAA', BASE)).toBeUndefined();
    expect(sanitizeImageUrl('javascript:alert(1)', BASE)).toBeUndefined();
    expect(sanitizeImageUrl('https://127.0.0.1/a.jpg', BASE)).toBeUndefined();
    expect(sanitizeImageUrl('   ', BASE)).toBeUndefined();
    expect(sanitizeImageUrl(null, BASE)).toBeUndefined();
  });
});

describe('sanitizeImageList', () => {
  it('deduplicates, filters and caps at 8 images', () => {
    const values = [
      'https://cdn.example.com/1.jpg',
      'https://cdn.example.com/1.jpg',
      'javascript:alert(1)',
      ...Array.from({ length: 12 }, (_, index) => `https://cdn.example.com/n${index}.jpg`),
    ];
    const result = sanitizeImageList(values, BASE);
    expect(result.length).toBe(8);
    expect(new Set(result).size).toBe(8);
    expect(result[0]).toBe('https://cdn.example.com/1.jpg');
  });
});

describe('sanitizeCurrency / sanitizePrice', () => {
  it('accepts ISO-4217-shaped codes only', () => {
    expect(sanitizeCurrency('eur')).toBe('EUR');
    expect(sanitizeCurrency('EU')).toBeUndefined();
    expect(sanitizeCurrency('12€')).toBeUndefined();
    expect(sanitizeCurrency(5)).toBeUndefined();
  });

  it('parses numeric and textual prices, rejecting nonsense', () => {
    expect(sanitizePrice(19.999)).toBe(20);
    expect(sanitizePrice('12,99 €')).toBe(12.99);
    expect(sanitizePrice(-1)).toBeUndefined();
    expect(sanitizePrice('gratis')).toBeUndefined();
    expect(sanitizePrice(Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});

describe('sanitizeCanonicalUrl', () => {
  it('resolves and validates', () => {
    expect(sanitizeCanonicalUrl('/producto/123', BASE)).toBe(
      'https://tienda.example.com/producto/123',
    );
    expect(sanitizeCanonicalUrl('http://localhost/x', BASE)).toBeUndefined();
    expect(sanitizeCanonicalUrl('', BASE)).toBeUndefined();
  });
});

describe('GenericOpenGraphProvider', () => {
  const provider = new GenericOpenGraphProvider();

  it('extracts Open Graph metadata', () => {
    const html = `
      <html><head>
        <title>Fallback title</title>
        <meta property="og:title" content="Auriculares X1" />
        <meta property="og:description" content="Sonido envolvente" />
        <meta property="og:image" content="https://cdn.example.com/a.jpg" />
        <meta property="og:image" content="/b.jpg" />
        <meta property="product:price:amount" content="39.95" />
        <meta property="product:price:currency" content="eur" />
        <link rel="canonical" href="https://tienda.example.com/producto/123" />
      </head><body></body></html>`;

    const result = provider.extract({ html, finalUrl: BASE, url: BASE });

    expect(result.title).toBe('Auriculares X1');
    expect(result.description).toBe('Sonido envolvente');
    expect(result.images).toEqual([
      { url: 'https://cdn.example.com/a.jpg' },
      { url: 'https://tienda.example.com/b.jpg' },
    ]);
    expect(result.price).toBe(39.95);
    expect(result.currency).toBe('EUR');
    expect(result.canonicalUrl).toBe('https://tienda.example.com/producto/123');
  });

  it('falls back to Twitter Cards and the <title> element', () => {
    const html = `
      <html><head>
        <title>Camiseta básica</title>
        <meta name="twitter:description" content="Algodón 100%" />
      </head></html>`;

    const result = provider.extract({ html, finalUrl: BASE, url: BASE });
    expect(result.title).toBe('Camiseta básica');
    expect(result.description).toBe('Algodón 100%');
    expect(result.images).toBeUndefined();
  });

  it('never invents data when the page has no metadata', () => {
    const result = provider.extract({
      html: '<html><body>hola</body></html>',
      finalUrl: BASE,
      url: BASE,
    });
    expect(result.title).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.price).toBeUndefined();
    expect(result.images).toBeUndefined();
  });

  it('does not import unsafe image URLs from remote markup', () => {
    const html = `
      <html><head>
        <meta property="og:image" content="javascript:alert(1)" />
        <meta property="og:image" content="http://169.254.169.254/latest" />
      </head></html>`;
    expect(provider.extract({ html, finalUrl: BASE, url: BASE }).images).toBeUndefined();
  });
});
