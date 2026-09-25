-- =============================================================================
-- Domain functions, analytics RPCs and storage bucket
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Offer expiration job
-- -----------------------------------------------------------------------------
-- Flips active offers whose window has closed. Products are NEVER touched: a
-- product outlives its offers and can receive a new one later.
-- SECURITY INVOKER (default): RLS applies, so only an admin (or the service
-- role / a scheduled job) can actually mutate rows.

create or replace function public.expire_stale_offers()
returns integer
language plpgsql
as $$
declare
  affected integer;
begin
  update public.offers
     set status = 'expired'
   where status = 'active'
     and expires_at is not null
     and expires_at <= now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;

grant execute on function public.expire_stale_offers() to authenticated;

-- -----------------------------------------------------------------------------
-- Analytics RPCs
-- -----------------------------------------------------------------------------
-- All of them are SECURITY INVOKER, so `outbound_events` RLS applies and a
-- non-admin simply gets an empty result set.

create or replace function public.analytics_clicks_by_day(p_days integer default 30)
returns table (day date, clicks bigint)
language sql
stable
as $$
  with series as (
    select generate_series(
      (current_date - (greatest(p_days, 1) - 1) * interval '1 day')::date,
      current_date,
      interval '1 day'
    )::date as day
  )
  select s.day, count(e.id) as clicks
  from series s
  left join public.outbound_events e
    on e.created_at >= s.day
   and e.created_at < s.day + interval '1 day'
  group by s.day
  order by s.day;
$$;

create or replace function public.analytics_top_products(
  p_days integer default 30,
  p_limit integer default 10
)
returns table (product_id uuid, title text, slug text, clicks bigint)
language sql
stable
as $$
  select p.id, p.title, p.slug, count(e.id) as clicks
  from public.outbound_events e
  join public.products p on p.id = e.product_id
  where e.created_at >= now() - (greatest(p_days, 1) * interval '1 day')
  group by p.id, p.title, p.slug
  order by clicks desc, p.title
  limit greatest(p_limit, 1);
$$;

create or replace function public.analytics_clicks_by_category(p_days integer default 30)
returns table (category_id uuid, name text, clicks bigint)
language sql
stable
as $$
  select c.id, c.name, count(e.id) as clicks
  from public.outbound_events e
  join public.products p on p.id = e.product_id
  join public.categories c on c.id = p.category_id
  where e.created_at >= now() - (greatest(p_days, 1) * interval '1 day')
  group by c.id, c.name
  order by clicks desc, c.name;
$$;

create or replace function public.analytics_clicks_by_provider(p_days integer default 30)
returns table (provider_id uuid, name text, clicks bigint)
language sql
stable
as $$
  select pr.id, pr.name, count(e.id) as clicks
  from public.outbound_events e
  join public.offers o on o.id = e.offer_id
  join public.providers pr on pr.id = o.provider_id
  where e.created_at >= now() - (greatest(p_days, 1) * interval '1 day')
  group by pr.id, pr.name
  order by clicks desc, pr.name;
$$;

create or replace function public.analytics_clicks_by_source(p_days integer default 30)
returns table (source text, clicks bigint)
language sql
stable
as $$
  select coalesce(e.source, 'direct') as source, count(e.id) as clicks
  from public.outbound_events e
  where e.created_at >= now() - (greatest(p_days, 1) * interval '1 day')
  group by 1
  order by clicks desc, 1;
$$;

-- Click totals per product, used by the admin product list.
create or replace function public.analytics_product_click_counts(p_product_ids uuid[])
returns table (product_id uuid, clicks bigint)
language sql
stable
as $$
  select e.product_id, count(*) as clicks
  from public.outbound_events e
  where e.product_id = any(p_product_ids)
  group by e.product_id;
$$;

grant execute on function
  public.analytics_clicks_by_day(integer),
  public.analytics_top_products(integer, integer),
  public.analytics_clicks_by_category(integer),
  public.analytics_clicks_by_provider(integer),
  public.analytics_clicks_by_source(integer),
  public.analytics_product_click_counts(uuid[])
to authenticated;

-- -----------------------------------------------------------------------------
-- Storage bucket for images we host ourselves
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

create policy "product images are publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

create policy "admins can upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "admins can update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "admins can delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
