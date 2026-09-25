import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-ink-200 flex flex-col items-center justify-center rounded-[--radius-card] border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? <div className="text-ink-400 mb-3">{icon}</div> : null}
      <h3 className="text-ink-900 text-base font-semibold">{title}</h3>
      {description ? <p className="text-ink-500 mt-1 max-w-md text-sm">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
