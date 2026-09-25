'use client';

import {
  BarChart3,
  FolderTree,
  LayoutDashboard,
  Package,
  PlusCircle,
  Settings,
  Tags,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

const items = [
  { href: '/admin', label: 'Panel', icon: LayoutDashboard, exact: true },
  { href: '/admin/products/new', label: 'Añadir producto', icon: PlusCircle, exact: true },
  { href: '/admin/products', label: 'Productos', icon: Package, exact: false },
  { href: '/admin/categories', label: 'Categorías', icon: FolderTree, exact: false },
  { href: '/admin/offers', label: 'Ofertas', icon: Tags, exact: false },
  { href: '/admin/analytics', label: 'Analítica', icon: BarChart3, exact: false },
  { href: '/admin/settings', label: 'Configuración', icon: Settings, exact: false },
];

/**
 * Admin navigation. On mobile it becomes a horizontally scrollable bar instead
 * of a hidden drawer, so every section stays one tap away.
 */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones de administración">
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'bg-brand-50 text-brand-800'
                    : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                )}
              >
                <Icon aria-hidden className="size-4 shrink-0" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
