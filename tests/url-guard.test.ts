import { describe, expect, it } from 'vitest';

import {
  UnsafeUrlError,
  expandIPv6,
  isBlockedHostname,
  isBlockedIPv4,
  isBlockedIPv6,
  isPublicHttpUrl,
  parseIPv4,
  validatePublicHttpUrl,
} from '@/security/url-guard';

/**
 * These are the security tests that matter most: `validatePublicHttpUrl` is the
 * single choke point protecting the metadata importer from SSRF.
 */
describe('validatePublicHttpUrl', () => {
  it('accepts ordinary public https URLs', () => {
    const url = validatePublicHttpUrl('https://www.example.com/p/123?utm_source=x');
    expect(url.hostname).toBe('www.example.com');
  });

  it('accepts the explicitly allowed ports', () => {
    expect(isPublicHttpUrl('https://example.com:443/a')).toBe(true);
    expect(isPublicHttpUrl('http://example.com:8080/a')).toBe(true);
  });

  const rejected: [string, string][] = [
    ['empty input', '   '],
    ['non-http scheme', 'ftp://example.com/file'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,<script>alert(1)</script>'],
    ['file scheme', 'file:///etc/passwd'],
    ['embedded credentials', 'https://user:pass@example.com/'],
    ['forbidden port', 'http://example.com:22/'],
    ['localhost', 'http://localhost/admin'],
    ['localhost with port', 'http://localhost:8080/admin'],
    ['localhost subdomain', 'http://api.localhost/'],
    ['.local mDNS name', 'http://printer.local/'],
    ['.internal suffix', 'http://db.internal/'],
    ['GCP metadata name', 'http://metadata.google.internal/computeMetadata/v1/'],
    ['loopback IPv4', 'http://127.0.0.1:8080/'],
    ['loopback IPv4 alias', 'http://127.255.1.2/'],
    ['0.0.0.0', 'http://0.0.0.0/'],
    ['RFC1918 10/8', 'http://10.1.2.3/'],
    ['RFC1918 172.16/12', 'http://172.20.0.5/'],
    ['RFC1918 192.168/16', 'http://192.168.1.1/'],
    ['CGNAT 100.64/10', 'http://100.100.0.1/'],
    ['cloud metadata link-local', 'http://169.254.169.254/latest/meta-data/'],
    ['broadcast', 'http://255.255.255.255/'],
    ['IPv6 loopback', 'http://[::1]:8080/'],
    ['IPv6 unspecified', 'http://[::]/'],
    ['IPv6 unique local', 'http://[fd00::1]/'],
    ['IPv6 link-local', 'http://[fe80::1]/'],
    ['IPv4-mapped IPv6 loopback', 'http://[::ffff:127.0.0.1]/'],
    ['url longer than 2048 chars', `https://example.com/${'a'.repeat(2100)}`],
  ];

  it.each(rejected)('rejects %s', (_label, value) => {
    expect(isPublicHttpUrl(value)).toBe(false);
    expect(() => validatePublicHttpUrl(value)).toThrow(UnsafeUrlError);
  });

  it('reports a machine-readable rejection reason', () => {
    try {
      validatePublicHttpUrl('http://169.254.169.254/');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(UnsafeUrlError);
      expect((error as UnsafeUrlError).reason).toBe('private_address');
    }
  });
});

describe('parseIPv4', () => {
  it('parses dotted-quad addresses', () => {
    expect(parseIPv4('0.0.0.0')).toBe(0);
    expect(parseIPv4('127.0.0.1')).toBe(2130706433);
    expect(parseIPv4('255.255.255.255')).toBe(0xffffffff);
  });

  it('rejects octal-looking octets instead of silently reinterpreting them', () => {
    // 0177.0.0.1 is 127.0.0.1 for some resolvers; we never treat it as a valid
    // literal, so it falls through to the DNS check in safe-fetch.
    expect(parseIPv4('0177.0.0.1')).toBeNull();
    expect(parseIPv4('01.02.03.04')).toBeNull();
  });

  it('rejects out-of-range and malformed values', () => {
    expect(parseIPv4('256.0.0.1')).toBeNull();
    expect(parseIPv4('1.2.3')).toBeNull();
    expect(parseIPv4('example.com')).toBeNull();
  });
});

describe('isBlockedIPv4', () => {
  it('allows public addresses', () => {
    expect(isBlockedIPv4('8.8.8.8')).toBe(false);
    expect(isBlockedIPv4('93.184.216.34')).toBe(false);
  });

  it('blocks every non-routable range', () => {
    for (const address of [
      '0.1.2.3',
      '10.0.0.1',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.169.254',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.0.1',
      '198.18.0.1',
      '224.0.0.1',
      '240.0.0.1',
    ]) {
      expect(isBlockedIPv4(address), address).toBe(true);
    }
  });

  it('does not block addresses just outside a blocked range', () => {
    expect(isBlockedIPv4('172.32.0.1')).toBe(false);
    expect(isBlockedIPv4('11.0.0.1')).toBe(false);
  });
});

describe('expandIPv6', () => {
  it('expands compressed notation', () => {
    expect(expandIPv6('::1')).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(expandIPv6('2001:db8::1')).toEqual([0x2001, 0x0db8, 0, 0, 0, 0, 0, 1]);
  });

  it('expands an embedded IPv4 tail', () => {
    expect(expandIPv6('::ffff:127.0.0.1')).toEqual([0, 0, 0, 0, 0, 0xffff, 0x7f00, 0x0001]);
  });

  it('drops the zone index', () => {
    expect(expandIPv6('fe80::1%eth0')?.[0]).toBe(0xfe80);
  });

  it('returns null for non-IPv6 input', () => {
    expect(expandIPv6('example.com')).toBeNull();
    expect(expandIPv6('1::2::3')).toBeNull();
  });
});

describe('isBlockedIPv6', () => {
  it('allows public addresses', () => {
    expect(isBlockedIPv6('2606:4700:4700::1111')).toBe(false);
  });

  it('blocks loopback, link-local, unique-local and mapped private IPv4', () => {
    for (const address of [
      '::',
      '::1',
      'fc00::1',
      'fd12::9',
      'fe80::1',
      'ff02::1',
      '::ffff:10.0.0.1',
    ]) {
      expect(isBlockedIPv6(address), address).toBe(true);
    }
  });
});

describe('isBlockedHostname', () => {
  it('matches exact names and suffixes, ignoring case and trailing dot', () => {
    expect(isBlockedHostname('LOCALHOST')).toBe(true);
    expect(isBlockedHostname('metadata.google.internal.')).toBe(true);
    expect(isBlockedHostname('anything.home.arpa')).toBe(true);
    expect(isBlockedHostname('example.com')).toBe(false);
  });
});
