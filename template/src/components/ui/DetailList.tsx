import type { ReactNode } from 'react';
import { labelClass } from './styles.ts';

export interface Detail {
  label: string;
  value: ReactNode;
}

/** Ruled label/value rows: small uppercase caption above each value, hairlines between rows. */
export function DetailList({ items }: { items: Detail[] }) {
  return (
    <dl className="divide-y divide-line">
      {items.map(({ label, value }) => (
        <div key={label} className="py-3 first:pt-0 last:pb-0">
          <dt className={labelClass}>{label}</dt>
          <dd className="mt-1 text-sm text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
