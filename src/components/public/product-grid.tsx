import { ProductCard } from '@/components/public/product-card';
import type { ProductView } from '@/domain/views';

export function ProductGrid({
  products,
  trackingMode,
}: {
  products: ProductView[];
  trackingMode: 'direct' | 'redirect';
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product, index) => (
        <li key={product.id} className="flex">
          <div className="w-full">
            <ProductCard product={product} trackingMode={trackingMode} priority={index < 4} />
          </div>
        </li>
      ))}
    </ul>
  );
}
