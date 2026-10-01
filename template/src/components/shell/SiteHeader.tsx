import { SITE_NAME, SITE_TAG } from '../../app/site.ts';
import { cn } from '../../lib/cn.ts';
import { Mark } from '../ui/Mark.tsx';
import { containerClass } from '../ui/styles.ts';
import { ThemeToggle } from '../ui/ThemeToggle.tsx';

export interface NavItem {
  href: string;
  label: string;
}

interface SiteHeaderProps {
  /** In-page anchors or the product's other screens (max 3). Omit for a one-screen product. */
  nav?: readonly NavItem[];
  /** The `href` of the nav item for the current screen or section; it takes the accent. */
  current?: string;
}

/**
 * Mark, lowercase name and a mono tag on the left (sakana.ai's "sakana namazu  japan-vibes LLM"), mono navigation and the
 * theme switch on the right. Solid canvas with a hairline: no blur, no shadow.
 */
export function SiteHeader({ nav = [], current }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 h-header border-b border-line bg-canvas px-gutter">
      <div className={cn(containerClass, 'flex h-full items-center justify-between gap-6')}>
        <a href="/" className="flex min-w-0 items-center gap-2.5">
          <Mark />
          <span className="text-[1.0625rem] font-semibold tracking-tight text-ink">
            {SITE_NAME}
          </span>
          <span className="hidden truncate font-mono text-[0.75rem] text-muted sm:block">
            {SITE_TAG}
          </span>
        </a>
        <div className="flex items-center gap-6">
          {nav.length > 0 ? (
            <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
              {nav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={item.href === current ? 'page' : undefined}
                  className={cn(
                    'font-mono text-[0.8125rem] transition-colors duration-(--duration-hover) ease-out-soft',
                    item.href === current ? 'text-brand' : 'text-ink-soft hover:text-ink',
                  )}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          ) : null}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
