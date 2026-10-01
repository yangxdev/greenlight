import { Accent, Hero, Section, SiteFooter, SiteHeader } from './components/shell/index.ts';
import { buttonClass, Cell, CellGrid, DetailList, Note } from './components/ui/index.ts';
import { HealthBadge } from './features/health/HealthBadge.tsx';

/**
 * The scaffold page. It shows the house anatomy (header, hero, numbered sections, footer) so the Factory starts
 * from the right structure; it replaces the content by implementing blueprint.md, not the structure.
 */
export default function App() {
  return (
    <div className="min-h-dvh">
      <SiteHeader
        nav={[
          { href: '#how', label: 'How it works' },
          { href: '#status', label: 'Status' },
        ]}
      />

      <main>
        <Hero
          eyebrow={<HealthBadge />}
          title={
            <>
              Scaffolded and <Accent>waiting</Accent> for its blueprint.
            </>
          }
          lede="The Factory replaces this page by implementing blueprint.md, keeping the header, the numbered sections and the footer."
          actions={
            <>
              <a href="#how" className={buttonClass('primary')}>
                See the structure
              </a>
              <a href="#status" className={buttonClass('ghost')}>
                Check the API
              </a>
            </>
          }
          footnote={
            <Note>Nothing here is stored. This page exists only until the first build.</Note>
          }
        />

        <Section id="how" index="01" label="Structure" title="One page, ruled like a document">
          <CellGrid>
            <Cell index="01" title="A rail per section">
              Every section carries its number and name on the left, with the content a third of the
              way in.
            </Cell>
            <Cell index="02" title="Hairlines, not cards">
              Rows are separated by rules, cells share their borders, corners are square.
            </Cell>
            <Cell index="03" title="One accent">
              Vermilion marks the indices, the product mark and one word in the headline. Buttons
              are ink.
            </Cell>
          </CellGrid>
        </Section>

        <Section
          id="status"
          index="02"
          label="Status"
          tone="zone"
          title="What the scaffold ships with"
        >
          <DetailList
            onZone
            items={[
              {
                label: 'Health check',
                value: "GET /api/health, the Publisher's smoke test. Keep it.",
              },
              { label: 'Server', value: 'Cloudflare Worker · R2 · MongoDB Atlas' },
              { label: 'Front end', value: 'React 19 · Vite · Redux Toolkit · Tailwind v4' },
            ]}
          />
        </Section>
      </main>

      <SiteFooter>
        <Note>Built by Greenlight from a public idea. Corrections welcome.</Note>
      </SiteFooter>
    </div>
  );
}
