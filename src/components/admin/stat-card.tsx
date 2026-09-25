import { cn } from '@/lib/cn';

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: 'neutral' | 'brand' | 'deal' | 'warning';
}) {
  const accent = {
    neutral: 'text-ink-900',
    brand: 'text-brand-700',
    deal: 'text-deal-700',
    warning: 'text-amber-700',
  }[tone];

  return (
    <div className="border-ink-200 rounded-[--radius-card] border bg-white p-4">
      <p className="text-ink-500 text-xs font-medium">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums', accent)}>{value}</p>
      {hint ? <p className="text-ink-400 mt-0.5 text-xs">{hint}</p> : null}
    </div>
  );
}
