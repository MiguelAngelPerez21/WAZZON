# Seguridad

Este documento describe el modelo de amenazas de la aplicación, los controles
implementados y los riesgos residuales conocidos.

## Modelo de amenazas

| Activo | Amenaza principal | Control |
| --- | --- | --- |
| Red interna / metadatos cloud | SSRF desde el importador de metadatos | `security/url-guard.ts` + `security/safe-fetch.ts` |
| Catálogo | Escritura no autorizada | `requireAdmin()` + RLS |
| Sesión de administrador | Robo de sesión, CSRF | Cookies de Supabase `httpOnly` + Server Actions + comprobación de origen |
| Visitantes | XSS desde HTML de terceros | Saneado en `providers/metadata/sanitize.ts`, render como texto |
| Reputación / afiliación | Redirección abierta, cloaking | `/go` resuelve el destino en BD; modo `redirect` sólo con permiso del proveedor |
| Privacidad | Perfilado de usuarios | Analítica sin cookies, sin IP y sin identificadores |

## 1. SSRF — el control crítico

El administrador pega una URL arbitraria y el servidor la descarga. Sin
protección, eso permitiría leer `http://169.254.169.254/latest/meta-data/`
(credenciales del proveedor cloud), `http://localhost:54321` (la propia base de
datos) o cualquier servicio interno.

**Todo acceso saliente pasa obligatoriamente por un único punto**:
`validatePublicHttpUrl()` en `src/security/url-guard.ts`.

Comprobaciones síncronas (sin red):

- Longitud máxima de 2048 caracteres.
- Sólo `http:` y `https:` (se rechazan `file:`, `data:`, `javascript:`, `gopher:`…).
- Sin credenciales embebidas (`https://user:pass@host`).
- Puertos permitidos: por defecto, 80, 443, 8080 y 8443.
- Hostnames bloqueados por nombre exacto o sufijo: `localhost`, `*.localhost`,
  `*.local`, `*.internal`, `*.home.arpa`, `*.localdomain`, `metadata`,
  `metadata.google.internal`, `instance-data`, `nip.io`.
- IPv4 literales: se bloquean `0.0.0.0/8`, `10/8`, `100.64/10`, `127/8`,
  `169.254/16`, `172.16/12`, `192.0.0/24`, `192.0.2/24`, `192.88.99/24`,
  `192.168/16`, `198.18/15`, `198.51.100/24`, `203.0.113/24`, `224/4`, `240/4` y
  `255.255.255.255`.
- Octetos en octal (`0177.0.0.1`) se rechazan como literal IPv4 en lugar de
  reinterpretarse, de forma que la URL cae en la comprobación DNS posterior.
- IPv6 literales: se expande la dirección (incluida la notación comprimida, la
  cola IPv4 y el *zone index*) y se bloquean `::`, `::1`, `fc00::/7`,
  `fe80::/10`, `ff00::/8`, `2001:db8::/32`, `64:ff9b::/96` y las direcciones
  IPv4-mapeadas cuyo IPv4 embebido esté bloqueado.

Comprobaciones con red (`safe-fetch.ts`):

- Se resuelve el hostname y se rechaza si **cualquiera** de las IPs devueltas es
  privada o reservada.
- Las redirecciones se siguen manualmente (máximo 3) y **cada salto se vuelve a
  validar por completo**.
- Timeout duro de 8 s y límite de respuesta de 768 KB (lectura por *chunks*, se
  aborta en cuanto se supera).
- `Content-Type` restringido a HTML/XHTML/texto plano: nunca se descargan
  binarios.
- No se envían cookies, credenciales ni cabeceras de autenticación.
- El HTML se analiza con un parser inerte (`node-html-parser`); nunca se ejecuta.

**Cobertura de tests**: `tests/url-guard.test.ts` cubre 44 casos, incluidos
todos los rangos bloqueados y los esquemas prohibidos.

### Riesgo residual: DNS rebinding

Entre la resolución DNS que valida la IP y la conexión real que hace `fetch`
existe una ventana en la que un DNS hostil puede cambiar la respuesta (TTL 0).
El `fetch` global de Node no expone un *hook* de conexión que permita fijar la
IP ya validada, por lo que el riesgo está **mitigado pero no eliminado**.

Factores que lo limitan: la función sólo es accesible tras `requireAdmin()`, la
respuesta se trunca a 768 KB, sólo se aceptan tipos de contenido de texto y el
contenido devuelto al cliente está saneado. Mitigación futura: un `Agent` con
`lookup` personalizado que fije la dirección validada.

## 2. Autenticación y autorización

Tres capas, de fuera hacia dentro:

1. **`src/proxy.ts`** (convención *proxy* de Next, antes *middleware*): refresca
   la cookie de sesión y redirige a `/admin/login` si no hay usuario. Es
   **comodidad, no seguridad**.
2. **`requireAdmin()`**: se ejecuta en el layout del panel, en **todas** las
   Server Actions de administración y en `/api/admin/analyze-url` (que responde
   403 a quien no sea administrador). Comprueba el rol en `profiles`.
3. **RLS en PostgreSQL**: es la frontera real. Aunque alguien lograse invocar
   una acción del servidor, la base de datos rechazaría la escritura.

El rol se guarda en `profiles.role` y sólo puede elevarse con
`public.promote_to_admin(email)`, función `SECURITY DEFINER` cuyo `execute` está
**revocado** para `anon` y `authenticated`: sólo se puede ejecutar desde el SQL
Editor de Supabase.

### La clave de servicio no se usa

`SUPABASE_SERVICE_ROLE_KEY` **no forma parte de esta aplicación**. Esa clave
salta por encima de RLS, así que un único error de código expondría todas las
tablas. En su lugar, cada operación se expresa como política RLS:

- Lectura pública: sólo productos `published` con categoría activa.
- Escritura: sólo `authenticated` con rol de administrador.
- Inserción anónima de clics: permitida por
  `outbound_events_insert_public`, que exige `offer_is_public(offer_id)`. El
  visitante **no puede leer** `outbound_events`; sólo un administrador puede.

## 3. Redirección abierta y cumplimiento de afiliación

`/go/[offerId]` **nunca** acepta un destino por parámetro. Recibe un UUID,
busca la oferta en la base de datos, comprueba que está `active` y dentro de su
ventana temporal, y vuelve a validar la URL almacenada con `isPublicHttpUrl()`
antes de emitir el 302. Ante cualquier fallo redirige a `/`. La respuesta lleva
`Cache-Control: no-store` y `Referrer-Policy: no-referrer`.

El parámetro `?next=` del login pasa por `safeInternalPath()`, que sólo acepta
rutas que empiecen por `/` y no por `//`.

> **Aviso de cumplimiento**: muchos programas de afiliación prohíben interponer
> una redirección propia (*link cloaking*) y pueden cancelar la cuenta por ello.
> Por eso el modo por defecto es `direct` y el modo `redirect` sólo se aplica a
> proveedores marcados con `allows_redirect_tracking = true`. Todos los
> proveedores del `seed.sql` están marcados como `false`: actívalo únicamente
> tras leer los términos del programa concreto.

## 4. XSS y contenido de terceros

- El HTML remoto nunca se renderiza. Se extraen campos concretos y se pasan por
  `sanitizeText()`, que elimina cualquier fragmento con forma de etiqueta, los
  caracteres de control C0/C1, colapsa espacios y trunca por longitud.
- Las URLs de imagen se aceptan sólo si son `https:` absolutas y pasan el guardia
  SSRF; `data:` y `javascript:` quedan descartadas.
- La descripción del producto se muestra como texto plano
  (`whitespace-pre-line`), no como HTML.
- El único `dangerouslySetInnerHTML` de la aplicación está en `JsonLd`, que
  serializa con `JSON.stringify` y escapa `<` como `\u003c`, por lo que no puede
  cerrar la etiqueta `<script>`.
- Cabeceras enviadas desde `next.config.ts` para todas las rutas:
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
  restrictiva y una CSP parcial:
  `frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`.
  Además `poweredByHeader` está desactivado.

### Pendiente: `script-src` en la CSP

La CSP actual cubre *clickjacking*, inyección de `<base>`, destino de
formularios y objetos incrustados, pero **no restringe `script-src`**. Next.js
inyecta scripts en línea durante la hidratación, así que hacerlo requiere
generar un *nonce* por petición en `proxy.ts` y propagarlo. Es la mejora de
seguridad prioritaria antes de un despliegue público.
`Strict-Transport-Security` se deja en manos del hosting (Vercel y similares la
añaden automáticamente).

## 5. Optimizador de imágenes

`/_next/image` acepta una URL remota y la descarga desde el servidor: es, de
hecho, otro vector SSRF/proxy abierto. Sólo se permiten los hosts de
`IMAGE_ALLOWED_HOSTS` (`src/config/images.ts`, ampliable con
`NEXT_PUBLIC_IMAGE_ALLOWED_HOSTS`). Las imágenes de cualquier otro host se
muestran con un `<img>` nativo y `referrerPolicy="no-referrer"`, sin pasar por
el optimizador.

## 6. Validación de entrada

Toda entrada externa —formularios, `searchParams`, cuerpos JSON— se valida con
Zod en `src/validation/`. Los parámetros del catálogo se normalizan además en
`lib/catalog-params.ts`: la página se limita a 500, el texto de búsqueda a 120
caracteres y el criterio de ordenación sólo puede tomar uno de cuatro valores
conocidos, de modo que nunca llega un valor arbitrario a la función SQL.

Las consultas se hacen siempre con el cliente de Supabase (consultas
parametrizadas). No se concatena SQL en ningún punto de la aplicación.

## 7. Privacidad

`outbound_events` guarda: identificador de oferta y producto, tipo de
dispositivo derivado del *user agent* (`mobile`/`tablet`/`desktop`), el **host**
del referente (nunca la ruta, y se descartan las IPs), `utm_source`/
`utm_campaign` truncados a 64 caracteres y la marca de tiempo.

**No se guarda** dirección IP, ni user agent completo, ni identificador de
usuario o de sesión, ni se instalan cookies de analítica. No hay ningún script
de terceros en el sitio público.

Las páginas legales (`/privacidad`, `/cookies`, `/aviso-legal`, `/afiliacion`)
son **plantillas** con marcadores `[FECHA]`, `[EMAIL DE CONTACTO]` y
`[NOMBRE / RAZÓN SOCIAL]`. Deben completarse y revisarse legalmente antes de
publicar.

## 8. Gestión de secretos

- El único secreto real es la contraseña del administrador, gestionada por
  Supabase Auth (bcrypt, fuera de esta base de código).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` es pública por diseño; su alcance lo define
  RLS.
- `.env.local` está en `.gitignore`. `.env.example` no contiene valores reales.
- Los errores nunca se muestran crudos al usuario: `app/error.tsx` enseña
  únicamente `error.digest`, y el login devuelve siempre el mismo mensaje
  genérico para no revelar si un email existe.

## 9. Dependencias

`npm audit` no reporta vulnerabilidades. El número de dependencias se mantiene
deliberadamente bajo y no se usa ninguna librería de gráficos, de scraping ni de
automatización de navegador.

## Cómo reportar un problema

Escribe a `[EMAIL DE CONTACTO]` con los pasos para reproducirlo. No abras una
incidencia pública con los detalles de una vulnerabilidad no corregida.
