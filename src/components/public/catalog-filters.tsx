import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import type { CategoryView, ProviderView } from '@/domain/views';

export interface CatalogFilterValues {
  category?: string | undefined;
  provider?: string | undefined;
  sort?: string | undefined;
  featured?: boolean | undefined;
  onlyOffers?: boolean | undefined;
  q?: string | undefined;
}

const SORT_OPTIONS = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
  { value: 'popular', label: 'Más visitados' },
];

/**
 * Filters rendered as a plain GET form: no client JavaScript, shareable URLs,
 * and every state is crawlable/bookmarkable.
 *
 * Filters with no data behind them (e.g. providers) are simply not rendered.
 */
export function CatalogFilters({
  action,
  categories,
  providers,
  values,
  showCategory = true,
}: {
  action: string;
  categories: CategoryView[];
  providers: ProviderView[];
  values: CatalogFilterValues;
  showCategory?: boolean;
}) {
  return (
    <form
      action={action}
      method="get"
      className="border-ink-200 bg-ink-50 grid gap-3 rounded-[--radius-card] border p-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
    >
      {values.q ? <input type="hidden" name="q" value={values.q} /> : null}

      {showCategory && categories.length > 0 ? (
        <div className="space-y-1">
          <label htmlFor="filter-category" className="text-ink-700 text-xs font-medium">
            Categoría
          </label>
          <Select id="filter-category" name="categoria" defaultValue={values.category ?? ''}>
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {providers.length > 1 ? (
        <div className="space-y-1">
          <label htmlFor="filter-provider" className="text-ink-700 text-xs font-medium">
            Tienda
          </label>
          <Select id="filter-provider" name="tienda" defaultValue={values.provider ?? ''}>
            <option value="">Todas</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.slug}>
                {provider.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      <div className="space-y-1">
        <label htmlFor="filter-sort" className="text-ink-700 text-xs font-medium">
          Ordenar por
        </label>
        <Select id="filter-sort" name="orden" defaultValue={values.sort ?? 'recent'}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-4 lg:h-10">
        <label className="text-ink-700 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="destacados"
            value="1"
            defaultChecked={values.featured === true}
            className="border-ink-300 text-brand-600 size-4 rounded"
          />
          Destacados
        </label>
        <label className="text-ink-700 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="ofertas"
            value="1"
            defaultChecked={values.onlyOffers === true}
            className="border-ink-300 text-brand-600 size-4 rounded"
          />
          Con oferta
        </label>
      </div>

      <div className="sm:col-span-2 lg:col-span-4">
        <Button type="submit" variant="secondary" size="sm">
          Aplicar filtros
        </Button>
      </div>
    </form>
  );
}
