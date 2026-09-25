import { z } from 'zod';

import { checkboxSchema, optionalSlugSchema, optionalText, uuidSchema } from '@/validation/common';

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, 'El nombre es obligatorio.').max(80, 'Máximo 80 caracteres.'),
  // Optional on purpose: the form states it is derived from the name when left
  // empty. The action resolves the final value.
  slug: optionalSlugSchema,
  description: optionalText(500),
  imageUrl: optionalText(2048),
  icon: optionalText(64),
  seoTitle: optionalText(120),
  seoDescription: optionalText(300),
  active: checkboxSchema,
  sortOrder: z.coerce
    .number()
    .int('Debe ser un número entero.')
    .min(0, 'No puede ser negativo.')
    .max(10_000, 'Valor demasiado alto.'),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const categoryUpdateSchema = categoryInputSchema.extend({ id: uuidSchema });
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
