import type { Metadata } from 'next';

import { LegalPage } from '@/components/public/legal-page';

export const metadata: Metadata = {
  title: 'Política de cookies',
  description: 'Qué cookies usa este sitio.',
};

export default function CookiesPage() {
  return (
    <LegalPage title="Política de cookies" updatedAt="[FECHA]">
      <h2>Cookies que usamos</h2>
      <p>
        Este sitio <strong>no utiliza cookies publicitarias ni de analítica de terceros</strong>.
        Las únicas cookies que se instalan son técnicas y estrictamente necesarias:
      </p>
      <ul>
        <li>
          <strong>Sesión del panel de administración</strong> (<code>sb-*</code>): sólo se crea si
          alguien del equipo editorial inicia sesión. Un visitante normal no recibe ninguna cookie.
        </li>
      </ul>

      <h2>Medición de clics sin cookies</h2>
      <p>
        Para saber qué productos interesan registramos el clic en el servidor de forma anónima, sin
        cookies ni identificadores de navegador.
      </p>

      <h2>Cookies de terceros</h2>
      <p>
        Cuando pulsas en una oferta y accedes a una tienda externa, esa tienda puede instalar sus
        propias cookies, incluidas las de seguimiento de afiliación. Consulta su política de
        cookies.
      </p>

      <h2>Cómo gestionarlas</h2>
      <p>
        Puedes bloquear o eliminar cookies desde la configuración de tu navegador. Bloquear las
        cookies técnicas impedirá el acceso al panel de administración, pero no afecta a la
        navegación pública.
      </p>
    </LegalPage>
  );
}
