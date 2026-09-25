/**
 * Image type detection from the file's own bytes.
 *
 * The browser-supplied `Content-Type` is attacker-controlled, so it is never
 * trusted on its own: a file claiming to be `image/png` can be an HTML
 * document or a script. Sniffing the magic numbers means the only thing we can
 * ever put in the public bucket is a real raster image.
 */

export const UPLOADABLE_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const;

export type UploadableImageType = (typeof UPLOADABLE_IMAGE_TYPES)[number];

const EXTENSIONS: Record<UploadableImageType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export function extensionForImageType(type: UploadableImageType): string {
  return EXTENSIONS[type];
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function asciiAt(bytes: Uint8Array, offset: number, text: string): boolean {
  return startsWith(
    bytes,
    Array.from(text, (character) => character.charCodeAt(0)),
    offset,
  );
}

/** Returns the detected type, or `null` when the bytes are not a known image. */
export function sniffImageType(bytes: Uint8Array): UploadableImageType | null {
  // JPEG: SOI marker.
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';

  // PNG: 8-byte signature.
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';

  // WebP: RIFF container whose form type is "WEBP".
  if (asciiAt(bytes, 0, 'RIFF') && asciiAt(bytes, 8, 'WEBP')) return 'image/webp';

  // AVIF: ISO-BMFF box whose brand is "avif" / "avis".
  if (asciiAt(bytes, 4, 'ftyp') && (asciiAt(bytes, 8, 'avif') || asciiAt(bytes, 8, 'avis'))) {
    return 'image/avif';
  }

  return null;
}
