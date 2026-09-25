import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import type { ReactNode } from 'react';

import { ToastProvider } from '@/components/ui/toast';
import { siteUrl } from '@/lib/env';
import { getSettings } from '@/repositories/settings';

import './globals.css';

const geist = Geist({ variable: '--font-geist-sans', subsets: ['latin'], display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: `${settings.site_name} — ${settings.site_description}`,
      template: `%s · ${settings.site_name}`,
    },
    description: settings.site_description,
    applicationName: settings.site_name,
    openGraph: { type: 'website', locale: 'es_ES', siteName: settings.site_name },
    twitter: { card: 'summary_large_image' },
    robots: { index: true, follow: true },
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={geist.variable}>
      <body className="min-h-screen font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
