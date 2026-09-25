'use client';

import { Copy, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useState } from 'react';

import {
  bulkProductAction,
  deleteProductAction,
  duplicateProductAction,
} from '@/app/admin/(panel)/products/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { formatPrice } from '@/domain/money';
import { primaryOffer } from '@/domain/views';
import { idleState, type ActionState } from '@/lib/action-state';
import type { AdminProductListItem } from '@/repositories/admin/products';
import type { CategoryView } from '@/domain/views';
import type { ProductStatus } from '@/types/database';

const STATUS_LABEL: Record<ProductStatus, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  hidden: 'Oculto',
  archived: 'Archivado',
};

const STATUS_TONE: Record<ProductStatus, 'deal' | 'neutral' | 'warning' | 'muted'> = {
  draft: 'neutral',
  published: 'deal',
  hidden: 'warning',
  archived: 'muted',
};

export function ProductTable({
  items,
  categories,
}: {
  items: AdminProductListItem[];
  categories: CategoryView[];
}) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);

  // Side effects live in the action wrappers rather than in an effect, so a
  // completed action does not trigger a second render pass.
  const notify = (state: ActionState): ActionState => {
    if (state.status !== 'idle' && state.message) {
      toast({ tone: state.status === 'error' ? 'error' : 'success', title: state.message });
    }
    return state;
  };

  const [, bulkAction, bulkPending] = useActionState(
    async (previous: ActionState, formData: FormData) => {
      const result = notify(await bulkProductAction(previous, formData));
      if (result.status === 'success') setSelected([]);
      return result;
    },
    idleState,
  );

  const [, deleteAction] = useActionState(
    async (previous: ActionState, formData: FormData) =>
      notify(await deleteProductAction(previous, formData)),
    idleState,
  );

  const [, duplicateAction] = useActionState(
    async (previous: ActionState, formData: FormData) =>
      notify(await duplicateProductAction(previous, formData)),
    idleState,
  );

  const allSelected = items.length > 0 && selected.length === items.length;

  return (
    <div className="space-y-3">
      <form
        action={bulkAction}
        className="border-ink-200 flex flex-wrap items-end gap-2 rounded-[--radius-card] border bg-white p-3"
      >
        {selected.map((id) => (
          <input key={id} type="hidden" name="ids" value={id} />
        ))}

        <p className="text-ink-600 w-full text-sm sm:w-auto">{selected.length} seleccionado(s)</p>

        <div className="w-44">
          <label htmlFor="bulk-action" className="sr-only">
            Acción en lote
          </label>
          <Select id="bulk-action" name="action" defaultValue="publish">
            <option value="publish">Publicar</option>
            <option value="hide">Ocultar</option>
            <option value="feature">Destacar</option>
            <option value="unfeature">Quitar destacado</option>
            <option value="archive">Archivar</option>
            <option value="set_category">Cambiar categoría</option>
          </Select>
        </div>

        <div className="w-48">
          <label htmlFor="bulk-category" className="sr-only">
            Categoría de destino
          </label>
          <Select id="bulk-category" name="categoryId" defaultValue="">
            <option value="">(sólo para «cambiar categoría»)</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>

        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={selected.length === 0 || bulkPending}
        >
          Aplicar
        </Button>
      </form>

      <div className="border-ink-200 overflow-x-auto rounded-[--radius-card] border bg-white">
        <table className="w-full min-w-[46rem] text-sm">
          <caption className="sr-only">Listado de productos</caption>
          <thead className="bg-ink-50 text-ink-600 text-left text-xs">
            <tr>
              <th scope="col" className="w-10 p-3">
                <input
                  type="checkbox"
                  aria-label="Seleccionar todos"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? [] : items.map((item) => item.id))}
                  className="border-ink-300 text-brand-600 size-4 rounded"
                />
              </th>
              <th scope="col" className="p-3">
                Producto
              </th>
              <th scope="col" className="p-3">
                Categoría
              </th>
              <th scope="col" className="p-3">
                Tienda
              </th>
              <th scope="col" className="p-3">
                Precio
              </th>
              <th scope="col" className="p-3">
                Estado
              </th>
              <th scope="col" className="p-3">
                Clics
              </th>
              <th scope="col" className="p-3 text-right">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-ink-100 divide-y">
            {items.map((item) => {
              const offer = primaryOffer(item) ?? item.offers[0] ?? null;
              const checked = selected.includes(item.id);

              return (
                <tr key={item.id}>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${item.title}`}
                      checked={checked}
                      onChange={() =>
                        setSelected((current) =>
                          checked ? current.filter((id) => id !== item.id) : [...current, item.id],
                        )
                      }
                      className="border-ink-300 text-brand-600 size-4 rounded"
                    />
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/admin/products/${item.id}`}
                      className="text-ink-900 hover:text-brand-700 font-medium"
                    >
                      {item.title}
                    </Link>
                    {item.featured ? (
                      <Badge tone="brand" className="ml-2">
                        Destacado
                      </Badge>
                    ) : null}
                  </td>
                  <td className="text-ink-600 p-3">{item.category?.name ?? '—'}</td>
                  <td className="text-ink-600 p-3">{offer?.provider?.name ?? '—'}</td>
                  <td className="text-ink-600 p-3 tabular-nums">
                    {formatPrice(offer?.currentPrice ?? null, offer?.currency ?? 'EUR') ?? '—'}
                  </td>
                  <td className="p-3">
                    <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                  </td>
                  <td className="text-ink-600 p-3 tabular-nums">{item.clicks}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/products/${item.id}`}
                        aria-label={`Editar ${item.title}`}
                        className="text-ink-500 hover:bg-ink-100 hover:text-ink-900 rounded p-2"
                      >
                        <Pencil aria-hidden className="size-4" />
                      </Link>

                      {item.status === 'published' ? (
                        <Link
                          href={`/producto/${item.slug}`}
                          target="_blank"
                          rel="noopener"
                          aria-label={`Ver ${item.title} en el sitio`}
                          className="text-ink-500 hover:bg-ink-100 hover:text-ink-900 rounded p-2"
                        >
                          <ExternalLink aria-hidden className="size-4" />
                        </Link>
                      ) : null}

                      <form action={duplicateAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <button
                          type="submit"
                          aria-label={`Duplicar ${item.title}`}
                          className="text-ink-500 hover:bg-ink-100 hover:text-ink-900 rounded p-2"
                        >
                          <Copy aria-hidden className="size-4" />
                        </button>
                      </form>

                      <form
                        action={deleteAction}
                        onSubmit={(event) => {
                          // Destructive and irreversible: always confirm first.
                          if (!window.confirm(`¿Eliminar «${item.title}» definitivamente?`)) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="id" value={item.id} />
                        <button
                          type="submit"
                          aria-label={`Eliminar ${item.title}`}
                          className="rounded p-2 text-red-500 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 aria-hidden className="size-4" />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
