'use client';

import { useActionState } from 'react';

import { saveSettingsAction } from '@/app/admin/(panel)/settings/actions';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { idleState, type ActionState } from '@/lib/action-state';
import type { SettingsInput } from '@/validation/settings';

export function SettingsForm({ settings }: { settings: SettingsInput }) {
  const { toast } = useToast();
  const [state, action, saving] = useActionState(
    async (previous: ActionState, formData: FormData) => {
      const result = await saveSettingsAction(previous, formData);
      if (result.status !== 'idle' && result.message) {
        toast({ tone: result.status === 'error' ? 'error' : 'success', title: result.message });
      }
      return result;
    },
    idleState,
  );

  const error = (field: string) => state.fieldErrors?.[field]?.[0];

  return (
    <form action={action} className="max-w-2xl space-y-5">
      <section className="border-ink-200 space-y-4 rounded-[--radius-card] border bg-white p-4">
        <h2 className="text-ink-900 text-base font-semibold">Sitio</h2>

        <Field id="site_name" label="Nombre del sitio" required error={error('site_name')}>
          <Input id="site_name" name="site_name" defaultValue={settings.site_name} required />
        </Field>

        <Field id="site_description" label="Descripción" required error={error('site_description')}>
          <Input
            id="site_description"
            name="site_description"
            defaultValue={settings.site_description}
            required
          />
        </Field>

        <Field id="logo_url" label="URL del logotipo" error={error('logo_url')}>
          <Input id="logo_url" name="logo_url" type="url" defaultValue={settings.logo_url ?? ''} />
        </Field>
      </section>

      <section className="border-ink-200 space-y-4 rounded-[--radius-card] border bg-white p-4">
        <h2 className="text-ink-900 text-base font-semibold">Afiliación</h2>

        <Field
          id="affiliate_disclosure"
          label="Aviso de afiliación"
          hint="Se muestra en el pie y en cada ficha de producto. Entre 20 y 500 caracteres."
          required
          error={error('affiliate_disclosure')}
        >
          <Textarea
            id="affiliate_disclosure"
            name="affiliate_disclosure"
            defaultValue={settings.affiliate_disclosure}
            maxLength={500}
            required
          />
        </Field>

        <Field
          id="outbound_tracking_mode"
          label="Modo de seguimiento de clics"
          hint="«Directo» enlaza a la tienda y mide con un beacon (siempre compatible). «Redirección» pasa por /go/… y sólo se aplica a tiendas que lo permiten."
          error={error('outbound_tracking_mode')}
        >
          <Select
            id="outbound_tracking_mode"
            name="outbound_tracking_mode"
            defaultValue={settings.outbound_tracking_mode}
          >
            <option value="direct">Directo (recomendado)</option>
            <option value="redirect">Redirección /go/…</option>
          </Select>
        </Field>
      </section>

      <section className="border-ink-200 grid gap-4 rounded-[--radius-card] border bg-white p-4 sm:grid-cols-2">
        <Field id="default_currency" label="Moneda por defecto" error={error('default_currency')}>
          <Input
            id="default_currency"
            name="default_currency"
            maxLength={3}
            defaultValue={settings.default_currency}
          />
        </Field>
        <Field id="default_market" label="Mercado por defecto" error={error('default_market')}>
          <Input
            id="default_market"
            name="default_market"
            maxLength={2}
            defaultValue={settings.default_market}
          />
        </Field>
      </section>

      <Button type="submit" size="lg" disabled={saving}>
        {saving ? 'Guardando…' : 'Guardar configuración'}
      </Button>
    </form>
  );
}
