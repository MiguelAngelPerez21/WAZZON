import type { Metadata } from 'next';

import { LegalPage } from '@/components/public/legal-page';

export const metadata: Metadata = {
  title: 'Aviso legal',
  description: 'Información legal del sitio y condiciones de uso.',
};

export default function LegalNoticePage() {
  return (
    <LegalPage title="Aviso legal" updatedAt="[FECHA]">
      <h2>Titular</h2>
      <ul>
        <li>Titular: [NOMBRE / RAZÓN SOCIAL]</li>
        <li>NIF/CIF: [NIF]</li>
        <li>Domicilio: [DIRECCIÓN]</li>
        <li>Contacto: [EMAIL DE CONTACTO]</li>
      </ul>

      <h2>Objeto del sitio</h2>
      <p>
        Este sitio es un catálogo editorial de productos que enlaza a tiendas de terceros. No es una
        tienda: no vendemos, no cobramos, no enviamos y no gestionamos devoluciones. Toda compra se
        formaliza en la web de la tienda de destino y se rige por sus condiciones.
      </p>

      <h2>Exactitud de la información</h2>
      <p>
        Los títulos, descripciones, imágenes y precios proceden de información pública publicada por
        las tiendas. Pueden estar desactualizados. No garantizamos su exactitud y no asumimos
        responsabilidad por las decisiones de compra tomadas a partir de ellos.
      </p>

      <h2>Propiedad intelectual</h2>
      <p>
        Las marcas, logotipos e imágenes de producto pertenecen a sus respectivos titulares y se
        muestran con finalidad identificativa e informativa. Si eres titular de derechos y deseas
        que retiremos un contenido, escríbenos a [EMAIL DE CONTACTO] y lo haremos con diligencia.
      </p>

      <h2>Enlaces a terceros</h2>
      <p>
        No controlamos el contenido de los sitios enlazados ni respondemos de su disponibilidad,
        precios o prácticas comerciales.
      </p>

      <h2>Legislación aplicable</h2>
      <p>Este aviso se rige por la legislación española.</p>
    </LegalPage>
  );
}
