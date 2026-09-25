import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="text-brand-700 text-sm font-semibold">Error 404</p>
      <h1 className="text-ink-900 mt-2 text-2xl font-bold sm:text-3xl">
        No encontramos esta página
      </h1>
      <p className="text-ink-500 mt-2 text-sm">
        Puede que el producto se haya retirado o que el enlace sea antiguo.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/">Ir al inicio</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/productos">Ver productos</Link>
        </Button>
      </div>
    </div>
  );
}
