'use client';

import { ImageOff } from 'lucide-react';
import { useState } from 'react';

import { ProductImage } from '@/components/ui/product-image';
import { cn } from '@/lib/cn';
import type { ProductImageView } from '@/domain/views';

export function ProductGallery({ images, title }: { images: ProductImageView[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  if (!active) {
    return (
      <div className="bg-ink-50 text-ink-300 flex aspect-square items-center justify-center rounded-[--radius-card]">
        <ImageOff aria-hidden className="size-12" />
        <span className="sr-only">Este producto no tiene imagen</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-ink-50 relative aspect-square overflow-hidden rounded-[--radius-card]">
        <ProductImage
          src={active.url}
          alt={active.alt ?? title}
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
        />
      </div>

      {images.length > 1 ? (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Ver imagen ${index + 1} de ${images.length}`}
                aria-pressed={index === activeIndex}
                className={cn(
                  'bg-ink-50 relative size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors',
                  index === activeIndex ? 'border-brand-600' : 'border-transparent',
                )}
              >
                <ProductImage src={image.url} alt="" sizes="64px" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
