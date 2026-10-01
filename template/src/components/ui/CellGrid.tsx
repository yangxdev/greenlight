import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';
import { indexClass } from './styles.ts';

const COLUMNS = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
};

interface CellGridProps {
  children: ReactNode;
  columns?: keyof typeof COLUMNS;
  className?: string;
}

/**
 * Cells that share their borders, like a table: sakana.ai's "01 / 02 / 03" feature row and its price grid.
 * The 1px gap over a `line` background draws the inner rules, so cells never double up their borders.
 */
export function CellGrid({ children, columns = 3, className }: CellGridProps) {
  return (
    <div className={cn('grid gap-px border border-line bg-line', COLUMNS[columns], className)}>
      {children}
    </div>
  );
}

interface CellProps {
  /** Two digits, e.g. "01". */
  index?: string;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Cell({ index, title, children, className }: CellProps) {
  return (
    <div className={cn('bg-canvas p-6 sm:p-7', className)}>
      {index ? <p className={indexClass}>{index}</p> : null}
      {title ? (
        <h3 className={cn('text-h3 font-semibold text-ink', index && 'mt-3')}>{title}</h3>
      ) : null}
      {children ? <div className="mt-3 text-small text-muted">{children}</div> : null}
    </div>
  );
}

interface StatProps {
  value: ReactNode;
  caption: ReactNode;
  className?: string;
}

/** A figure in large mono with a caption under it. Put it in a `Cell` or a `CellGrid`. */
export function Stat({ value, caption, className }: StatProps) {
  return (
    <div className={cn('bg-canvas p-6 sm:p-7', className)}>
      <p className="font-mono text-[2rem] leading-none tracking-tight text-ink tnum">{value}</p>
      <p className="mt-3 text-small text-muted">{caption}</p>
    </div>
  );
}
