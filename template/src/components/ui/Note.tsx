import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';

interface NoteProps {
  children: ReactNode;
  /** A reference mark before the note, e.g. `*1` when the text above carries the same mark. */
  mark?: string;
  className?: string;
}

/**
 * A footnote in small muted type: the honest caveat under a claim ("Not yet verified", "Prices converted at …").
 * sakana.ai puts these right under the thing they qualify, not in a banner.
 */
export function Note({ children, mark, className }: NoteProps) {
  return (
    <p className={cn('flex gap-1.5 text-note text-muted', className)}>
      {mark ? <span className="shrink-0 font-mono">{mark}</span> : null}
      <span>{children}</span>
    </p>
  );
}
