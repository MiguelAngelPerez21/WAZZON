'use server';

import { revalidatePath } from 'next/cache';

import { slugify, uniqueSlug } from '@/domain/slug';
import { errorState, successState, type ActionState } from '@/lib/action-state';
import { requireAdmin } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { categoryInputSchema } from '@/validation/category';

function revalidateCategories(): void {
  revalidatePath('/', 'layout');
  revalidatePath('/admin/categories');
}

function text(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

function payload(formData: FormData) {
  return {
    name: text(formData, 'name') ?? '',
    // Passed through raw: the schema decides whether it is empty (auto-generate)
    // and normalises it otherwise.
    slug: formData.get('slug'),
    description: text(formData, 'description'),
    imageUrl: text(formData, 'imageUrl'),
    icon: text(formData, 'icon'),
    seoTitle: text(formData, 'seoTitle'),
    seoDescription: text(formData, 'seoDescription'),
    // `null` when the box is unchecked — `checkboxSchema` maps it to `false`.
    active: formData.get('active'),
    sortOrder: text(formData, 'sortOrder') || '0',
  };
}

type SlugResolution = { ok: true; slug: string } | { ok: false; message: string };

/**
 * Decides the final slug without relying on a unique-violation round trip.
 *
 * A slug the admin typed is never silently altered: a collision is reported as
 * a field error. A slug derived from the name gets a numeric suffix instead, so
 * creating "Mascotas" twice just works.
 */
async function resolveCategorySlug(
  desired: string | undefined,
  name: string,
  currentSlug?: string,
): Promise<SlugResolution> {
  const explicit = desired !== undefined;
  const base = explicit ? desired : slugify(name);

  if (!base) {
    return {
      ok: false,
      message: 'No se puede generar un slug con ese nombre. Escríbelo manualmente.',
    };
  }

  // Unchanged on edit: nothing to check.
  if (base === currentSlug) return { ok: true, slug: base };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('categories').select('slug').like('slug', `${base}%`);

  if (error) throw error;

  const taken = new Set((data ?? []).map((row) => row.slug));
  if (currentSlug) taken.delete(currentSlug);

  if (explicit) {
    return taken.has(base)
      ? { ok: false, message: 'Ya existe otra categoría con este slug.' }
      : { ok: true, slug: base };
  }

  return { ok: true, slug: uniqueSlug(base, taken) };
}

export async function saveCategoryAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = text(formData, 'id');
  const parsed = categoryInputSchema.safeParse(payload(formData));

  if (!parsed.success) {
    return errorState('Revisa los campos marcados.', parsed.error.flatten().fieldErrors);
  }

  const supabase = await createSupabaseServerClient();
  const input = parsed.data;

  try {
    if (id) {
      const { data: existing } = await supabase
        .from('categories')
        .select('slug')
        .eq('id', id)
        .maybeSingle();

      if (!existing) return errorState('La categoría no existe.');

      const resolved = await resolveCategorySlug(input.slug, input.name, existing.slug);
      if (!resolved.ok) {
        return errorState('Revisa los campos marcados.', { slug: [resolved.message] });
      }

      const { error } = await supabase
        .from('categories')
        .update({
          name: input.name,
          slug: resolved.slug,
          description: input.description,
          image_url: input.imageUrl,
          icon: input.icon,
          seo_title: input.seoTitle,
          seo_description: input.seoDescription,
          active: input.active,
          sort_order: input.sortOrder,
        })
        .eq('id', id);

      if (error) throw error;
      revalidateCategories();
      return successState('Categoría actualizada.');
    }

    const resolved = await resolveCategorySlug(input.slug, input.name);
    if (!resolved.ok) {
      return errorState('Revisa los campos marcados.', { slug: [resolved.message] });
    }

    const { error } = await supabase.from('categories').insert({
      name: input.name,
      slug: resolved.slug,
      description: input.description,
      image_url: input.imageUrl,
      icon: input.icon,
      seo_title: input.seoTitle,
      seo_description: input.seoDescription,
      active: input.active,
      sort_order: input.sortOrder,
    });

    if (error) throw error;
    revalidateCategories();
    return successState('Categoría creada.');
  } catch (error) {
    logger.error('category.save_failed', { error });
    return errorState('No se ha podido guardar la categoría.');
  }
}

export async function deleteCategoryAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const id = text(formData, 'id');
  if (!id) return errorState('Categoría no válida.');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('categories').delete().eq('id', id);

  if (error) {
    // `products.category_id` is ON DELETE RESTRICT: a category in use is kept.
    logger.warn('category.delete_failed', { error, id });
    return errorState('No se puede borrar: hay productos en esta categoría.');
  }

  revalidateCategories();
  return successState('Categoría eliminada.');
}
