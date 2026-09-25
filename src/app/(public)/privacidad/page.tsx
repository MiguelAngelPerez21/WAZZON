import type { Metadata } from 'next';

import { LegalPage } from '@/components/public/legal-page';

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description: 'Qué datos tratamos y con qué finalidad.',
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidad" updatedAt="[FECHA]">
      <h2>Responsable</h2>
      <p>[NOMBRE / RAZÓN SOCIAL], [NIF], [DIRECCIÓN]. Contacto: [EMAIL DE CONTACTO].</p>

      <h2>Qué datos tratamos</h2>
      <ul>
        <li>
          <strong>Navegación anónima:</strong> registramos que se ha pulsado en una oferta, con la
          fecha, el tipo de dispositivo (móvil, tablet u ordenador), el dominio desde el que llegas
          y, si existen, los parámetros <code>utm_source</code> y <code>utm_campaign</code>.
        </li>
        <li>
          <strong>No registramos</strong> tu dirección IP, ni identificadores publicitarios, ni
          creamos perfiles individuales.
        </li>
        <li>
          <strong>Cuentas:</strong> sólo el equipo editorial tiene cuenta. Tratamos su correo y su
          nombre para gestionar el acceso al panel.
        </li>
      </ul>

      <h2>Finalidad y base jurídica</h2>
      <p>
        Usamos estos datos agregados para saber qué contenidos interesan y mejorar el catálogo
        (interés legítimo). Al no identificar a ninguna persona, no se elaboran perfiles.
      </p>

      <h2>Encargados de tratamiento</h2>
      <p>
        Alojamiento y base de datos: [PROVEEDOR DE HOSTING] y Supabase. Los datos se almacenan en
        [REGIÓN].
      </p>

      <h2>Conservación</h2>
      <p>Los eventos de clic se conservan [PERIODO] y después se eliminan o se agregan.</p>

      <h2>Tus derechos</h2>
      <p>
        Puedes ejercer tus derechos de acceso, rectificación, supresión, limitación, portabilidad y
        oposición escribiendo a [EMAIL DE CONTACTO], y reclamar ante la Agencia Española de
        Protección de Datos.
      </p>

      <h2>Tiendas de terceros</h2>
      <p>
        Al pulsar en una oferta abandonas este sitio. La tienda de destino aplica su propia política
        de privacidad y sus propias cookies, sobre las que no tenemos control.
      </p>
    </LegalPage>
  );
}
