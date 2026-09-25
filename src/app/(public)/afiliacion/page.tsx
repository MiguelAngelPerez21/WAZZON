import type { Metadata } from 'next';

import { LegalPage } from '@/components/public/legal-page';
import { getSettings } from '@/repositories/settings';

export const metadata: Metadata = {
  title: 'Aviso de afiliación',
  description: 'Cómo nos financiamos y qué significan los enlaces de afiliado de este sitio.',
};

export default async function AffiliatePage() {
  const settings = await getSettings();

  return (
    <LegalPage title="Aviso de afiliación" updatedAt="[FECHA]">
      <p>{settings.affiliate_disclosure}</p>

      <h2>Qué es un enlace de afiliado</h2>
      <p>
        Cuando pulsas en «Ver oferta» te enviamos a la tienda correspondiente a través de un enlace
        que identifica a {settings.site_name}. Si realizas una compra, la tienda puede pagarnos una
        comisión. <strong>El precio que pagas es exactamente el mismo.</strong>
      </p>

      <h2>Qué no hacemos</h2>
      <ul>
        <li>No vendemos productos ni gestionamos pedidos, pagos, envíos ni devoluciones.</li>
        <li>No inventamos valoraciones, opiniones, contadores de ventas ni unidades restantes.</li>
        <li>No mostramos un descuento si la tienda no publica también un precio anterior.</li>
      </ul>

      <h2>Precios y disponibilidad</h2>
      <p>
        Los precios y la disponibilidad se muestran tal y como los publica cada tienda en el momento
        en que los registramos y pueden cambiar en cualquier momento. La información válida es
        siempre la de la página de la tienda.
      </p>

      <h2>Reclamaciones</h2>
      <p>
        Cualquier incidencia con un pedido debe tramitarse directamente con la tienda donde se
        realizó la compra. Para dudas sobre este sitio escribe a [EMAIL DE CONTACTO].
      </p>
    </LegalPage>
  );
}
