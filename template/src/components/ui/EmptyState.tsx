import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';
import { LuInbox } from 'react-icons/lu';

interface EmptyStateProps {
  /** A Lucide icon from `react-icons/lu`. */
  icon?: IconType;
  title: string;
  body?: string;
  /** Usually one Button: the thing to do first. */
  action?: ReactNode;
}

/** Subtle icon, one-line title, one-line explanation, one action. */
export function EmptyState({ icon: Icon = LuInbox, title, body, action }: EmptyStateProps) {
  return (
    <div className="rounded-md border border-line bg-surface px-6 py-14 text-center">
      <Icon className="mx-auto size-8 text-subtle" aria-hidden />
      <p className="mt-4 text-base font-medium text-ink">{title}</p>
      {body ? <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
