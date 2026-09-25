-- =============================================================================
-- Seed data
-- =============================================================================
-- Idempotent: safe to run repeatedly. Executed automatically by
-- `supabase db reset`, or manually with `psql -f supabase/seed.sql`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Categories
-- -----------------------------------------------------------------------------

insert into public.categories (name, slug, description, icon, sort_order) values
  ('Hogar',        'hogar',        'Ideas y soluciones para tu casa.',                 'house',       10),
  ('Tecnología',   'tecnologia',   'Gadgets, accesorios y electrónica.',               'cpu',         20),
  ('Coche',        'coche',        'Accesorios y cuidado del vehículo.',               'car',         30),
  ('Mascotas',     'mascotas',     'Todo para tus animales de compañía.',              'paw-print',   40),
  ('Moda',         'moda',         'Ropa, calzado y complementos.',                    'shirt',       50),
  ('Belleza',      'belleza',      'Cuidado personal y cosmética.',                    'sparkles',    60),
  ('Cocina',       'cocina',       'Utensilios y pequeños electrodomésticos.',         'utensils',    70),
  ('Gaming',       'gaming',       'Periféricos y accesorios para jugar.',             'gamepad-2',   80),
  ('Viajes',       'viajes',       'Equipaje y accesorios de viaje.',                  'plane',       90),
  ('Organización', 'organizacion', 'Orden y almacenamiento para cualquier espacio.',   'boxes',      100),
  ('Regalos',      'regalos',      'Ideas para acertar seguro.',                       'gift',       110),
  ('Otros',        'otros',        'Productos que no encajan en otra categoría.',      'tag',        120)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Providers
-- -----------------------------------------------------------------------------
-- `allows_redirect_tracking` is false by default on purpose: intermediate
-- redirects (MODE A) must only be enabled once the affiliate program's terms
-- have been verified. See ARCHITECTURE.md § Outbound tracking.

insert into public.providers (name, slug, domains, allows_redirect_tracking, notes) values
  ('Otro / Genérico', 'generic', '{}', false,
   'Proveedor por defecto cuando el dominio no se reconoce.'),
  ('Temu', 'temu', '{temu.com,www.temu.com,m.temu.com}', false,
   'Revisar términos del programa antes de activar redirect tracking.'),
  ('Amazon', 'amazon', '{amazon.es,www.amazon.es,amazon.com,www.amazon.com,amzn.to,amzn.eu}', false,
   'Amazon Associates prohíbe ciertas manipulaciones de enlaces: usar MODE B salvo confirmación.'),
  ('AliExpress', 'aliexpress', '{aliexpress.com,es.aliexpress.com,www.aliexpress.com,s.click.aliexpress.com}', false,
   null),
  ('Miravia', 'miravia', '{miravia.es,www.miravia.es}', false, null),
  ('TikTok Shop', 'tiktok-shop', '{shop.tiktok.com,www.tiktok.com}', false, null)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Settings
-- -----------------------------------------------------------------------------

insert into public.settings (key, value) values
  ('site_name', to_jsonb('Hallazgo'::text)),
  ('site_description', to_jsonb('Descubre productos y ofertas seleccionadas una a una.'::text)),
  ('logo_url', 'null'::jsonb),
  ('affiliate_disclosure', to_jsonb(
    'Algunos enlaces de esta web son enlaces de afiliado. Si realizas una compra a través de ellos, podemos recibir una comisión sin coste adicional para ti.'::text
  )),
  ('default_currency', to_jsonb('EUR'::text)),
  ('default_market', to_jsonb('ES'::text)),
  -- 'direct' (MODE B) is the safe default: no intermediate redirect.
  ('outbound_tracking_mode', to_jsonb('direct'::text))
on conflict (key) do nothing;
