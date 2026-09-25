import type { Metadata } from 'next';
import Link from 'next/link';

import { LoginForm } from '@/app/admin/login/login-form';
import { safeInternalPath } from '@/lib/action-state';
import type { SearchParams } from '@/lib/catalog-params';

export const metadata: Metadata = {
  title: 'Acceso',
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const rawNext = Array.isArray(params['next']) ? params['next'][0] : params['next'];
  const next = safeInternalPath(rawNext ?? null, '/admin');
  const forbidden = params['error'] === 'forbidden';

  return (
    <div className="bg-ink-50 flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-ink-900 text-xl font-bold">Panel de administración</h1>
          <p className="text-ink-500 mt-1 text-sm">Acceso restringido al equipo editorial.</p>
        </div>

        {forbidden ? (
          <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Tu cuenta no tiene permisos de administración.
          </p>
        ) : null}

        <div className="border-ink-200 rounded-[--radius-card] border bg-white p-6 shadow-sm">
          <LoginForm next={next} />
        </div>

        <p className="text-center">
          <Link href="/" className="text-ink-500 hover:text-ink-800 text-sm">
            ← Volver al sitio
          </Link>
        </p>
      </div>
    </div>
  );
}
