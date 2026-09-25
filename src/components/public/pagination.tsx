import Link from 'next/link';

import { cn } from '@/lib/cn';

/**
 * Link-based pagination: works without JavaScript and is crawlable.
 */
export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const pages = pageWindow(page, totalPages);

  return (
    <nav aria-label="Paginación" className="mt-10 flex items-center justify-center gap-1">
      <PageLink href={buildHref(page - 1)} disabled={page <= 1} rel="prev" label="Página anterior">
        Anterior
      </PageLink>

      {pages.map((value, index) =>
        value === null ? (
          <span key={`gap-${index}`} className="text-ink-400 px-2" aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={value}
            href={buildHref(value)}
            aria-current={value === page ? 'page' : undefined}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium',
              value === page ? 'bg-brand-600 text-white' : 'text-ink-700 hover:bg-ink-100',
            )}
          >
            {value}
          </Link>
        ),
      )}

      <PageLink
        href={buildHref(page + 1)}
        disabled={page >= totalPages}
        rel="next"
        label="Página siguiente"
      >
        Siguiente
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  rel,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  rel: 'prev' | 'next';
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="text-ink-300 px-3 py-2 text-sm" aria-hidden>
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      rel={rel}
      aria-label={label}
      className="text-ink-700 hover:bg-ink-100 rounded-lg px-3 py-2 text-sm font-medium"
    >
      {children}
    </Link>
  );
}

/** Compact page list: 1 … 4 5 [6] 7 8 … 20 */
function pageWindow(page: number, totalPages: number): (number | null)[] {
  const result: (number | null)[] = [];
  const add = (value: number | null) => result.push(value);

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);

  if (start > 1) {
    add(1);
    if (start > 2) add(null);
  }
  for (let value = start; value <= end; value += 1) add(value);
  if (end < totalPages) {
    if (end < totalPages - 1) add(null);
    add(totalPages);
  }

  return result;
}
