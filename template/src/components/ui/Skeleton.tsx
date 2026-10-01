import { cn } from '../../lib/cn.ts';

/** A placeholder block while data loads. Prefer these to spinners; size it like the content it stands in for. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse bg-sunken', className)} />;
}
