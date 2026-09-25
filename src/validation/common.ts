import { z } from 'zod';

import { MAX_PRICE, parsePriceInput } from '@/domain/money';
import { isValidSlug, slugify } from '@/domain/slug';
import { isPublicHttpUrl } from '@/security/url-guard';

/**
 * Shared Zod building blocks.
 *
 * All of these run server-side as well: TypeScript types are erased at runtime
 * and are never treated as validation.
 */

export const uuidSchema = z.string().uuid('Identificador no válido.');

export const slugSchema = z
  .string()
  .trim()
  .min(1, 'El slug es obligatorio.')
  .max(80, 'El slug es demasiado largo.')
  .refine(isValidSlug, 'Usa solo minúsculas, números y guiones (ej. mi-producto).');

/**
 * Slug typed by a human, where the UI promises "leave it empty and we generate
 * one". An empty field becomes `undefined` (the caller derives the slug from the
 * name); anything else is *normalised* rather than rejected, so "Tecnología y
 * Hogar" is accepted and stored as `tecnologia-y-hogar`.
 *
 * `null` is accepted because `FormData.get()` returns it for absent fields.
 */
export const optionalSlugSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value === null || value === undefined || value.trim() === '') return undefined;

    // `slugify` lowercases, strips diacritics, turns runs of invalid characters
    // into single hyphens and caps the length at the DB limit.
    const normalised = slugify(value);

    if (!normalised) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El slug debe contener al menos una letra o un número.',
      });
      return z.NEVER;
    }

    return normalised;
  });

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .optional()
    .transform((value) => (value === undefined || value === '' ? null : value));

/** Public http(s) URL that has passed the SSRF syntax checks. */
export const publicUrlSchema = z
  .string()
  .trim()
  .max(2048, 'La URL es demasiado larga.')
  .refine(isPublicHttpUrl, 'Introduce una URL http(s) pública y válida.');

export const optionalPublicUrlSchema = z
  .union([publicUrlSchema, z.literal('')])
  .optional()
  .transform((value) => (value === undefined || value === '' ? null : value));

/**
 * Money input. Accepts numbers and human strings ("12,99 €") and always ends up
 * as `number | null` — never a silently coerced 0.
 */
export const priceSchema = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value === null || value === undefined || value === '') return null;

    const parsed = typeof value === 'number' ? value : parsePriceInput(value);

    if (parsed === null || !Number.isFinite(parsed)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Precio no válido.' });
      return z.NEVER;
    }
    if (parsed < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El precio no puede ser negativo.' });
      return z.NEVER;
    }
    if (parsed > MAX_PRICE) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'El precio es demasiado alto.' });
      return z.NEVER;
    }

    return Math.round(parsed * 100) / 100;
  });

export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Usa un código ISO de 3 letras (EUR, USD...).');

export const marketSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Usa un código de país ISO de 2 letras (ES, FR...).');

/** `datetime-local` input or ISO string; stored as UTC. */
export const optionalDateSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value === null || value === undefined || value.trim() === '') return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Fecha no válida.' });
      return z.NEVER;
    }
    return date.toISOString();
  });

/**
 * HTML checkbox as it arrives in a `FormData`.
 *
 * A checked box submits its `value` (`"on"` by default); an *unchecked* box is
 * not submitted at all, so `FormData.get()` returns `null`. Both `null` and
 * `undefined` must therefore be valid input and mean `false` — otherwise every
 * form with an unticked checkbox fails validation.
 */
export const checkboxSchema = z
  .union([z.boolean(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return false;
    const normalised = value.trim().toLowerCase();
    return normalised === 'on' || normalised === 'true' || normalised === '1';
  });
