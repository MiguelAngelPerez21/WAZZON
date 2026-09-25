'use client';

import { useActionState } from 'react';

import { signInAction } from '@/app/admin/login/actions';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { idleState } from '@/lib/action-state';

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signInAction, idleState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />

      <Field
        id="email"
        label="Correo electrónico"
        error={state.fieldErrors?.['email']?.[0]}
        required
      >
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          aria-invalid={state.fieldErrors?.['email'] ? true : undefined}
        />
      </Field>

      <Field id="password" label="Contraseña" error={state.fieldErrors?.['password']?.[0]} required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.fieldErrors?.['password'] ? true : undefined}
        />
      </Field>

      {state.status === 'error' && state.message ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}
