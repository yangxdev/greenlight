import { cn } from '../../lib/cn.ts';

/**
 * The product's mark: a small vermilion square before the lowercase name, the way sakana.ai sets its small red glyph
 * before "sakana namazu". Deliberately plain: no kanji seal, which is yangxdev.com's personal branding (compass.md),
 * and no drawn logo, which the Factory cannot draw well. Decorative: the name always sits next to it in text.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('inline-block size-2.5 shrink-0 bg-brand', className)} />
  );
}
