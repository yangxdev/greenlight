import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';
import { containerClass, indexClass } from '../ui/styles.ts';

interface SectionProps {
  /** Anchor target for the header navigation. */
  id: string;
  /** Two digits, e.g. "01". Sections are numbered in page order. */
  index: string;
  /** The section's name in the rail, e.g. "Checklist". Short: one or two words. */
  label: string;
  /** The h2. Optional when the content speaks for itself (a tool's main list). */
  title?: ReactNode;
  /** One or two sentences under the title. */
  lede?: ReactNode;
  /** `zone` sets a section apart with a half-step band, for alternating sections. */
  tone?: 'canvas' | 'zone';
  children: ReactNode;
  className?: string;
}

/**
 * THE device: a left rail that holds the section's identity (accent index, a short accent rule, a mono label),
 * with the content a third of the way in. It is what makes a page read as sakana.ai / yangxdev.com instead of a
 * template. On narrow screens the rail becomes one line above the content. Sections are separated by full-width
 * hairlines.
 */
export function Section({
  id,
  index,
  label,
  title,
  lede,
  tone = 'canvas',
  children,
  className,
}: SectionProps) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={title ? headingId : undefined}
      aria-label={title ? undefined : label}
      className={cn(
        'scroll-mt-header border-b border-line px-gutter py-section',
        tone === 'zone' ? 'bg-zone' : 'bg-canvas',
        className,
      )}
    >
      <div
        className={cn(
          containerClass,
          'grid gap-x-10 gap-y-8 lg:grid-cols-[var(--spacing-rail)_minmax(0,1fr)]',
        )}
      >
        <div className="flex items-center gap-3.5 lg:flex-col lg:items-start lg:pt-2">
          <span className={indexClass}>{index}</span>
          <span aria-hidden="true" className="h-0.5 w-6.5 shrink-0 bg-brand" />
          <span className="font-mono text-label uppercase text-muted">{label}</span>
        </div>
        <div className="min-w-0">
          {title ? (
            <div className="mb-10 max-w-3xl">
              <h2 id={headingId} className="text-h2 font-semibold text-balance text-ink">
                {title}
              </h2>
              {lede ? <p className="mt-4 text-body text-pretty text-muted">{lede}</p> : null}
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </section>
  );
}
