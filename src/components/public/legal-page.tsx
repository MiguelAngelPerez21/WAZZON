import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { Breadcrumbs } from '@/components/public/breadcrumbs';

/**
 * Shared shell for the legal pages.
 *
 * The notice is deliberate: these texts are a starting point written by a
 * developer, not by a lawyer, and must be reviewed before going live.
 */
export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: title }]} />

      <header>
        <h1 className="text-ink-900 text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="text-ink-400 mt-1 text-xs">Última actualización: {updatedAt}</p>
      </header>

      <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong className="font-semibold">Plantilla pendiente de revisión legal.</strong>{' '}
          Sustituye los datos entre corchetes y valida este texto con un profesional antes de
          publicar.
        </span>
      </p>

      <div className="text-ink-700 [&_h2]:text-ink-900 space-y-4 text-sm leading-relaxed [&_h2]:pt-2 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </div>
  );
}
