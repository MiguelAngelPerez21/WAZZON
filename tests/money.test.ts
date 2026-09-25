import { describe, expect, it } from 'vitest';

import { calculateDiscountPercentage } from '@/domain/discount';
import {
  MAX_PRICE,
  formatPrice,
  parsePrice,
  parsePriceInput,
  roundToCents,
  toDbPrice,
} from '@/domain/money';

describe('parsePrice', () => {
  it('reads the string form PostgREST returns for numeric columns', () => {
    expect(parsePrice('19.99')).toBe(19.99);
    expect(parsePrice(19.99)).toBe(19.99);
  });

  it('returns null for absent or unusable values', () => {
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice(undefined)).toBeNull();
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('n/a')).toBeNull();
  });
});

describe('parsePriceInput', () => {
  it('understands European formatting', () => {
    expect(parsePriceInput('12,99 €')).toBe(12.99);
    expect(parsePriceInput('1.299,00')).toBe(1299);
    expect(parsePriceInput('1.299,50 EUR')).toBe(1299.5);
  });

  it('understands US formatting', () => {
    expect(parsePriceInput('$12.99')).toBe(12.99);
    expect(parsePriceInput('1,299.00')).toBe(1299);
  });

  it('handles plain integers', () => {
    expect(parsePriceInput('25')).toBe(25);
  });

  it('returns null instead of guessing', () => {
    expect(parsePriceInput('')).toBeNull();
    expect(parsePriceInput('gratis')).toBeNull();
    expect(parsePriceInput('-5')).toBeNull();
    expect(parsePriceInput(String(MAX_PRICE + 1))).toBeNull();
  });
});

describe('roundToCents / toDbPrice', () => {
  it('rounds to a 2-decimal scale', () => {
    expect(roundToCents(1.005)).toBe(1.01);
    expect(roundToCents(2.344)).toBe(2.34);
  });

  it('serialises with exactly two decimals', () => {
    expect(toDbPrice(12.5)).toBe('12.50');
    expect(toDbPrice(0)).toBe('0.00');
    expect(toDbPrice(null)).toBeNull();
  });
});

describe('formatPrice', () => {
  it('returns null when there is no price, never a placeholder', () => {
    expect(formatPrice(null, 'EUR')).toBeNull();
  });

  it('formats using the requested locale', () => {
    expect(formatPrice(12.5, 'EUR')).toContain('12,50');
    expect(formatPrice(12.5, 'USD', 'en-US')).toBe('$12.50');
  });

  it('falls back to a plain representation for unknown currency codes', () => {
    expect(formatPrice(12.5, 'NOT-A-CODE')).toBe('12.50 NOT-A-CODE');
  });
});

describe('calculateDiscountPercentage', () => {
  it('matches the SQL generated column (floor)', () => {
    expect(calculateDiscountPercentage(10, 20)).toBe(50);
    expect(calculateDiscountPercentage(15, 20)).toBe(25);
    expect(calculateDiscountPercentage(33.33, 99.99)).toBe(66);
  });

  it('returns null when a discount cannot be justified', () => {
    expect(calculateDiscountPercentage(20, 20)).toBeNull();
    expect(calculateDiscountPercentage(25, 20)).toBeNull();
    expect(calculateDiscountPercentage(10, 0)).toBeNull();
    expect(calculateDiscountPercentage(10, null)).toBeNull();
    expect(calculateDiscountPercentage(null, 20)).toBeNull();
    expect(calculateDiscountPercentage(undefined, undefined)).toBeNull();
    expect(calculateDiscountPercentage(-1, 20)).toBeNull();
    expect(calculateDiscountPercentage(Number.NaN, 20)).toBeNull();
  });
});
