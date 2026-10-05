import { AppFooter, AppHeader, AppShell, ViewHeader } from './components/shell/index.ts';
import { DetailList, EmptyState, Note, Pane, buttonClass } from './components/ui/index.ts';
import { HealthBadge } from './features/health/HealthBadge.tsx';

/**
 * The scaffold, in the `app` layout (the default): a compact bar, a view header, then the product's working view.
 * The Factory replaces the content by implementing blueprint.md. A blueprint whose Identity says `Layout: page`
 * swaps the shell for SiteHeader, Hero, numbered Sections and SiteFooter instead (CLAUDE.md → "Look & feel").
 */
export default function App() {
  return (
    <AppShell
      header={<AppHeader />}
      footer={
        <AppFooter links={[{ href: '/api/health', label: 'api/health' }]}>
          Built by Greenlight from a public idea. Nothing here is stored yet.
        </AppFooter>
      }
    >
      <ViewHeader
        eyebrow="Scaffold"
        title="Waiting for its blueprint"
        meta={<HealthBadge />}
        actions={
          <a href="/api/health" className={buttonClass('ghost', 'sm')}>
            Check the API
          </a>
        }
      />

      <div className="grid items-start gap-6 px-edge py-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <EmptyState
          title="Nothing built yet"
          body="The Factory replaces this view with the tool the blueprint describes, right under the bar."
        />
        <Pane label="Ships with" flush>
          <DetailList
            items={[
              { label: 'Health check', value: 'GET /api/health. Keep it.' },
              { label: 'Server', value: 'Cloudflare Worker · R2 · MongoDB Atlas' },
              { label: 'Front end', value: 'React 19 · Vite · Redux Toolkit · Tailwind v4' },
            ]}
          />
          <Note className="px-4 py-3">The Publisher's smoke test calls the health check.</Note>
        </Pane>
      </div>
    </AppShell>
  );
}
