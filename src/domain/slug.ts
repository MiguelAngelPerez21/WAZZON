/**
 * Slug generation.
 *
 * Must stay in sync with the `^[a-z0-9]+(?:-[a-z0-9]+)*$` CHECK constraint used
 * by `products.slug` and `categories.slug`.
 */

const MAX_SLUG_LENGTH = 80;

export function slugify(input: string): string {
  return (
    input
      .normalize('NFD')
      // Strip diacritics (á -> a) but keep the base letters.
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[ñÑ]/g, 'n')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_SLUG_LENGTH)
      .replace(/-+$/g, '')
  );
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= MAX_SLUG_LENGTH;
}

/**
 * Appends a numeric suffix until the slug is free.
 * `taken` is the set of slugs already present in the database.
 */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  const root = slugify(base) || 'producto';
  if (!taken.has(root)) return root;

  for (let index = 2; index < 1000; index += 1) {
    const suffix = `-${index}`;
    const candidate = `${root.slice(0, MAX_SLUG_LENGTH - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }

  // Extremely unlikely; keeps the function total instead of throwing.
  return `${root.slice(0, MAX_SLUG_LENGTH - 14)}-${Date.now().toString(36)}`;
}
