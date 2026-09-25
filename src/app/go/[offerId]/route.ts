import { NextResponse, type NextRequest } from 'next/server';

import { uuidSchema } from '@/validation/common';
import { recordOutboundEvent, resolveOfferRedirect } from '@/services/outbound-service';

/**
 * MODE A affiliate redirect: `/go/[offerId]`.
 *
 * The destination is resolved from the database and validated; it is never read
 * from a query parameter, so this endpoint cannot be used as an open redirect.
 * Only `source` and `campaign` labels are accepted from the URL.
 *
 * Use it only with providers whose programme allows an intermediate redirect.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> },
) {
  const { offerId } = await params;
  const parsed = uuidSchema.safeParse(offerId);
  if (!parsed.success) return NextResponse.redirect(new URL('/', request.url), 302);

  const target = await resolveOfferRedirect(parsed.data);
  if (!target) return NextResponse.redirect(new URL('/', request.url), 302);

  const searchParams = request.nextUrl.searchParams;
  await recordOutboundEvent({
    offerId: parsed.data,
    productId: target.productId,
    source: searchParams.get('source') ?? undefined,
    campaign: searchParams.get('campaign') ?? undefined,
    referrer: request.headers.get('referer'),
    userAgent: request.headers.get('user-agent'),
  });

  // 302: the destination may change, so it must not be cached by the browser.
  const response = NextResponse.redirect(target.affiliateUrl, 302);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
