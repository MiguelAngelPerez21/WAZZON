/**
 * Outbound click tracking (client side).
 *
 * Only two non-identifying values are attached: `utm_source` and
 * `utm_campaign` from the current URL. No fingerprinting, no IP, no cookies.
 */

const MAX_PARAM_LENGTH = 64;

function readParam(params: URLSearchParams, name: string): string | undefined {
  const value = params.get(name);
  if (!value) return undefined;
  const cleaned = value.trim().slice(0, MAX_PARAM_LENGTH);
  return cleaned.length > 0 ? cleaned : undefined;
}

export interface OutboundAttribution {
  source?: string | undefined;
  campaign?: string | undefined;
}

export function readAttribution(): OutboundAttribution {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return {
    source: readParam(params, 'utm_source'),
    campaign: readParam(params, 'utm_campaign'),
  };
}

/**
 * Records a click without delaying navigation.
 *
 * `sendBeacon` survives the page unload; `fetch(keepalive)` is the fallback.
 * Failures are swallowed on purpose — analytics must never break the user's
 * journey to the merchant.
 */
export function recordOutboundClick(offerId: string, productId?: string): void {
  if (typeof window === 'undefined') return;

  const payload = JSON.stringify({ offerId, productId, ...readAttribution() });

  try {
    if (typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([payload], { type: 'application/json' });
      if (navigator.sendBeacon('/api/events/outbound', blob)) return;
    }

    void fetch('/api/events/outbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Ignore: tracking is best-effort.
  }
}
