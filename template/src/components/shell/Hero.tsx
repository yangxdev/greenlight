import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';
import { containerClass, labelClass } from '../ui/styles.ts';

interface HeroProps {
  /** A short mono line above the headline: who it is for, or a status ("Free · no sign-up · stays in your browser"). */
  eyebrow?: ReactNode;
  /** The page's only h1. Wrap at most one word in <Accent> for the vermilion. */
  title: ReactNode;
  /** One or two sentences: what it does, for whom. */
  lede?: ReactNode;
  /** The one primary Button (or link styled with buttonClass('primary')) and at most one ghost one. */
  actions?: ReactNode;
  /** Right column on wide screens: a preview of the product, a figure, a stat grid. Never a stock illustration. */
  aside?: ReactNode;
  /** Notes under the actions (see `Note`). */
  footnote?: ReactNode;
  className?: string;
}

/** The first screen: a large tight headline, a lede and one action, left-aligned on the page's container. */
export function Hero({ eyebrow, title, lede, actions, aside, footnote, className }: HeroProps) {
  return (
    <section className={cn('border-b border-line px-gutter py-section', className)}>
      <div
        className={cn(
          containerClass,
          'grid items-center gap-x-16 gap-y-12',
          aside != null && 'lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]',
        )}
      >
        <div className="max-w-3xl">
          {eyebrow ? <p className={labelClass}>{eyebrow}</p> : null}
          <h1
            className={cn(
              'text-display font-semibold text-balance text-ink',
              eyebrow != null && 'mt-5',
            )}
          >
            {title}
          </h1>
          {lede ? <p className="mt-6 max-w-2xl text-lede text-pretty text-muted">{lede}</p> : null}
          {actions ? <div className="mt-9 flex flex-wrap gap-3">{actions}</div> : null}
          {footnote ? <div className="mt-6 max-w-2xl space-y-1">{footnote}</div> : null}
        </div>
        {aside ? <div className="min-w-0">{aside}</div> : null}
      </div>
    </section>
  );
}

/** The one accented word in a headline. Once per page. */
export function Accent({ children }: { children: ReactNode }) {
  return <span className="text-brand">{children}</span>;
}
