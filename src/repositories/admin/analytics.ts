import 'server-only';

import { mapProduct, type ProductView, type RawProduct } from '@/domain/views';
import { logger } from '@/lib/logger';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { OfferStatus, ProductStatus } from '@/types/database';

/**
 * Admin analytics.
 *
 * Everything is counted from real `outbound_events` rows. When there is no data
 * the values are genuinely zero and the UI shows an empty state — we never
 * fabricate metrics.
 */

export interface DashboardStats {
  products: { total: number; published: number; draft: number; hidden: number };
  offers: { active: number; expired: number };
  clicks: { today: number; last7Days: number; last30Days: number };
}

export interface ClicksByDay {
  day: string;
  clicks: number;
}

export interface TopProduct {
  productId: string;
  title: string;
  slug: string;
  clicks: number;
}

export interface NamedMetric {
  id: string;
  name: string;
  clicks: number;
}

function startOfTodayUtc(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createSupabaseServerClient();

  const countProducts = (status?: ProductStatus) => {
    const query = supabase.from('products').select('id', { count: 'exact', head: true });
    return status ? query.eq('status', status) : query.neq('status', 'archived');
  };

  const countOffers = (status: OfferStatus) =>
    supabase.from('offers').select('id', { count: 'exact', head: true }).eq('status', status);

  const countClicks = (since: string) =>
    supabase
      .from('outbound_events')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since);

  const [total, published, draft, hidden, activeOffers, expiredOffers, today, week, month] =
    await Promise.all([
      countProducts(),
      countProducts('published'),
      countProducts('draft'),
      countProducts('hidden'),
      countOffers('active'),
      countOffers('expired'),
      countClicks(startOfTodayUtc()),
      countClicks(daysAgo(7)),
      countClicks(daysAgo(30)),
    ]);

  const errors = [total, published, draft, hidden, activeOffers, expiredOffers, today, week, month]
    .map((result) => result.error)
    .filter((error) => error !== null);

  if (errors.length > 0) {
    logger.error('admin.analytics.stats_failed', { error: errors[0] });
  }

  return {
    products: {
      total: total.count ?? 0,
      published: published.count ?? 0,
      draft: draft.count ?? 0,
      hidden: hidden.count ?? 0,
    },
    offers: {
      active: activeOffers.count ?? 0,
      expired: expiredOffers.count ?? 0,
    },
    clicks: {
      today: today.count ?? 0,
      last7Days: week.count ?? 0,
      last30Days: month.count ?? 0,
    },
  };
}

export async function getClicksByDay(days = 30): Promise<ClicksByDay[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('analytics_clicks_by_day', { p_days: days });

  if (error) {
    logger.error('admin.analytics.clicks_by_day_failed', { error });
    return [];
  }

  return (data ?? []).map((row) => ({ day: row.day, clicks: Number(row.clicks) }));
}

export async function getTopProducts(days = 30, limit = 10): Promise<TopProduct[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('analytics_top_products', {
    p_days: days,
    p_limit: limit,
  });

  if (error) {
    logger.error('admin.analytics.top_products_failed', { error });
    return [];
  }

  return (data ?? []).map((row) => ({
    productId: row.product_id,
    title: row.title,
    slug: row.slug,
    clicks: Number(row.clicks),
  }));
}

export async function getClicksByCategory(days = 30): Promise<NamedMetric[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('analytics_clicks_by_category', { p_days: days });

  if (error) {
    logger.error('admin.analytics.clicks_by_category_failed', { error });
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.category_id,
    name: row.name,
    clicks: Number(row.clicks),
  }));
}

export async function getClicksByProvider(days = 30): Promise<NamedMetric[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('analytics_clicks_by_provider', { p_days: days });

  if (error) {
    logger.error('admin.analytics.clicks_by_provider_failed', { error });
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.provider_id,
    name: row.name,
    clicks: Number(row.clicks),
  }));
}

export async function getClicksBySource(days = 30): Promise<NamedMetric[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('analytics_clicks_by_source', { p_days: days });

  if (error) {
    logger.error('admin.analytics.clicks_by_source_failed', { error });
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.source,
    name: row.source,
    clicks: Number(row.clicks),
  }));
}

export async function getRecentProducts(limit = 5): Promise<ProductView[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('products')
    .select(
      `id, title, slug, short_description, status, featured, created_at, updated_at, published_at,
       category:categories!products_category_id_fkey ( id, name, slug ),
       images:product_images ( id, url, alt, position ),
       offers ( id, product_id, provider_id, market, currency, current_price, previous_price,
                discount_percentage, affiliate_url, original_url, coupon_code, coupon_description,
                starts_at, expires_at, status )`,
    )
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<RawProduct[]>();

  if (error) {
    logger.error('admin.analytics.recent_products_failed', { error });
    return [];
  }

  return (data ?? []).map(mapProduct);
}
