import 'server-only';

import { logger } from '@/lib/logger';
import { supabasePublic } from '@/lib/supabase/public';
import { isSupabaseConfigured } from '@/lib/env';
import { isPublicHttpUrl } from '@/security/url-guard';
import type { DeviceType } from '@/types/database';

/**
 * Server-side outbound click recording.
 *
 * Runs through the anonymous client on purpose: the RLS policy only accepts the
 * insert when the offer is genuinely public, so a forged `offerId` cannot be
 * used to probe drafts. No IP and no raw referrer are ever stored.
 */

const MAX_TEXT = 64;

export interface OutboundEventInput {
  offerId: string;
  productId?: string | undefined;
  source?: string | undefined;
  campaign?: string | undefined;
  referrer?: string | null | undefined;
  userAgent?: string | null | undefined;
}

function clean(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim().slice(0, MAX_TEXT);
  return trimmed.length > 0 ? trimmed : null;
}

/** Only the host of the referrer is kept, and never a raw IP. */
export function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    const { hostname } = new URL(referrer);
    if (/^[\d.]+$/.test(hostname) || hostname.includes(':')) return null;
    return hostname.toLowerCase().slice(0, 255);
  } catch {
    return null;
  }
}

/** Coarse device bucket derived from the UA string. Not a fingerprint. */
export function deviceTypeFromUserAgent(userAgent: string | null | undefined): DeviceType {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(ua)) return 'tablet';
  if (/mobi|iphone|android.*mobile|windows phone/.test(ua)) return 'mobile';
  if (/mozilla|chrome|safari|firefox|edge/.test(ua)) return 'desktop';
  return 'unknown';
}

export async function recordOutboundEvent(input: OutboundEventInput): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabasePublic.from('outbound_events').insert({
    offer_id: input.offerId,
    product_id: input.productId ?? null,
    source: clean(input.source),
    campaign: clean(input.campaign),
    referrer_host: referrerHost(input.referrer),
    device_type: deviceTypeFromUserAgent(input.userAgent),
  });

  if (error) {
    // Never fail the user's navigation because analytics failed.
    logger.warn('outbound.insert_failed', { error, offerId: input.offerId });
  }
}

export interface RedirectTarget {
  affiliateUrl: string;
  productId: string;
}

/**
 * Resolves an offer to its destination.
 *
 * The URL always comes from the database and is re-validated before use, so
 * `/go/[id]` can never be turned into an open redirect.
 */
export async function resolveOfferRedirect(offerId: string): Promise<RedirectTarget | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabasePublic
    .from('offers')
    .select('id, product_id, affiliate_url, status, starts_at, expires_at')
    .eq('id', offerId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    logger.error('outbound.resolve_failed', { error, offerId });
    return null;
  }
  if (!data) return null;

  const now = Date.now();
  if (data.starts_at && new Date(data.starts_at).getTime() > now) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() <= now) return null;
  if (!isPublicHttpUrl(data.affiliate_url)) {
    logger.error('outbound.unsafe_affiliate_url', { offerId });
    return null;
  }

  return { affiliateUrl: data.affiliate_url, productId: data.product_id };
}
