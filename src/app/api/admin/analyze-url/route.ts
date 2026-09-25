import { NextResponse, type NextRequest } from 'next/server';

import { isTemuUrl } from '@/config/temu';
import { getCurrentIdentity } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import { resolveImportMode } from '@/providers/metadata/completeness';
import { extractMetadata, MetadataExtractionError } from '@/providers/metadata/registry';
import { UnsafeUrlError } from '@/security/url-guard';
import { detectProviderForUrl, findPotentialDuplicates } from '@/services/duplicates';
import { analyzeUrlSchema } from '@/validation/settings';

/**
 * Quick Add analysis endpoint.
 *
 * Admin-only. Given a product URL it follows the redirect chain (every hop
 * re-validated by the URL guard) and returns whatever public metadata could be
 * read (Open Graph / JSON-LD / standard meta tags).
 *
 * Nothing is invented: a field we could not read comes back as `missing`.
 * Crucially, that is not treated as an error — when the page exposes too
 * little to publish, `mode` switches to `assisted-manual` and the UI opens a
 * pre-filled form instead of showing a failure.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** User-facing copy for the degraded path. Kept next to the decision. */
function assistedManualNotice(isTemu: boolean): { headline: string; detail: string } {
  return {
    headline: isTemu
      ? 'Temu no expone metadata suficiente en este enlace. Puedes completar los datos manualmente.'
      : 'Esta página no expone metadata suficiente. Puedes completar los datos manualmente.',
    detail:
      'No se han podido importar automáticamente los datos, pero puedes publicar el producto ' +
      'manualmente.',
  };
}

export async function POST(request: NextRequest) {
  const identity = await getCurrentIdentity();
  if (identity?.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Petición no válida.' }, { status: 400 });
  }

  const parsed = analyzeUrlSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'URL no válida.' },
      { status: 400 },
    );
  }

  try {
    const report = await extractMetadata(parsed.data.url);

    const [provider, duplicates] = await Promise.all([
      detectProviderForUrl(parsed.data.url),
      findPotentialDuplicates({
        affiliateUrl: parsed.data.url,
        canonicalUrl: report.result.canonicalUrl ?? null,
      }),
    ]);

    const mode = resolveImportMode(report.fields);
    const isTemu = isTemuUrl(parsed.data.url) || isTemuUrl(report.finalUrl);

    return NextResponse.json(
      {
        result: report.result,
        fields: report.fields,
        usedProviders: report.usedProviders,
        warnings: report.warnings,
        provider,
        duplicates,
        mode,
        isTemu,
        finalUrl: report.finalUrl,
        redirected: report.redirected,
        fetched: report.fetched,
        notice: mode === 'assisted-manual' ? assistedManualNotice(isTemu) : null,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof MetadataExtractionError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    logger.error('analyze_url.failed', { error });
    return NextResponse.json({ error: 'No se ha podido analizar el enlace.' }, { status: 500 });
  }
}
