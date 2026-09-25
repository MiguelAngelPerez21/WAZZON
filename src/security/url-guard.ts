/**
 * Centralised, security-critical URL validation (SSRF defence).
 *
 * Every outbound HTTP request initiated on behalf of a user — today only the
 * "Analyse link" feature — MUST go through `assertSafeRemoteUrl` (and through
 * `safeFetchHtml`, which re-validates every redirect hop).
 *
 * Threat model: an admin (or an attacker who reached the admin form) submits a
 * URL that points at our own infrastructure: localhost services, the container
 * network, or a cloud metadata endpoint (169.254.169.254) that would leak
 * credentials.
 */

export const ALLOWED_PROTOCOLS = ['http:', 'https:'] as const;
export const ALLOWED_PORTS = new Set(['', '80', '443', '8080', '8443']);

export type UrlRejectionReason =
  | 'invalid_url'
  | 'forbidden_protocol'
  | 'credentials_in_url'
  | 'forbidden_port'
  | 'blocked_hostname'
  | 'private_address'
  | 'dns_resolution_failed'
  | 'url_too_long';

export class UnsafeUrlError extends Error {
  readonly reason: UrlRejectionReason;

  constructor(reason: UrlRejectionReason, message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
    this.reason = reason;
  }
}

const MAX_URL_LENGTH = 2048;

/** Hostnames (exact or suffix) that must never be resolved. */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
  'nip.io',
]);

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa', '.localdomain'];

// ---------------------------------------------------------------------------
// IP address classification
// ---------------------------------------------------------------------------

const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function parseIPv4(value: string): number | null {
  const match = IPV4_PATTERN.exec(value);
  if (!match) return null;

  let result = 0;
  for (let index = 1; index <= 4; index += 1) {
    const part = match[index];
    if (part === undefined) return null;
    // Reject octal-looking octets such as 0177.0.0.1.
    if (part.length > 1 && part.startsWith('0')) return null;
    const octet = Number.parseInt(part, 10);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    result = result * 256 + octet;
  }
  return result;
}

interface CidrBlock {
  base: number;
  bits: number;
  label: string;
}

function cidr(address: string, bits: number, label: string): CidrBlock {
  const base = parseIPv4(address);
  if (base === null) throw new Error(`Invalid CIDR base address: ${address}`);
  return { base, bits, label };
}

/** RFC 1918 + every other non-publicly-routable IPv4 range. */
const BLOCKED_IPV4_BLOCKS: CidrBlock[] = [
  cidr('0.0.0.0', 8, 'this-network'),
  cidr('10.0.0.0', 8, 'rfc1918'),
  cidr('100.64.0.0', 10, 'cgnat'),
  cidr('127.0.0.0', 8, 'loopback'),
  cidr('169.254.0.0', 16, 'link-local / cloud metadata'),
  cidr('172.16.0.0', 12, 'rfc1918'),
  cidr('192.0.0.0', 24, 'ietf-protocol'),
  cidr('192.0.2.0', 24, 'documentation'),
  cidr('192.88.99.0', 24, '6to4-relay'),
  cidr('192.168.0.0', 16, 'rfc1918'),
  cidr('198.18.0.0', 15, 'benchmarking'),
  cidr('198.51.100.0', 24, 'documentation'),
  cidr('203.0.113.0', 24, 'documentation'),
  cidr('224.0.0.0', 4, 'multicast'),
  cidr('240.0.0.0', 4, 'reserved'),
];

export function isBlockedIPv4(value: string): boolean {
  const address = parseIPv4(value);
  if (address === null) return false;
  if (address === 0xffffffff) return true; // 255.255.255.255

  return BLOCKED_IPV4_BLOCKS.some(({ base, bits }) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (address & mask) >>> 0 === (base & mask) >>> 0;
  });
}

/** Expands an IPv6 address to its 8 groups, or returns null if malformed. */
export function expandIPv6(value: string): number[] | null {
  let input = value.trim().toLowerCase();
  if (input.startsWith('[') && input.endsWith(']')) input = input.slice(1, -1);
  // Drop a zone index (fe80::1%eth0).
  const zoneIndex = input.indexOf('%');
  if (zoneIndex !== -1) input = input.slice(0, zoneIndex);
  if (!input.includes(':')) return null;

  // An embedded IPv4 tail (::ffff:127.0.0.1) becomes two hex groups.
  const ipv4Tail = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(input);
  if (ipv4Tail?.[1]) {
    const embedded = parseIPv4(ipv4Tail[1]);
    if (embedded === null) return null;
    const high = (embedded >>> 16) & 0xffff;
    const low = embedded & 0xffff;
    input = `${input.slice(0, ipv4Tail.index)}${high.toString(16)}:${low.toString(16)}`;
  }

  const doubleColonParts = input.split('::');
  if (doubleColonParts.length > 2) return null;

  const toGroups = (segment: string): number[] | null => {
    if (segment === '') return [];
    const groups: number[] = [];
    for (const piece of segment.split(':')) {
      if (!/^[0-9a-f]{1,4}$/.test(piece)) return null;
      groups.push(Number.parseInt(piece, 16));
    }
    return groups;
  };

  const head = toGroups(doubleColonParts[0] ?? '');
  if (head === null) return null;

  if (doubleColonParts.length === 1) {
    return head.length === 8 ? head : null;
  }

  const tail = toGroups(doubleColonParts[1] ?? '');
  if (tail === null) return null;

  const fillLength = 8 - head.length - tail.length;
  if (fillLength < 0) return null;

  return [...head, ...Array.from({ length: fillLength }, () => 0), ...tail];
}

export function isBlockedIPv6(value: string): boolean {
  const groups = expandIPv6(value);
  if (!groups) return false;

  const [g0 = 0, g1 = 0, g6 = 0, g7 = 0] = [groups[0], groups[1], groups[6], groups[7]];
  const isAllZeroPrefix = groups.slice(0, 7).every((group) => group === 0);

  if (isAllZeroPrefix && (g7 === 0 || g7 === 1)) return true; // :: and ::1
  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g0 & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (g0 === 0x2001 && g1 === 0x0db8) return true; // documentation
  if (g0 === 0x0064 && g1 === 0xff9b) return true; // NAT64
  // IPv4-mapped (::ffff:a.b.c.d): validate the embedded IPv4 address.
  if (groups.slice(0, 5).every((group) => group === 0) && g6 !== undefined) {
    if (groups[5] === 0xffff) {
      const embedded = `${(g6 >> 8) & 0xff}.${g6 & 0xff}.${(g7 >> 8) & 0xff}.${g7 & 0xff}`;
      return isBlockedIPv4(embedded);
    }
  }

  return false;
}

export function isBlockedIpLiteral(hostname: string): boolean {
  return isBlockedIPv4(hostname) || isBlockedIPv6(hostname);
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  return BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

// ---------------------------------------------------------------------------
// Synchronous validation (no DNS)
// ---------------------------------------------------------------------------

/**
 * Validates everything that can be checked without touching the network.
 * Safe to use in the browser and in Edge runtimes.
 */
export function validatePublicHttpUrl(raw: string): URL {
  const trimmed = raw.trim();

  if (!trimmed) {
    throw new UnsafeUrlError('invalid_url', 'La URL está vacía.');
  }
  if (trimmed.length > MAX_URL_LENGTH) {
    throw new UnsafeUrlError('url_too_long', 'La URL es demasiado larga.');
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new UnsafeUrlError('invalid_url', 'La URL no tiene un formato válido.');
  }

  if (!ALLOWED_PROTOCOLS.includes(url.protocol as (typeof ALLOWED_PROTOCOLS)[number])) {
    throw new UnsafeUrlError('forbidden_protocol', 'Solo se admiten enlaces http:// y https://.');
  }

  if (url.username || url.password) {
    throw new UnsafeUrlError(
      'credentials_in_url',
      'La URL no puede incluir credenciales de acceso.',
    );
  }

  if (!ALLOWED_PORTS.has(url.port)) {
    throw new UnsafeUrlError('forbidden_port', `Puerto no permitido: ${url.port}.`);
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (!hostname) {
    throw new UnsafeUrlError('invalid_url', 'La URL no contiene un host válido.');
  }

  if (isBlockedHostname(hostname)) {
    throw new UnsafeUrlError('blocked_hostname', 'Ese host no está permitido.');
  }

  if (isBlockedIpLiteral(hostname)) {
    throw new UnsafeUrlError(
      'private_address',
      'La URL apunta a una dirección interna o reservada.',
    );
  }

  return url;
}

/** Non-throwing variant, handy for form validation. */
export function isPublicHttpUrl(raw: string): boolean {
  try {
    validatePublicHttpUrl(raw);
    return true;
  } catch {
    return false;
  }
}
