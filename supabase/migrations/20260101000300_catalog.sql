-- =============================================================================
-- Public catalog query function
-- =============================================================================
-- PostgREST cannot order a parent table by an aggregate of an embedded table
-- (e.g. "cheapest active offer"), and ordering by popularity requires reading
-- `outbound_events`, which anonymous visitors must not be able to query.
--
-- This function solves both problems: it returns ONLY product ids plus the
-- total count, applying filtering, sorting and pagination in the database.
--
-- It is SECURITY DEFINER *and* hard-codes the public visibility predicate
-- (published + published_at <= now()), so it can never leak drafts, hidden or
-- archived products, and it never returns a single row of click data.
-- =============================================================================

create or replace function public.list_catalog_products(
  p_category_id uuid default null,
  p_provider_id uuid default null,
  p_query text default null,
  p_featured boolean default null,
  p_with_offer boolean default false,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_sort text default 'recent',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (product_id uuid, total_count bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with active_offers as (
    select
      o.product_id,
      min(o.current_price) as min_price,
      count(*) as offer_count,
      array_agg(distinct o.provider_id) as provider_ids
    from public.offers o
    where o.status = 'active'
      and (o.starts_at is null or o.starts_at <= now())
      and (o.expires_at is null or o.expires_at > now())
    group by o.product_id
  ),
  recent_clicks as (
    select e.product_id, count(*)::bigint as clicks
    from public.outbound_events e
    where e.created_at >= now() - interval '30 days'
      and e.product_id is not null
    group by e.product_id
  ),
  filtered as (
    select
      p.id,
      p.published_at,
      p.created_at,
      ao.min_price,
      coalesce(rc.clicks, 0) as clicks
    from public.products p
    left join active_offers ao on ao.product_id = p.id
    left join recent_clicks rc on rc.product_id = p.id
    where p.status = 'published'
      and p.published_at is not null
      and p.published_at <= now()
      and (p_category_id is null or p.category_id = p_category_id)
      and (p_provider_id is null or p_provider_id = any(ao.provider_ids))
      and (p_featured is null or p.featured = p_featured)
      and (p_with_offer is not true or ao.offer_count > 0)
      and (p_min_price is null or ao.min_price >= p_min_price)
      and (p_max_price is null or ao.min_price <= p_max_price)
      and (
        p_query is null
        or btrim(p_query) = ''
        or p.search_vector @@ websearch_to_tsquery('spanish', p_query)
        or p.title ilike '%' || btrim(p_query) || '%'
      )
  )
  select f.id, count(*) over () as total_count
  from filtered f
  order by
    case when p_sort = 'price_asc' then f.min_price end asc nulls last,
    case when p_sort = 'price_desc' then f.min_price end desc nulls last,
    case when p_sort = 'popular' then f.clicks end desc nulls last,
    f.published_at desc nulls last,
    f.created_at desc
  limit greatest(coalesce(p_limit, 24), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.list_catalog_products(
  uuid, uuid, text, boolean, boolean, numeric, numeric, text, integer, integer
) from public;

grant execute on function public.list_catalog_products(
  uuid, uuid, text, boolean, boolean, numeric, numeric, text, integer, integer
) to anon, authenticated;
