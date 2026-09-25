import Link from 'next/link';

import { getSettings } from '@/repositories/settings';

const legalLinks = [
  { href: '/afiliacion', label: 'Aviso de afiliación' },
  { href: '/privacidad', label: 'Privacidad' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/aviso-legal', label: 'Aviso legal' },
];

export async function SiteFooter() {
  const settings = await getSettings();
  const year = new Date().getFullYear();

  return (
    <footer className="border-ink-200 mt-16 border-t bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10">
        {/* Affiliate disclosure: visible, legible, not hidden in fine print. */}
        <div className="border-ink-200 bg-ink-50 text-ink-700 rounded-[--radius-card] border p-4 text-sm">
          <p>
            <strong className="text-ink-900 font-semibold">Transparencia:</strong>{' '}
            {settings.affiliate_disclosure}{' '}
            <Link href="/afiliacion" className="text-brand-700 font-medium underline">
              Más información
            </Link>
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-ink-900 font-semibold">{settings.site_name}</p>
            <p className="text-ink-500 text-sm">{settings.site_description}</p>
          </div>

          <nav aria-label="Enlaces legales">
            <ul className="flex flex-wrap gap-x-4 gap-y-2">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-ink-600 hover:text-ink-900 text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="text-ink-400 mt-6 text-xs">
          © {year} {settings.site_name}. Los precios y la disponibilidad se muestran tal y como los
          publica cada tienda y pueden variar.
        </p>
      </div>
    </footer>
  );
}
