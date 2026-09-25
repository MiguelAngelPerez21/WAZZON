'use client';

import { Trash2 } from 'lucide-react';
import { useActionState, useState } from 'react';

import { deleteCategoryAction, saveCategoryAction } from '@/app/admin/(panel)/categories/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { idleState, type ActionState } from '@/lib/action-state';

export interface CategoryRowItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  active: boolean;
  sortOrder: number;
  productCount: number;
}

/**
 * Categories are few and rarely change, so editing happens inline instead of on
 * a separate page: fewer clicks, no navigation.
 */
export function CategoryManager({ categories }: { categories: CategoryRowItem[] }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<CategoryRowItem | null>(null);

  // Side effects live in the action wrapper rather than in an effect, so a
  // successful save does not trigger a second render pass.
  const notify = (state: ActionState): ActionState => {
    if (state.status !== 'idle' && state.message) {
      toast({ tone: state.status === 'error' ? 'error' : 'success', title: state.message });
    }
    return state;
  };

  const [saveState, saveAction, saving] = useActionState(
    async (previous: ActionState, formData: FormData) => {
      const result = notify(await saveCategoryAction(previous, formData));
      if (result.status === 'success') setEditing(null);
      return result;
    },
    idleState,
  );

  const [, deleteAction] = useActionState(
    async (previous: ActionState, formData: FormData) =>
      notify(await deleteCategoryAction(previous, formData)),
    idleState,
  );

  const error = (field: string) => saveState.fieldErrors?.[field]?.[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="border-ink-200 overflow-x-auto rounded-[--radius-card] border bg-white">
        <table className="w-full min-w-[34rem] text-sm">
          <caption className="sr-only">Categorías</caption>
          <thead className="bg-ink-50 text-ink-600 text-left text-xs">
            <tr>
              <th scope="col" className="p-3">
                Nombre
              </th>
              <th scope="col" className="p-3">
                Slug
              </th>
              <th scope="col" className="p-3">
                Productos
              </th>
              <th scope="col" className="p-3">
                Estado
              </th>
              <th scope="col" className="p-3 text-right">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-ink-100 divide-y">
            {categories.map((category) => (
              <tr key={category.id}>
                <td className="text-ink-900 p-3 font-medium">{category.name}</td>
                <td className="text-ink-500 p-3 font-mono text-xs">{category.slug}</td>
                <td className="text-ink-600 p-3 tabular-nums">{category.productCount}</td>
                <td className="p-3">
                  <Badge tone={category.active ? 'deal' : 'muted'}>
                    {category.active ? 'Activa' : 'Inactiva'}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(category)}>
                      Editar
                    </Button>
                    <form
                      action={deleteAction}
                      onSubmit={(event) => {
                        if (!window.confirm(`¿Eliminar la categoría «${category.name}»?`)) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="id" value={category.id} />
                      <button
                        type="submit"
                        aria-label={`Eliminar ${category.name}`}
                        disabled={category.productCount > 0}
                        className="rounded p-2 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form
        key={editing?.id ?? 'new'}
        action={saveAction}
        className="border-ink-200 h-fit space-y-4 rounded-[--radius-card] border bg-white p-4"
      >
        <h2 className="text-ink-900 text-base font-semibold">
          {editing ? `Editar «${editing.name}»` : 'Nueva categoría'}
        </h2>

        {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

        <Field id="cat-name" label="Nombre" required error={error('name')}>
          <Input
            id="cat-name"
            name="name"
            defaultValue={editing?.name ?? ''}
            required
            maxLength={80}
          />
        </Field>

        <Field
          id="cat-slug"
          label="Slug"
          hint="Se genera solo si lo dejas vacío."
          error={error('slug')}
        >
          <Input id="cat-slug" name="slug" defaultValue={editing?.slug ?? ''} maxLength={80} />
        </Field>

        <Field id="cat-description" label="Descripción" error={error('description')}>
          <Textarea
            id="cat-description"
            name="description"
            defaultValue={editing?.description ?? ''}
            maxLength={500}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field id="cat-icon" label="Icono" error={error('icon')}>
            <Input id="cat-icon" name="icon" defaultValue={editing?.icon ?? ''} maxLength={40} />
          </Field>
          <Field id="cat-sort" label="Orden" error={error('sortOrder')}>
            <Input
              id="cat-sort"
              name="sortOrder"
              inputMode="numeric"
              defaultValue={editing?.sortOrder ?? 0}
            />
          </Field>
        </div>

        <div className="space-y-1.5">
          <label className="text-ink-700 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="active"
              value="on"
              defaultChecked={editing ? editing.active : true}
              aria-invalid={error('active') ? true : undefined}
              className="border-ink-300 text-brand-600 size-4 rounded"
            />
            Activa
          </label>
          {error('active') ? (
            <p className="text-xs font-medium text-red-600">{error('active')}</p>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
          {editing ? (
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
