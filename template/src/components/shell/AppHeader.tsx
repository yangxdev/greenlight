import type { ReactNode } from 'react';
import { SITE_NAME, SITE_TAG } from '../../app/site.ts';
import { cn } from '../../lib/cn.ts';
import { Mark } from '../ui/Mark.tsx';
import { ThemeToggle } from '../ui/ThemeToggle.tsx';
import type { NavItem } from './SiteHeader.tsx';

interface AppHeaderProps {
  /** The product's screens (max 3). Omit for a one-screen tool. */
  nav?: readonly NavItem[];
  /** The `href` of the current screen; it takes the accent rule. */
  current?: string;
  /** Right side, before the theme switch: account state, at most one primary action. */
  actions?: ReactNode;
  /** Renders each nav link, so a router can supply its own `<Link>`. Defaults to a plain `<a>`. */
  renderLink?: (item: NavItem, props: { className: string; 'aria-current'?: 'page' }) => ReactNode;
}

/**
 * The app layout's bar: the mark, name and mono tag, the screens as mono tabs, actions and the theme switch, in one
 * compact row across the full width. On phones the tabs drop to a second row instead of disappearing.
 */
export function AppHeader({ nav = [], current, actions, renderLink }: AppHeaderProps) {
  const tabs =
    nav.length > 0 ? (
      <nav aria-label="Main" className="flex items-stretch gap-6">
        {nav.map((item) => {
          const selected = item.href === current;
          const props = {
            className: cn(
              '-mb-px inline-flex items-center border-b-2 font-mono text-[0.8125rem] transition-colors duration-(--duration-hover) ease-out-soft pointer-coarse:min-h-11',
              selected
                ? 'border-brand text-ink'
                : 'border-transparent text-ink-soft hover:text-ink',
            ),
            ...(selected ? { 'aria-current': 'page' as const } : null),
          };
          return renderLink ? (
            <span key={item.href} className="flex">
              {renderLink(item, props)}
            </span>
          ) : (
            <a key={item.href} href={item.href} {...props}>
              {item.label}
            </a>
          );
        })}
      </nav>
    ) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas px-edge">
      <div className="flex h-bar items-stretch justify-between gap-6">
        <div className="flex min-w-0 items-stretch gap-8">
          <a href="/" className="flex min-w-0 items-center gap-2.5">
            <Mark />
            <span className="font-semibold tracking-tight text-ink">{SITE_NAME}</span>
            <span className="hidden truncate font-mono text-[0.75rem] text-muted lg:block">
              {SITE_TAG}
            </span>
          </a>
          {tabs ? <div className="hidden items-stretch md:flex">{tabs}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {actions}
          <ThemeToggle />
        </div>
      </div>
      {tabs ? <div className="flex h-10 items-stretch md:hidden">{tabs}</div> : null}
    </header>
  );
}
