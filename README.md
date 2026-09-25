# Hallazgo — plataforma de descubrimiento de productos de afiliación

Catálogo web para publicar productos de afiliación. **No es una tienda**: no hay
carrito, checkout, pagos, stock, pedidos ni logística. El visitante descubre el
producto y sale hacia la tienda del anunciante mediante un enlace de afiliado.

El flujo central es deliberadamente corto:

> **Pegar enlace → elegir categoría → publicar** (menos de 60 segundos)

## Características

- **Alta rápida (Quick Add)**: pegas la URL del producto, la aplicación lee los
  metadatos públicos de la página (Open Graph, Twitter Cards, JSON-LD), muestra
  qué campos ha encontrado y cuáles no, y publicas.
- **Nunca inventa datos**: si un campo no está en la página, se marca como *no
  detectado* y se deja vacío. No hay valoraciones, ventas, stock, contadores de
  urgencia ni testimonios ficticios.
- **Panel de administración**: productos (CRUD, acciones en lote, duplicar),
  categorías, ofertas, analítica de clics y configuración del sitio.
- **Sitio público**: portada, catálogo con filtros, categorías, buscador,
  ofertas, ficha de producto, páginas legales.
- **Analítica sin cookies**: sólo se registra el clic saliente (oferta,
  producto, host de referencia, tipo de dispositivo). No hay identificadores de
  usuario, ni IP, ni perfiles.
- **SEO**: metadatos dinámicos, `sitemap.xml`, `robots.txt` y JSON-LD
  (`Product`, `Offer`, `BreadcrumbList`) generado sólo con datos reales.
- **Coste cero**: funciona íntegramente dentro de los planes gratuitos de
  Supabase y de cualquier hosting compatible con Next.js.

## Stack

| Capa | Tecnología |
| --- | --- |
| Framework | Next.js 16 (App Router, React Server Components) |
| Lenguaje | TypeScript 5 en modo estricto |
| UI | Tailwind CSS v4 + componentes propios |
| Datos | Supabase (PostgreSQL 15 + Auth + RLS) |
| Validación | Zod |
| Tests | Vitest |

## Requisitos

- Node.js >= 20.9
- Una cuenta gratuita de [Supabase](https://supabase.com)
- Opcional: [Supabase CLI](https://supabase.com/docs/guides/cli) para aplicar
  las migraciones desde la terminal

## Puesta en marcha

```bash
# 1. Dependencias
npm install

# 2. Variables de entorno
cp .env.example .env.local     # en PowerShell: Copy-Item .env.example .env.local
# Rellena NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY

# 3. Base de datos (migraciones + datos iniciales)
npx supabase link --project-ref <tu-project-ref>
npm run db:push
```

Si prefieres no usar la CLI, abre el **SQL Editor** de Supabase y ejecuta, en
orden, los archivos de `supabase/migrations/` y después `supabase/seed.sql`.

### Crear el primer administrador

1. En Supabase → **Authentication → Users → Add user**, crea tu usuario con
   email y contraseña.
2. En el **SQL Editor** ejecuta:

   ```sql
   select public.promote_to_admin('tu@email.com');
   ```

   La función está revocada para `anon` y `authenticated`: sólo puede
   ejecutarse desde el editor SQL o con la clave de servicio de Supabase.

### Arrancar

```bash
npm run dev
```

- Sitio público: <http://localhost:3000>
- Panel: <http://localhost:3000/admin>

## Scripts

| Script | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm start` | Servidor de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Tests unitarios (Vitest) |
| `npm run format` | Prettier |
| `npm run db:push` | Aplica las migraciones a Supabase |
| `npm run db:reset` | Reinicia la base de datos local y aplica el seed |

## Cómo publicar un producto

1. `/admin` → **Añadir producto**.
2. Pega la URL de afiliado del producto y pulsa **Analizar**.
3. Revisa lo que se ha detectado (título, descripción, imágenes, precio,
   moneda). Lo que no se haya detectado aparece marcado en amarillo: complétalo
   a mano o déjalo vacío.
4. Elige la categoría.
5. **Publicar** (o **Guardar como borrador**).

Si el enlace ya existe en el catálogo, la aplicación avisa antes de crear un
duplicado.

## Enlaces salientes y cumplimiento de afiliación

Hay dos modos, configurables en **Ajustes → Seguimiento de clics**:

- **`direct` (por defecto)**: el botón apunta directamente a la URL de afiliado
  con `rel="sponsored nofollow noopener noreferrer"`. El clic se registra en
  paralelo con `navigator.sendBeacon`. Es el modo compatible con todos los
  programas de afiliación.
- **`redirect`**: el botón pasa por `/go/[offerId]`, que registra el clic y
  redirige (302). **Muchos programas de afiliación prohíben la redirección
  intermedia (cloaking)**, por eso sólo se aplica a los proveedores marcados
  explícitamente con `allows_redirect_tracking = true`. Todos los proveedores
  del seed están marcados como `false`.

## Qué NO hace esta aplicación

Por diseño, y de forma deliberada:

- No usa navegadores headless (Puppeteer/Playwright/Selenium) ni evade
  protecciones anti-bot.
- No hace scraping autenticado ni masivo de ningún marketplace: sólo lee los
  metadatos públicos de la URL que el administrador pega, una petición por alta.
- No usa APIs no oficiales ni inventadas.
- No genera contenido ficticio de ningún tipo.
- No procesa pagos ni gestiona pedidos.

## Documentación

- [ARCHITECTURE.md](ARCHITECTURE.md) — estructura, capas y decisiones de diseño.
- [SECURITY.md](SECURITY.md) — modelo de amenazas, SSRF, RLS y riesgos residuales.

## Licencia

Proyecto privado. Todos los derechos reservados.
