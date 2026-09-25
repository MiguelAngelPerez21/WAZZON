import { describe, expect, it } from 'vitest';

import { categoryInputSchema } from '@/validation/category';
import { checkboxSchema, optionalSlugSchema } from '@/validation/common';
import { productInputSchema } from '@/validation/product';

/**
 * Mirrors `payload()` in the categories server action, including its `text()`
 * helper, so these tests exercise the exact object the schema receives.
 *
 * The important detail being pinned down here: an *unchecked* checkbox is not
 * submitted at all, so `FormData.get()` returns `null` rather than `undefined`
 * or `"off"`.
 */
function formPayload(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.append(key, value);

  const text = (key: string): string | undefined => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : undefined;
  };

  return {
    name: text('name') ?? '',
    slug: formData.get('slug'),
    description: text('description'),
    imageUrl: text('imageUrl'),
    icon: text('icon'),
    seoTitle: text('seoTitle'),
    seoDescription: text('seoDescription'),
    active: formData.get('active'),
    sortOrder: text('sortOrder') || '0',
  };
}

describe('checkboxSchema', () => {
  it('treats a checked box as true', () => {
    expect(checkboxSchema.parse('on')).toBe(true);
    expect(checkboxSchema.parse('true')).toBe(true);
    expect(checkboxSchema.parse('1')).toBe(true);
    expect(checkboxSchema.parse(true)).toBe(true);
  });

  it('treats an absent field as false instead of failing', () => {
    // `FormData.get()` returns null for a checkbox that was not ticked.
    expect(checkboxSchema.parse(null)).toBe(false);
    expect(checkboxSchema.parse(undefined)).toBe(false);
    expect(checkboxSchema.parse(false)).toBe(false);
    expect(checkboxSchema.parse('off')).toBe(false);
  });
});

describe('optionalSlugSchema', () => {
  it('maps an empty field to undefined so the caller can generate one', () => {
    expect(optionalSlugSchema.parse('')).toBeUndefined();
    expect(optionalSlugSchema.parse('   ')).toBeUndefined();
    expect(optionalSlugSchema.parse(null)).toBeUndefined();
    expect(optionalSlugSchema.parse(undefined)).toBeUndefined();
  });

  it('normalises instead of rejecting', () => {
    expect(optionalSlugSchema.parse('Tecnología y Hogar')).toBe('tecnologia-y-hogar');
    expect(optionalSlugSchema.parse('  Mi   Slug!!  ')).toBe('mi-slug');
    expect(optionalSlugSchema.parse('Año Nuevo')).toBe('ano-nuevo');
  });

  it('keeps an already valid slug untouched', () => {
    expect(optionalSlugSchema.parse('mascotas-ofertas')).toBe('mascotas-ofertas');
  });

  it('rejects input with nothing sluggable in it', () => {
    const result = optionalSlugSchema.safeParse('!!!???');
    expect(result.success).toBe(false);
  });
});

describe('categoryInputSchema', () => {
  // Case A of the reported bug report.
  it('accepts an empty slug and leaves it for the action to generate', () => {
    const result = categoryInputSchema.safeParse(
      formPayload({ name: 'Tecnología y Hogar', slug: '', active: 'on' }),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.slug).toBeUndefined();
    expect(result.data.active).toBe(true);
  });

  // Case B.
  it('keeps a manually typed slug', () => {
    const result = categoryInputSchema.safeParse(
      formPayload({ name: 'Mascotas', slug: 'mascotas-ofertas', active: 'on' }),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.slug).toBe('mascotas-ofertas');
  });

  // Case C: the checkbox is simply absent from the FormData.
  it('creates an inactive category when the checkbox is not ticked', () => {
    const result = categoryInputSchema.safeParse(formPayload({ name: 'Jardín', slug: '' }));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.active).toBe(false);
    expect(result.data.slug).toBeUndefined();
  });

  // Case E.
  it('reports a field error when the name is empty', () => {
    const result = categoryInputSchema.safeParse(formPayload({ name: '', active: 'on' }));

    expect(result.success).toBe(false);
    if (result.success) return;

    const fieldErrors = result.error.flatten().fieldErrors;
    expect(fieldErrors.name?.[0]).toBe('El nombre es obligatorio.');
    // The bug under investigation: these must NOT be reported any more.
    expect(fieldErrors.slug).toBeUndefined();
    expect(fieldErrors.active).toBeUndefined();
  });

  it('normalises an accented slug typed by hand', () => {
    const result = categoryInputSchema.safeParse(
      formPayload({ name: 'Bebés', slug: 'Bebés y Mamás', active: 'on' }),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.slug).toBe('bebes-y-mamas');
  });

  it('defaults sortOrder to 0 and rejects a non-numeric value', () => {
    const ok = categoryInputSchema.safeParse(formPayload({ name: 'Hogar', active: 'on' }));
    expect(ok.success && ok.data.sortOrder).toBe(0);

    const bad = categoryInputSchema.safeParse(
      formPayload({ name: 'Hogar', sortOrder: 'diez', active: 'on' }),
    );
    expect(bad.success).toBe(false);
  });
});

describe('productInputSchema', () => {
  const base = {
    title: 'Auriculares Bluetooth',
    categoryId: '3f3f0f2e-4d2b-4a5f-9a3c-1b2c3d4e5f60',
    shortDescription: undefined,
    description: undefined,
    images: [],
    status: 'draft',
  };

  it('accepts an empty slug and an unticked featured checkbox', () => {
    const result = productInputSchema.safeParse({ ...base, slug: null, featured: null });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.slug).toBeUndefined();
    expect(result.data.featured).toBe(false);
  });

  it('normalises a manually typed slug', () => {
    const result = productInputSchema.safeParse({
      ...base,
      slug: 'Auriculares Bluetooth Pro',
      featured: 'on',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.slug).toBe('auriculares-bluetooth-pro');
    expect(result.data.featured).toBe(true);
  });
});
