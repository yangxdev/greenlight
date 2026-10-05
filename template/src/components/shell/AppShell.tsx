import type { ReactNode } from 'react';
import { cn } from '../../lib/cn.ts';

interface AppShellProps {
  /** Usually an `AppHeader`. */
  header: ReactNode;
  /** An optional side column on wide screens (filters, a list of saved things). It stacks above the view on phones. */
  sidebar?: ReactNode;
  /** An optional one-line strip under the view: source link, what the product stores. See `AppFooter`. */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * The app layout: a compact bar, then the working view edge to edge. No hero and no numbered rail: the first thing
 * under the bar is the product doing its job. Use it for tools, dashboards, editors and anything people come back to.
 */
export function AppShell({ header, sidebar, footer, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      {header}
      <div
        className={cn(
          'flex-1',
          sidebar != null && 'lg:grid lg:grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)]',
        )}
      >
        {sidebar ? (
          <aside className="border-b border-line bg-zone px-edge py-6 lg:border-r lg:border-b-0">
            {sidebar}
          </aside>
        ) : null}
        <main className="min-w-0">{children}</main>
      </div>
      {footer}
    </div>
  );
}

interface AppFooterProps {
  links?: readonly { href: string; label: string }[];
  /** One short note: what the product stores, what it cannot do. */
  children?: ReactNode;
}

/** A single hairline strip at the bottom of an app: a note on the left, a few mono links on the right. */
export function AppFooter({ links = [], children }: AppFooterProps) {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-t border-line px-edge pt-4 pb-[calc(1rem+var(--safe-b))]">
      <div className="min-w-0 text-note text-muted">{children}</div>
      {links.length > 0 ? (
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          {links.map((link) => {
            const external = /^https?:/.test(link.href);
            return (
              <li key={link.href}>
                <a
                  href={link.href}
                  {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : null)}
                  className="font-mono text-note text-ink-soft transition-colors duration-(--duration-hover) ease-out-soft hover:text-brand"
                >
                  {link.label}
                  {external ? <span aria-hidden="true"> ↗</span> : null}
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
    </footer>
  );
}
