import { ExternalLink, LogOut } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { signOutAction } from '@/app/admin/login/actions';
import { AdminNav } from '@/components/admin/admin-nav';
import { Button } from '@/components/ui/button';
import { requireAdmin } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: { default: 'Administración', template: '%s · Administración' },
  robots: { index: false, follow: false },
};

// The admin panel is per-user; nothing here may ever be statically cached.
export const dynamic = 'force-dynamic';

export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  // The real security boundary (middleware is only a convenience redirect).
  const identity = await requireAdmin();

  return (
    <div className="bg-ink-50 min-h-screen">
      <header className="border-ink-200 border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/admin" className="text-ink-900 font-bold">
            Administración
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/" target="_blank" rel="noopener">
                Ver sitio
                <ExternalLink aria-hidden className="size-4" />
              </Link>
            </Button>
            <span className="text-ink-500 hidden text-sm sm:inline">{identity.email}</span>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut aria-hidden className="size-4" />
                Salir
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row">
        <aside className="lg:w-56 lg:shrink-0">
          <AdminNav />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
