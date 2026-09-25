import type { Metadata } from 'next';

import { CategoryManager } from '@/components/admin/category-manager';
import { listAdminCategories } from '@/repositories/admin/catalog';

export const metadata: Metadata = { title: 'Categorías' };

export default async function AdminCategoriesPage() {
  const categories = await listAdminCategories();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-ink-900 text-xl font-bold">Categorías</h1>
        <p className="text-ink-500 text-sm">
          Una categoría con productos no puede eliminarse: primero mueve o archiva sus productos.
        </p>
      </div>

      <CategoryManager
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          icon: category.icon,
          active: category.active,
          sortOrder: category.sortOrder,
          productCount: category.productCount,
        }))}
      />
    </div>
  );
}
