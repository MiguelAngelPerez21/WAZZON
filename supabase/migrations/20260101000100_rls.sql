-- =============================================================================
-- Row Level Security
-- =============================================================================
-- Rule of thumb:
--   anon           -> read-only access to *published* content
--   authenticated  -> same as anon, plus own profile
--   admin          -> full CRUD (checked with public.is_admin())
--
-- RLS is never disabled. The service role bypasses RLS by design and is only
-- used from trusted server-side code (and is optional for the MVP).
-- =============================================================================

alter table public.profiles        enable row level security;
alter table public.categories      enable row level security;
alter table public.providers       enable row level security;
alter table public.products        enable row level security;
alter table public.product_images  enable row level security;
alter table public.offers          enable row level security;
alter table public.outbound_events enable row level security;
alter table public.settings        enable row level security;

-- Supabase grants privileges to anon/authenticated; RLS does the real gating.
grant usage on schema public to anon, authenticated;
grant select on
  public.categories,
  public.providers,
  public.products,
  public.product_images,
  public.offers,
  public.settings
to anon, authenticated;
grant insert on public.outbound_events to anon, authenticated;
grant select, insert, update, delete on
  public.categories,
  public.providers,
  public.products,
  public.product_images,
  public.offers,
  public.settings
to authenticated;
grant select on public.outbound_events to authenticated;
grant select, update on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- Reusable visibility predicates
-- -----------------------------------------------------------------------------

create or replace function public.product_is_public(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and p.status = 'published'
      and p.published_at is not null
      and p.published_at <= now()
  );
$$;

grant execute on function public.product_is_public(uuid) to anon, authenticated;

create or replace function public.offer_is_public(p_offer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.offers o
    where o.id = p_offer_id
      and o.status = 'active'
      and (o.starts_at is null or o.starts_at <= now())
      and (o.expires_at is null or o.expires_at > now())
      and public.product_is_public(o.product_id)
  );
$$;

grant execute on function public.offer_is_public(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  -- A user may edit their own profile but never escalate their own role.
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- categories
-- -----------------------------------------------------------------------------

create policy categories_select_public on public.categories
  for select to anon, authenticated
  using (active or public.is_admin());

create policy categories_admin_write on public.categories
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- providers
-- -----------------------------------------------------------------------------

create policy providers_select_public on public.providers
  for select to anon, authenticated
  using (active or public.is_admin());

create policy providers_admin_write on public.providers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- products
-- -----------------------------------------------------------------------------

create policy products_select_public on public.products
  for select to anon, authenticated
  using (
    (status = 'published' and published_at is not null and published_at <= now())
    or public.is_admin()
  );

create policy products_admin_write on public.products
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- product_images
-- -----------------------------------------------------------------------------

create policy product_images_select_public on public.product_images
  for select to anon, authenticated
  using (public.product_is_public(product_id) or public.is_admin());

create policy product_images_admin_write on public.product_images
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- offers
-- -----------------------------------------------------------------------------

create policy offers_select_public on public.offers
  for select to anon, authenticated
  using (
    (
      status = 'active'
      and (starts_at is null or starts_at <= now())
      and (expires_at is null or expires_at > now())
      and public.product_is_public(product_id)
    )
    or public.is_admin()
  );

create policy offers_admin_write on public.offers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- outbound_events
-- -----------------------------------------------------------------------------
-- Anyone may record a click, but only for an offer that is actually public, and
-- only through the narrow column set constrained above. Nobody except an admin
-- can read the events back.

create policy outbound_events_insert_public on public.outbound_events
  for insert to anon, authenticated
  with check (
    offer_id is not null
    and public.offer_is_public(offer_id)
    and (product_id is null or public.product_is_public(product_id))
  );

create policy outbound_events_admin_select on public.outbound_events
  for select to authenticated
  using (public.is_admin());

-- -----------------------------------------------------------------------------
-- settings
-- -----------------------------------------------------------------------------
-- Settings only hold public branding/behaviour flags (site name, disclosure
-- text, tracking mode). No secrets are ever stored here.

create policy settings_select_public on public.settings
  for select to anon, authenticated
  using (true);

create policy settings_admin_write on public.settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
