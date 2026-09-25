'use client';

import { ExternalLink } from 'lucide-react';

import { readAttribution, recordOutboundClick } from '@/analytics/outbound';
import { Button, type ButtonProps } from '@/components/ui/button';

/**
 * The single call-to-action that sends a visitor to the merchant.
 *
 * MODE A (`redirect`) — the link points at `/go/[offerId]`; the server records
 *   the click and then redirects. Only used when the provider's affiliate
 *   program allows intermediate redirects (`allowsRedirectTracking`).
 * MODE B (`direct`)   — the link points straight at the affiliate URL and the
 *   click is recorded with a beacon. Always compliant, and the default.
 *
 * The destination always comes from the database; it is never taken from a
 * query parameter.
 */
export function OutboundCta({
  offerId,
  productId,
  affiliateUrl,
  trackingMode,
  allowsRedirectTracking,
  label = 'Ver oferta',
  size = 'lg',
  variant = 'primary',
  className,
}: {
  offerId: string;
  productId: string;
  affiliateUrl: string;
  trackingMode: 'direct' | 'redirect';
  allowsRedirectTracking: boolean;
  label?: string;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
  className?: string;
}) {
  const useRedirect = trackingMode === 'redirect' && allowsRedirectTracking;

  let href = affiliateUrl;
  if (useRedirect) {
    const params = new URLSearchParams();
    const { source, campaign } = readAttribution();
    if (source) params.set('source', source);
    if (campaign) params.set('campaign', campaign);
    const query = params.toString();
    href = `/go/${offerId}${query ? `?${query}` : ''}`;
  }

  return (
    <Button asChild size={size} variant={variant} className={className}>
      <a
        href={href}
        target="_blank"
        // `sponsored` is required for affiliate links; `noopener`/`noreferrer`
        // prevent the merchant page from touching our window.
        rel="sponsored nofollow noopener noreferrer"
        onClick={() => {
          if (!useRedirect) recordOutboundClick(offerId, productId);
        }}
      >
        {label}
        <ExternalLink aria-hidden className="size-4" />
        <span className="sr-only">(se abre en una pestaña nueva)</span>
      </a>
    </Button>
  );
}
