import { cardClass, DetailList, labelClass, ThemeToggle } from './components/ui/index.ts';
import { SITE_NAME } from './app/site.ts';
import { HealthBadge } from './features/health/HealthBadge.tsx';

export default function App() {
  return (
    <div className="min-h-dvh pb-[var(--safe-b)]">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <span className="text-sm font-semibold tracking-tight text-ink">{SITE_NAME}</span>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className={labelClass}>Scaffold</p>
        <h1 className="mt-2 text-display font-semibold text-ink">{SITE_NAME}</h1>
        <p className="mt-4 max-w-xl text-base text-muted">
          Scaffolded by Greenlight. The Factory replaces this page by implementing{' '}
          <code>blueprint.md</code>.
        </p>

        <section aria-label="Status" className={`${cardClass} mt-10 p-5`}>
          <DetailList
            items={[
              { label: 'API', value: <HealthBadge /> },
              {
                label: 'Stack',
                value: 'React 19 · Vite · Redux Toolkit · Tailwind v4 · Cloudflare Worker',
              },
            ]}
          />
        </section>
      </main>
    </div>
  );
}
