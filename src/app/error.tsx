'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

/**
 * Global error boundary.
 *
 * `error.message` is intentionally not rendered: in production it could expose
 * internals. The digest is enough to correlate with the server logs.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('ui.unhandled_error', error.digest ?? 'sin-digest');
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-ink-900 text-2xl font-bold">Algo no ha ido bien</h1>
      <p className="text-ink-500 mt-2 text-sm">
        Hemos registrado el fallo. Puedes intentarlo de nuevo.
      </p>
      {error.digest ? (
        <p className="text-ink-400 mt-1 font-mono text-xs">ref: {error.digest}</p>
      ) : null}
      <Button className="mt-6" onClick={reset}>
        Reintentar
      </Button>
    </div>
  );
}
