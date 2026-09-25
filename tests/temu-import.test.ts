import { describe, expect, it } from 'vitest';

import { isTemuHost, isTemuUrl, TEMU_DOMAINS } from '@/config/temu';
import { resolveImportMode } from '@/providers/metadata/completeness';
import { sniffImageType } from '@/lib/images/sniff';

describe('isTemuHost', () => {
  it('matches the registrable domains and every subdomain', () => {
    expect(isTemuHost('temu.com')).toBe(true);
    expect(isTemuHost('www.temu.com')).toBe(true);
    expect(isTemuHost('m.temu.com')).toBe(true);
    expect(isTemuHost('app.temu.com')).toBe(true);
    expect(isTemuHost('temu.to')).toBe(true);
  });

  it('ignores case and a trailing dot', () => {
    expect(isTemuHost('WWW.Temu.COM')).toBe(true);
    expect(isTemuHost('www.temu.com.')).toBe(true);
  });

  it('does not match look-alike domains', () => {
    // The dangerous cases: a suffix match must never accept these.
    expect(isTemuHost('temu.com.evil.example')).toBe(false);
    expect(isTemuHost('nottemu.com')).toBe(false);
    expect(isTemuHost('temu.co')).toBe(false);
    expect(isTemuHost('faketemu.to')).toBe(false);
  });

  it('keeps the domain list explicit', () => {
    expect(TEMU_DOMAINS).toContain('temu.com');
  });
});

describe('isTemuUrl', () => {
  it('accepts full URLs, including affiliate short links', () => {
    expect(isTemuUrl('https://temu.to/k/abc123')).toBe(true);
    expect(isTemuUrl('https://www.temu.com/es/product-g-601099512345678.html?_x_ads=1')).toBe(true);
    expect(isTemuUrl(new URL('https://m.temu.com/es'))).toBe(true);
  });

  it('returns false instead of throwing for unusable input', () => {
    expect(isTemuUrl('not a url')).toBe(false);
    expect(isTemuUrl('')).toBe(false);
    expect(isTemuUrl('https://www.aliexpress.com/item/1.html')).toBe(false);
  });
});

describe('resolveImportMode', () => {
  it('reports an imported link only when title, price and images are all present', () => {
    expect(resolveImportMode({ title: 'detected', price: 'detected', images: 'detected' })).toBe(
      'imported',
    );
  });

  it('falls back to assisted manual entry when anything essential is missing', () => {
    expect(resolveImportMode({ title: 'detected', price: 'detected', images: 'missing' })).toBe(
      'assisted-manual',
    );
    expect(resolveImportMode({ title: 'missing', price: 'missing', images: 'missing' })).toBe(
      'assisted-manual',
    );
    // The realistic Temu case: nothing at all was readable.
    expect(resolveImportMode({})).toBe('assisted-manual');
  });

  it('does not require the optional fields', () => {
    expect(
      resolveImportMode({
        title: 'detected',
        price: 'detected',
        images: 'detected',
        currency: 'missing',
        description: 'missing',
        canonicalUrl: 'missing',
      }),
    ).toBe('imported');
  });
});

describe('sniffImageType', () => {
  const bytes = (...values: number[]) => new Uint8Array(values);
  const ascii = (text: string) => Array.from(text, (character) => character.charCodeAt(0));

  it('detects the formats the bucket accepts', () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(sniffImageType(bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')))).toBe(
      'image/webp',
    );
    expect(sniffImageType(bytes(0, 0, 0, 0x20, ...ascii('ftyp'), ...ascii('avif')))).toBe(
      'image/avif',
    );
  });

  it('rejects content that only claims to be an image', () => {
    // An HTML document uploaded as "photo.png" is the attack this prevents.
    expect(sniffImageType(new Uint8Array(ascii('<!DOCTYPE html><script>')))).toBeNull();
    expect(sniffImageType(new Uint8Array(ascii('GIF89a')))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
    // A truncated signature must not be accepted.
    expect(sniffImageType(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffImageType(bytes(...ascii('RIFF'), 0, 0, 0, 0))).toBeNull();
  });
});
