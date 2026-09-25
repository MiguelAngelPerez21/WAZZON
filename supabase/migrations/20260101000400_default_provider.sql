-- -----------------------------------------------------------------------------
-- Default provider: Temu
-- -----------------------------------------------------------------------------
-- The admin UI no longer asks which store a product belongs to: this site
-- publishes Temu offers exclusively, so `offers.provider_id` is filled in
-- automatically (see `src/services/providers.ts`).
--
-- The multi-provider schema is deliberately kept intact — `providers` still
-- exists, `offers.provider_id` is still a real FK, and the public catalog can
-- still filter by store — so adding a second marketplace later only requires
-- re-exposing the selector in the form.
--
-- This migration guarantees the row the application depends on exists, even in
-- databases created before `supabase/seed.sql` included it. It is idempotent:
-- `providers_slug_unique` turns the conflict clause into a no-op on re-runs,
-- so it can never create a duplicate Temu.

insert into public.providers (name, slug, domains, allows_redirect_tracking, active, notes)
values (
  'Temu',
  'temu',
  '{temu.com,www.temu.com,m.temu.com}',
  false,
  true,
  'Proveedor por defecto. Revisar términos del programa antes de activar redirect tracking.'
)
on conflict (slug) do update
  -- Only reactivates the row. `domains`, `notes` and `allows_redirect_tracking`
  -- are left untouched so a manual edit in the dashboard is never overwritten.
  set active = true;
