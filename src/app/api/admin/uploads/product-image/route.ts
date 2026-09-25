import { randomUUID } from 'node:crypto';

import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentIdentity } from '@/lib/auth/session';
import { extensionForImageType, sniffImageType } from '@/lib/images/sniff';
import { logger } from '@/lib/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Manual product-image upload (drag & drop or file picker).
 *
 * Needed because marketplaces that publish no Open Graph image leave the
 * editor with nothing to attach, and a product without an image cannot be
 * published.
 *
 * Security notes:
 *  - admin-only, re-checked here and again by Storage RLS;
 *  - the declared MIME type is ignored: the real type is sniffed from the
 *    bytes, so only genuine raster images can reach the public bucket;
 *  - the file name supplied by the browser is discarded — the object key is a
 *    random UUID — which removes path traversal and content-type confusion;
 *  - size is capped here and again by the bucket's own `file_size_limit`.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'product-images';
/** Matches the bucket's `file_size_limit` declared in the migrations. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const identity = await getCurrentIdentity();
  if (identity?.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No se ha recibido ningún archivo.' }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: 'El archivo está vacío.' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'La imagen supera el límite de 5 MB.' }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniffImageType(bytes);
  if (!contentType) {
    return NextResponse.json(
      { error: 'Formato no admitido. Usa JPG, PNG, WebP o AVIF.' },
      { status: 415 },
    );
  }

  const objectKey = `${randomUUID()}.${extensionForImageType(contentType)}`;
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.storage.from(BUCKET).upload(objectKey, bytes, {
    contentType,
    cacheControl: '31536000',
    upsert: false,
  });

  if (error) {
    logger.error('upload.product_image_failed', { error });
    return NextResponse.json({ error: 'No se ha podido subir la imagen.' }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(objectKey);

  return NextResponse.json({ url: publicUrl }, { headers: { 'Cache-Control': 'no-store' } });
}
