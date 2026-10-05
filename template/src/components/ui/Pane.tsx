import { useId, type ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';
import { labelClass } from './styles.ts';

interface PaneProps {
  /** A short mono label for the strip at the top: "Recent", "Uptime · 7 days". */
  label: string;
  /** Right side of the strip: a count, a link, one small control. */
  aside?: ReactNode;
  children: ReactNode;
  /** `flush` drops the body padding, for a `RuledList` or a table that draws its own rows. */
  flush?: boolean;
  className?: string;
}

/**
 * A titled region of an app view: a hairline box with a mono label strip. Dashboards and detail views are built
 * from these instead of numbered sections. A landmark named by its label.
 */
export function Pane({ label, aside, children, flush = false, className }: PaneProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn('min-w-0 border border-line bg-canvas', className)}>
      <div className="flex min-h-10 items-center justify-between gap-4 border-b border-line px-4">
        <h2 id={id} className={labelClass}>
          {label}
        </h2>
        {aside ? <div className="text-note text-muted">{aside}</div> : null}
      </div>
      <div className={flush ? undefined : 'p-4'}>{children}</div>
    </section>
  );
}
