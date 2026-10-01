import type { ReactNode } from 'react';
import { labelClass } from './styles.ts';

interface EmptyStateProps {
  title: string;
  body?: string;
  /** Usually one Button: the thing to do first. */
  action?: ReactNode;
}

/** A ruled box with a one-line title, one line of explanation and one action. No illustration, no icon. */
export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <div className="border border-dashed border-line-strong px-6 py-12 sm:px-10">
      <p className={labelClass}>Empty</p>
      <p className="mt-3 text-h3 font-semibold text-ink">{title}</p>
      {body ? <p className="mt-2 max-w-prose text-small text-muted">{body}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
