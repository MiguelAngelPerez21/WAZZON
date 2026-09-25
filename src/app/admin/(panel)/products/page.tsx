import { PackagePlus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ProductTable } from '@/components/admin/product-table';
import { Pagination } from '@/components/public/pagination';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input, Select } from '@/components/ui/field';
import { buildPageHref, readPage, readParam, type SearchParams } from '@/lib/catalog-params';
import { listAdminProducts, type AdminProductFilters } from '@/repositories/admin/products';
import { listActiveCategories } from '@/repositories/catalog';
import type { ProductStatus } from '@/types/database';

export const metadata: Metadata = { title: 'Productos' };

const STATUSES: (ProductStatus | 'all')[] = ['all', 'draft', 'published', 'hidden', 'archived'];

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const categories = await listActiveCategories();

  const statusParam = readParam(params, 'estado');
  const status = STATUSES.find((value) => value === statusParam);
  const sortParam = readParam(params, 'orden');

  const filters: AdminProductFilters = {
    page: readPage(params),
    ...(readParam(params, 'q') ? { search: readParam(params, 'q') } : {}),
    ...(status ? { status } : {}),
    ...(readParam(params, 'categoria') ? { categoryId: readParam(params, 'categoria') } : {}),
    ...(sortParam === 'title' || sortParam === 'updated' ? { sort: sortParam } : {}),
  };

  const result = await listAdminProducts(filters);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-ink-900 text-xl font-bold">Productos</h1>
          <p className="text-ink-500 text-sm">{result.total} en total</p>
        </div>
        <Button asChild>
          <Link href="/admin/products/new">
            <PackagePlus aria-hidden className="size-4" />
            Añadir producto
          </Link>
        </Button>
      </div>

      <form
        action="/admin/products"
        method="get"
        className="border-ink-200 grid gap-3 rounded-[--radius-card] border bg-white p-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
      >
        <div className="space-y-1 lg:col-span-2">
          <label htmlFor="q" className="text-ink-700 text-xs font-medium">
            Buscar
          </label>
          <Input id="q" name="q" type="search" defaultValue={readParam(params, 'q') ?? ''} />
        </div>

        <div className="space-y-1">
          <label htmlFor="estado" className="text-ink-700 text-xs font-medium">
            Estado
          </label>
          <Select id="estado" name="estado" defaultValue={statusParam ?? ''}>
            <option value="">Activos</option>
            <option value="all">Todos</option>
            <option value="draft">Borrador</option>
            <option value="published">Publicado</option>
            <option value="hidden">Oculto</option>
            <option value="archived">Archivado</option>
          </Select>
        </div>

        <div className="space-y-1">
          <label htmlFor="categoria" className="text-ink-700 text-xs font-medium">
            Categoría
          </label>
          <Select
            id="categoria"
            name="categoria"
            defaultValue={readParam(params, 'categoria') ?? ''}
          >
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <label htmlFor="orden" className="text-ink-700 text-xs font-medium">
              Ordenar
            </label>
            <Select id="orden" name="orden" defaultValue={sortParam ?? 'recent'}>
              <option value="recent">Más recientes</option>
              <option value="updated">Actualizados</option>
              <option value="title">Título</option>
            </Select>
          </div>
          <Button type="submit" variant="secondary" size="sm" className="self-end">
            Filtrar
          </Button>
        </div>
      </form>

      {result.items.length === 0 ? (
        <EmptyState
          title="No hay productos con estos filtros"
          description="Prueba a quitar filtros o añade tu primer producto."
          action={
            <Button asChild>
              <Link href="/admin/products/new">Añadir producto</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ProductTable items={result.items} categories={categories} />
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            buildHref={(value) => buildPageHref('/admin/products', params, value)}
          />
        </>
      )}
    </div>
  );
}
