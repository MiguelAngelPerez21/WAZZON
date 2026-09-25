'use client';

import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import { useId, useRef, useState, type DragEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';

export interface PickedImage {
  url: string;
  alt: string | null;
}

/** Mirrors the bucket's `file_size_limit` and the upload endpoint's own cap. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED = 'image/jpeg,image/png,image/webp,image/avif';

/**
 * Product image picker: keep imported images, paste a URL, or upload a file.
 *
 * The upload path exists because a marketplace that publishes no Open Graph
 * image leaves the editor with nothing to attach — and a product with no image
 * cannot be published. Files go to the `product-images` Supabase Storage
 * bucket through an admin-only endpoint that sniffs the real content type;
 * nothing is uploaded straight from the browser to storage.
 */
export function ImagePicker({
  images,
  onChange,
  name = 'images',
  max = 10,
}: {
  images: PickedImage[];
  onChange: (next: PickedImage[]) => void;
  name?: string;
  max?: number;
}) {
  const inputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const full = images.length >= max;

  function add(url: string): void {
    if (images.some((image) => image.url === url)) return;
    onChange([...images, { url, alt: null }].slice(0, max));
  }

  function addFromDraft(): void {
    const value = draft.trim();
    setError(null);

    if (!value.startsWith('https://')) {
      setError('La URL de la imagen debe empezar por https://.');
      return;
    }
    add(value);
    setDraft('');
  }

  async function upload(files: FileList | File[]): Promise<void> {
    const queue = Array.from(files).slice(0, max - images.length);
    if (queue.length === 0) return;

    setError(null);
    setUploading(true);
    const uploaded: PickedImage[] = [];

    try {
      for (const file of queue) {
        if (file.size > MAX_UPLOAD_BYTES) {
          setError(`"${file.name}" supera el límite de 5 MB.`);
          continue;
        }

        const body = new FormData();
        body.append('file', file);

        const response = await fetch('/api/admin/uploads/product-image', {
          method: 'POST',
          body,
        });
        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          setError(
            typeof payload === 'object' && payload !== null && 'error' in payload
              ? String((payload as { error: unknown }).error)
              : 'No se ha podido subir la imagen.',
          );
          continue;
        }

        const url =
          typeof payload === 'object' && payload !== null && 'url' in payload
            ? String((payload as { url: unknown }).url)
            : null;
        if (url) uploaded.push({ url, alt: null });
      }
    } catch {
      setError('No se ha podido contactar con el servidor.');
    } finally {
      setUploading(false);
    }

    if (uploaded.length > 0) {
      const merged = [...images];
      for (const image of uploaded) {
        if (!merged.some((existing) => existing.url === image.url)) merged.push(image);
      }
      onChange(merged.slice(0, max));
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setDragging(false);

    if (event.dataTransfer.files.length > 0) {
      void upload(event.dataTransfer.files);
      return;
    }

    // Dragging an image from another browser tab drops a URL, not a file.
    const dropped =
      event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text');
    const value = dropped.split(/\r?\n/)[0]?.trim() ?? '';
    if (value.startsWith('https://')) {
      add(value);
    } else if (value) {
      setError('Sólo se aceptan imágenes https.');
    }
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(images)} />

      {images.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {images.map((image, index) => (
            <li key={image.url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary remote URL */}
              <img
                src={image.url}
                alt={image.alt ?? ''}
                referrerPolicy="no-referrer"
                className="border-ink-200 size-24 rounded-lg border object-cover"
              />
              <button
                type="button"
                onClick={() => onChange(images.filter((_, position) => position !== index))}
                aria-label={`Quitar imagen ${index + 1}`}
                className="absolute -top-2 -right-2 rounded-full bg-white p-1 text-red-600 shadow"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
              {index === 0 ? (
                <span className="bg-ink-900/80 absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-white">
                  Principal
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-500 text-sm">Sin imágenes.</p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={inputId}
          aria-label="URL de la imagen"
          placeholder="https://…"
          value={draft}
          disabled={full}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            // Inside a <form>, Enter would submit the product.
            event.preventDefault();
            addFromDraft();
          }}
        />
        <Button type="button" variant="secondary" onClick={addFromDraft} disabled={full}>
          <ImagePlus aria-hidden className="size-4" />
          Añadir URL
        </Button>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`rounded-[--radius-card] border-2 border-dashed p-4 text-center transition-colors ${
          dragging ? 'border-brand-500 bg-brand-50' : 'border-ink-200 bg-ink-50/50'
        }`}
      >
        <p className="text-ink-600 text-sm">
          Arrastra una imagen aquí o{' '}
          <button
            type="button"
            className="text-brand-700 font-medium underline underline-offset-2 disabled:opacity-50"
            onClick={() => fileInput.current?.click()}
            disabled={uploading || full}
          >
            súbela desde tu equipo
          </button>
          .
        </p>
        <p className="text-ink-400 mt-1 text-xs">JPG, PNG, WebP o AVIF. Máximo 5 MB.</p>
        {uploading ? (
          <p className="text-ink-600 mt-2 flex items-center justify-center gap-2 text-sm">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Subiendo…
          </p>
        ) : null}
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED}
          multiple
          className="sr-only"
          onChange={(event) => {
            const { files } = event.target;
            if (files) void upload(files);
            // Allow re-selecting the same file after a failed attempt.
            event.target.value = '';
          }}
        />
      </div>

      {full ? (
        <p className="text-ink-500 text-xs">Máximo {max} imágenes.</p>
      ) : (
        <p className="text-ink-400 text-xs">
          <Upload aria-hidden className="mr-1 inline size-3" />
          Las imágenes subidas se guardan en tu propio almacenamiento.
        </p>
      )}

      {error ? (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
