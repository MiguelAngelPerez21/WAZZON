import type { Metadata } from 'next';

import { SettingsForm } from '@/components/admin/settings-form';
import { getSettings } from '@/repositories/settings';

export const metadata: Metadata = { title: 'Configuración' };

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-ink-900 text-xl font-bold">Configuración</h1>
        <p className="text-ink-500 text-sm">Ajustes globales del sitio público.</p>
      </div>

      <SettingsForm settings={settings} />
    </div>
  );
}
