import 'server-only';

import { mapCategory, type CategoryView } from '@/domain/views';
import { logger } from '@/lib/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const CATEGORY_COLUMNS =
  'id, name, slug, description, image_url, icon, seo_title, seo_description, active, sort_order';

export interface AdminCategory extends CategoryView {
  productCount: number;
}

export async function listAdminCategories(): Promise<AdminCategory[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('categories')
    .select(`${CATEGORY_COLUMNS}, products(count)`)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .returns<(Parameters<typeof mapCategory>[0] & { products: { count: number }[] })[]>();

  if (error) {
    logger.error('admin.categories.list_failed', { error });
    throw new Error('No se han podido cargar las categorías.');
  }

  return (data ?? []).map((row) => ({
    ...mapCategory(row),
    productCount: row.products?.[0]?.count ?? 0,
  }));
}

export async function getAdminCategory(id: string): Promise<CategoryView | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('categories')
    .select(CATEGORY_COLUMNS)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    logger.error('admin.categories.get_failed', { error, id });
    throw new Error('No se ha podido cargar la categoría.');
  }

  return data ? mapCategory(data) : null;
}

// There is no admin provider listing: the editor never picks a store. The
// public `listActiveProviders` in `@/repositories/catalog` still reads the
// table for the catalog filter, so the multi-provider model stays exercised.
