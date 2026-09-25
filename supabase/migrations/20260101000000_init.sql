-- =============================================================================
-- Affiliate Commerce Platform — initial schema
-- =============================================================================
-- Conventions
--   * UUID primary keys (generated with gen_random_uuid()).
--   * All timestamps are `timestamptz` and therefore stored in UTC.
--   * Money is `numeric(12,2)` — never float/double (binary rounding errors).
--   * Editorial data lives in `products`; marketplace/commercial data lives in
--     `offers`. A product survives the expiration of its offers.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

-- MVP only uses 'admin'. The other values exist so that adding real roles later
-- does not require a destructive migration.
create type public.app_role as enum ('admin', 'editor', 'viewer');

-- NOTE: 'expired' is deliberately NOT a product status. Expiration is a
-- property of a commercial Offer, not of the editorial Product (see
-- ARCHITECTURE.md). 'archived' implements soft-delete.
create type public.product_status as enum ('draft', 'published', 'hidden', 'archived');

create type public.offer_status as enum ('draft', 'active', 'expired', 'hidden');

create type public.device_type as enum ('mobile', 'tablet', 'desktop', 'unknown');

-- -----------------------------------------------------------------------------
-- Shared trigger: keep updated_at honest
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles — 1:1 with auth.users, holds authorization role
-- -----------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  role        public.app_role not null default 'viewer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Automatically materialise a profile for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Authorization helper used by every admin policy.
-- SECURITY DEFINER so that policies can read `profiles` without recursing into
-- the `profiles` RLS policies themselves.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- Bootstrap helper. Intentionally NOT executable by anon/authenticated: it must
-- be run from the Supabase SQL editor (postgres role) or with the service key.
create or replace function public.promote_to_admin(target_email text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles
     set role = 'admin'
   where lower(email) = lower(target_email);

  if not found then
    raise exception 'No profile found for email %', target_email;
  end if;
end;
$$;

revoke all on function public.promote_to_admin(text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- categories
-- -----------------------------------------------------------------------------

create table public.categories (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text not null,
  description      text,
  image_url        text,
  icon             text,
  seo_title        text,
  seo_description  text,
  active           boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint categories_slug_unique unique (slug),
  constraint categories_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint categories_name_not_blank check (length(btrim(name)) > 0)
);

create index categories_active_sort_idx on public.categories (active, sort_order, name);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- providers — marketplaces / affiliate programs
-- -----------------------------------------------------------------------------

create table public.providers (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  slug                  text not null,
  -- Comma-free list of hostnames used to auto-detect the provider from a URL.
  domains               text[] not null default '{}',
  -- Whether the affiliate program tolerates an intermediate redirect (MODE A).
  allows_redirect_tracking boolean not null default false,
  notes                 text,
  active                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint providers_slug_unique unique (slug),
  constraint providers_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create index providers_domains_idx on public.providers using gin (domains);

create trigger providers_set_updated_at
  before update on public.providers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- products — editorial entity, independent from any marketplace
-- -----------------------------------------------------------------------------

create table public.products (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  slug               text not null,
  short_description  text,
  description        text,
  category_id        uuid references public.categories (id) on delete restrict,
  status             public.product_status not null default 'draft',
  featured           boolean not null default false,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  published_at       timestamptz,
  constraint products_slug_unique unique (slug),
  constraint products_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint products_title_not_blank check (length(btrim(title)) > 0),
  constraint products_short_description_length check (
    short_description is null or length(short_description) <= 300
  ),
  -- A published product must know when it was published.
  constraint products_published_needs_timestamp check (
    status <> 'published' or published_at is not null
  )
);

create index products_status_published_idx
  on public.products (status, published_at desc nulls last);
create index products_category_idx on public.products (category_id);
create index products_featured_idx on public.products (featured) where featured;
create index products_created_at_idx on public.products (created_at desc);

-- Full text search (Spanish). Generated column keeps it always in sync.
alter table public.products
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('spanish', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(short_description, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(description, '')), 'C')
  ) stored;

create index products_search_idx on public.products using gin (search_vector);
create index products_title_trgm_idx on public.products using gin (title gin_trgm_ops);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- product_images
-- -----------------------------------------------------------------------------

create table public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  url         text not null,
  alt         text,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint product_images_url_scheme check (url ~* '^https://'),
  constraint product_images_position_unique unique (product_id, position)
    deferrable initially deferred
);

create index product_images_product_idx on public.product_images (product_id, position);

-- -----------------------------------------------------------------------------
-- offers — commercial data for a (product, provider, market) tuple
-- -----------------------------------------------------------------------------

create table public.offers (
  id                   uuid primary key default gen_random_uuid(),
  product_id           uuid not null references public.products (id) on delete cascade,
  provider_id          uuid not null references public.providers (id) on delete restrict,
  market               text not null default 'ES',
  currency             text not null default 'EUR',
  current_price        numeric(12, 2),
  previous_price       numeric(12, 2),
  affiliate_url        text not null,
  original_url         text,
  canonical_url        text,
  -- Normalised form of the destination URL, used for duplicate detection.
  dedupe_key           text,
  external_id          text,
  coupon_code          text,
  coupon_description   text,
  starts_at            timestamptz,
  expires_at           timestamptz,
  status               public.offer_status not null default 'draft',
  last_checked_at      timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint offers_market_format check (market ~ '^[A-Z]{2}$'),
  constraint offers_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint offers_current_price_positive check (current_price is null or current_price >= 0),
  constraint offers_previous_price_positive check (previous_price is null or previous_price >= 0),
  -- A "previous price" only makes sense when it is strictly higher.
  constraint offers_previous_price_higher check (
    previous_price is null or current_price is null or previous_price > current_price
  ),
  constraint offers_affiliate_url_scheme check (affiliate_url ~* '^https?://'),
  constraint offers_original_url_scheme check (original_url is null or original_url ~* '^https?://'),
  constraint offers_canonical_url_scheme check (canonical_url is null or canonical_url ~* '^https?://'),
  constraint offers_date_range check (
    starts_at is null or expires_at is null or expires_at > starts_at
  ),
  constraint offers_external_id_unique unique (provider_id, external_id)
);

-- Discount is derived, never stored by hand: no invented discounts possible.
alter table public.offers
  add column discount_percentage integer
  generated always as (
    case
      when previous_price is not null
       and current_price is not null
       and previous_price > 0
       and previous_price > current_price
      then floor(((previous_price - current_price) / previous_price) * 100)::int
      else null
    end
  ) stored;

create index offers_product_idx on public.offers (product_id);
create index offers_provider_idx on public.offers (provider_id);
create index offers_status_idx on public.offers (status);
create index offers_expires_at_idx on public.offers (expires_at) where expires_at is not null;
create index offers_dedupe_key_idx on public.offers (dedupe_key);
create index offers_price_idx on public.offers (current_price) where current_price is not null;

create trigger offers_set_updated_at
  before update on public.offers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- outbound_events — outbound click analytics (no PII)
-- -----------------------------------------------------------------------------

create table public.outbound_events (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid references public.products (id) on delete set null,
  offer_id      uuid references public.offers (id) on delete set null,
  -- utm_source / utm_campaign, truncated and sanitised at the application layer.
  source        text,
  campaign      text,
  -- Host only. We deliberately do not store full referrer URLs or IPs.
  referrer_host text,
  device_type   public.device_type not null default 'unknown',
  created_at    timestamptz not null default now(),
  constraint outbound_events_source_length check (source is null or length(source) <= 64),
  constraint outbound_events_campaign_length check (campaign is null or length(campaign) <= 64),
  constraint outbound_events_referrer_length check (referrer_host is null or length(referrer_host) <= 255)
);

create index outbound_events_created_at_idx on public.outbound_events (created_at desc);
create index outbound_events_product_idx on public.outbound_events (product_id, created_at desc);
create index outbound_events_offer_idx on public.outbound_events (offer_id, created_at desc);

-- -----------------------------------------------------------------------------
-- settings — single-row-per-key configuration (branding, tracking mode, ...)
-- -----------------------------------------------------------------------------

create table public.settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  constraint settings_key_format check (key ~ '^[a-z0-9_]+$')
);

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();
