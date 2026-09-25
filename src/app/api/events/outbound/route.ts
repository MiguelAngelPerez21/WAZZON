import { NextResponse, type NextRequest } from 'next/server';

import { siteUrl } from '@/lib/env';
import { recordOutboundEvent } from '@/services/outbound-service';
import { outboundEventSchema } from '@/validation/settings';

/**
 * MODE B click beacon.
 *
 * Called with `navigator.sendBeacon` right before the visitor leaves for the
 * merchant. It records interest only; it never returns data and never redirects.
 */
export const dynamic = 'force-dynamic';

/** Rejects cross-site posts: this endpoint is only for our own pages. */
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // sendBeacon from a same-origin page may omit it.
  try {
    return new URL(origin).origin === new URL(siteUrl).origin;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = outboundEventSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await recordOutboundEvent({
    offerId: parsed.data.offerId,
    productId: parsed.data.productId,
    source: parsed.data.source,
    campaign: parsed.data.campaign,
    referrer: request.headers.get('referer'),
    userAgent: request.headers.get('user-agent'),
  });

  // 204: nothing to return, and nothing to cache.
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
