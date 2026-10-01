import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';

interface RuledListProps {
  children: ReactNode;
  /** `ol` when the order means something (steps, a ranking). */
  as?: 'ul' | 'ol';
  className?: string;
}

/**
 * The house replacement for a stack of cards: rows separated by hairlines, like sakana.ai's numbered testimonials
 * and yangxdev.com's experience list. Each child is a `RuledItem`.
 */
export function RuledList({ children, as: Tag = 'ul', className }: RuledListProps) {
  return <Tag className={cn('border-t border-line', className)}>{children}</Tag>;
}

interface RuledItemProps {
  /** Left column on wide screens, above the title on narrow ones: an index, a date, a category, in mono. */
  meta?: ReactNode;
  /** Right column: one control or a status. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function RuledItem({ meta, aside, children, className }: RuledItemProps) {
  return (
    <li
      className={cn(
        'grid gap-x-10 gap-y-3 border-b border-line py-6 sm:py-7',
        meta ? 'md:grid-cols-[10rem_minmax(0,1fr)_auto]' : 'md:grid-cols-[minmax(0,1fr)_auto]',
        className,
      )}
    >
      {meta ? (
        <div className="space-y-1 font-mono text-label uppercase text-muted">{meta}</div>
      ) : null}
      <div className="min-w-0">{children}</div>
      {aside ? <div className="md:pt-0.5">{aside}</div> : null}
    </li>
  );
}
