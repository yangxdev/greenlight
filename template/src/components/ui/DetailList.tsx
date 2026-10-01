import type { ReactNode } from 'react';

export interface Detail {
  label: string;
  value: ReactNode;
}

interface DetailListProps {
  items: Detail[];
  /** Set inside a `zone` section: the label column then takes the canvas instead, or it would vanish. */
  onZone?: boolean;
}

/**
 * A ruled label/value table (the 会社概要 layout): the label column takes the `zone` band, hairlines between rows.
 * On phones each label sits above its value.
 */
export function DetailList({ items, onZone = false }: DetailListProps) {
  return (
    <dl className="border-t border-line">
      {items.map(({ label, value }) => (
        <div key={label} className="grid border-b border-line sm:grid-cols-[12rem_minmax(0,1fr)]">
          <dt
            className={`${onZone ? 'bg-canvas' : 'bg-zone'} px-4 pt-3 pb-1 text-small font-semibold text-ink-soft sm:py-3.5`}
          >
            {label}
          </dt>
          <dd className="px-4 pt-1 pb-3 text-small text-muted sm:py-3.5">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
