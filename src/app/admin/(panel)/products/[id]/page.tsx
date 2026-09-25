import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ProductForm } from '@/components/admin/product-form';
import { getAdminProduct } from '@/repositories/admin/products';
import { listActiveCategories } from '@/repositories/catalog';
import { getSettings } from '@/repositories/settings';

export const metadata: Metadata = { title: 'Editar producto' };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getAdminProduct(id);
  if (!product) notFound();

  const [categories, settings] = await Promise.all([listActiveCategories(), getSettings()]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/products" className="text-ink-500 hover:text-ink-800 text-sm">
          ← Productos
        </Link>
        <h1 className="text-ink-900 mt-1 text-xl font-bold">{product.title}</h1>
      </div>

      <ProductForm
        product={product}
        categories={categories}
        defaultCurrency={settings.default_currency}
        defaultMarket={settings.default_market}
      />
    </div>
  );
}
