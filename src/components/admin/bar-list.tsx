/**
 * Minimal bar chart built with plain CSS.
 *
 * A charting library would add tens of kilobytes to render a handful of bars;
 * this stays accessible (it is a real list with readable numbers) and free.
 */
export function BarList({
  items,
  emptyLabel = 'Sin datos todavía',
}: {
  items: { label: string; value: number }[];
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="text-ink-500 text-sm">{emptyLabel}</p>;
  }

  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-3">
          <span className="text-ink-700 w-40 shrink-0 truncate text-sm">{item.label}</span>
          <span className="bg-ink-100 h-2 flex-1 overflow-hidden rounded-full">
            <span
              className="bg-brand-500 block h-full rounded-full"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </span>
          <span className="text-ink-600 w-12 shrink-0 text-right text-sm font-medium tabular-nums">
            {item.value}
          </span>
        </li>
      ))}
    </ul>
  );
}
