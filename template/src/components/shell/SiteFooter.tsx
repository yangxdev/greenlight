import type { ReactNode } from 'react';
import { SITE_NAME, SITE_TAG } from '../../app/site.ts';
import { cn } from '../../lib/cn.ts';
import { Mark } from '../ui/Mark.tsx';
import { containerClass } from '../ui/styles.ts';

export interface FooterLink {
  href: string;
  label: string;
}

interface SiteFooterProps {
  /** Source, "Suggest a change", contact. External links open in a new tab. */
  links?: readonly FooterLink[];
  /** Notes about the whole product (see `Note`): what it stores, what it cannot do. */
  children?: ReactNode;
}

export function SiteFooter({ links = [], children }: SiteFooterProps) {
  return (
    <footer className="bg-canvas px-gutter pt-14 pb-[calc(3.5rem+var(--safe-b))]">
      <div className={cn(containerClass, 'grid gap-10 md:grid-cols-[minmax(0,1fr)_auto]')}>
        <div className="space-y-6">
          <div className="flex items-center gap-2.5">
            <Mark />
            <span className="font-semibold tracking-tight text-ink">{SITE_NAME}</span>
            <span className="font-mono text-[0.75rem] text-muted">{SITE_TAG}</span>
          </div>
          {children ? <div className="max-w-2xl space-y-1.5">{children}</div> : null}
        </div>
        {links.length > 0 ? (
          <ul className="flex flex-wrap gap-x-6 gap-y-2 md:flex-col md:items-end">
            {links.map((link) => {
              const external = /^https?:/.test(link.href);
              return (
                <li key={link.href}>
                  <a
                    href={link.href}
                    {...(external ? { target: '_blank', rel: 'noreferrer' } : null)}
                    className="font-mono text-[0.8125rem] text-ink-soft transition-colors duration-(--duration-hover) ease-out-soft hover:text-brand"
                  >
                    {link.label}
                    {external ? <span aria-hidden="true"> ↗</span> : null}
                  </a>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </footer>
  );
}
