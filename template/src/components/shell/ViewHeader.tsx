import type { ReactNode } from 'react';
import { labelClass } from '../ui/styles.ts';

interface ViewHeaderProps {
  /** The view's h1, plain words: "Invoices", "Pipeline". Not a slogan. */
  title: ReactNode;
  /** A mono line above the title: a breadcrumb, the parent view, a count. */
  eyebrow?: ReactNode;
  /** One line under the title: counts, "Updated 12:04", a filter summary. */
  meta?: ReactNode;
  /** Right side: at most one primary Button and a ghost or two. */
  actions?: ReactNode;
  /** A row on the band's bottom rule: filters (`Segmented`), a search field. */
  toolbar?: ReactNode;
}

/**
 * The top of an app view: title, meta and actions in one band, then an optional toolbar. It replaces the `page`
 * layout's hero inside an `AppShell`, so the content starts a few lines under the bar.
 */
export function ViewHeader({ title, eyebrow, meta, actions, toolbar }: ViewHeaderProps) {
  return (
    <div className="border-b border-line px-edge">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 py-6">
        <div className="min-w-0">
          {eyebrow ? <p className={labelClass}>{eyebrow}</p> : null}
          <h1 className={`text-title font-semibold text-balance text-ink ${eyebrow ? 'mt-2' : ''}`}>
            {title}
          </h1>
          {meta ? <div className="mt-2 text-small text-muted">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
      {toolbar ? (
        // -mb-px: a Segmented's own rule lands on this band's bottom hairline instead of doubling it.
        <div className="-mb-px flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          {toolbar}
        </div>
      ) : null}
    </div>
  );
}
