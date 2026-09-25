import type { Metadata } from 'next';

import { ProductForm } from '@/components/admin/product-form';
import { QuickAddForm } from '@/components/admin/quick-add-form';
import { listActiveCategories } from '@/repositories/catalog';
import { getSettings } from '@/repositories/settings';

export const metadata: Metadata = { title: 'Añadir producto' };

export default async function NewProductPage() {
  const [categories, settings] = await Promise.all([listActiveCategories(), getSettings()]);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-ink-900 text-xl font-bold">Añadir producto</h1>
        <p className="text-ink-500 mt-1 text-sm">
          La vía rápida: pega el enlace, elige la categoría y publica.
        </p>
        <div className="mt-4">
          <QuickAddForm
            categories={categories}
            defaultCurrency={settings.default_currency}
            defaultMarket={settings.default_market}
          />
        </div>
      </section>

      <section>
        <h2 className="text-ink-900 text-lg font-semibold">…o rellénalo a mano</h2>
        <p className="text-ink-500 mt-1 mb-4 text-sm">
          Útil cuando la tienda no publica metadatos legibles.
        </p>
        <ProductForm
          categories={categories}
          defaultCurrency={settings.default_currency}
          defaultMarket={settings.default_market}
        />
      </section>
    </div>
  );
}
