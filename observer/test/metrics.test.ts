import { describe, expect, it } from 'vitest'
import { boardMetrics, buildMetrics, markdownSection } from '../src/metrics.ts'
import type { ProbeStore } from '../src/store.ts'
import type { ObserverConfig } from '../src/types.ts'
import { reportWindow } from '../src/week.ts'
import { ACCOUNT, NOW, SITE_TAG, fakeFetch, json, makeCtx, world } from './helpers.ts'

const config: ObserverConfig = { siteTags: {}, probeTimeoutMs: 1000, probeRetentionDays: 35 }
const CF_ENV = { CLOUDFLARE_API_TOKEN: 'cf', CLOUDFLARE_ACCOUNT_ID: ACCOUNT }

function fakeStore(checks: number, ok: number): ProbeStore & { asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    async insert() {},
    async uptime(url, start, end) {
      asked.push(`${url} ${start.toISOString()} ${end.toISOString()}`)
      return { checks, ok }
    },
    async close() {},
  }
}

describe('markdownSection', () => {
  it('returns the text under a heading up to the next one', () => {
    const md = '# T\n\n## Success metric\n\n50 visits.\nSecond line.\n\n## Setup notes\n\nx'
    expect(markdownSection(md, 'Success metric')).toBe('50 visits.\nSecond line.')
    expect(markdownSection(md, 'success METRIC')).toBe('50 visits.\nSecond line.')
    expect(markdownSection(md, 'Routes')).toBeNull()
    expect(markdownSection('## Success metric\n\n## Next', 'Success metric')).toBeNull()
  })
})

describe('boardMetrics', () => {
  it('counts open issues per state label, lists stuck ones, counts ideas filed in the week', () => {
    const issues = [
      { number: 1, title: '[idea] A', state: 'open' as const, labels: [{ name: 'idea' }], created_at: '2026-09-28T00:00:00Z' },
      { number: 2, title: '[idea] B', state: 'open' as const, labels: [{ name: 'stuck' }], created_at: '2026-10-05T00:00:00Z' },
      { number: 3, title: '[idea] C', state: 'closed' as const, labels: [{ name: 'idea' }], created_at: '2026-10-01T00:00:00Z' },
      { number: 4, title: 'PR', state: 'open' as const, labels: [{ name: 'idea' }], created_at: '2026-10-01T00:00:00Z', pull_request: {} },
    ]
    const board = boardMetrics(issues, reportWindow(NOW))
    expect(board.counts).toMatchObject({ idea: 1, stuck: 1, live: 0 })
    expect(board.stuck).toEqual([{ issue: 2, title: '[idea] B' }])
    expect(board.ideasFiledThisWeek).toBe(2) // #1 and #3; #2 was filed on the Monday after
  })
})

describe('buildMetrics', () => {
  it('combines probes history, traffic, success metric and board state', async () => {
    const store = fakeStore(28, 27)
    const metrics = await buildMetrics({
      ctx: makeCtx(fakeFetch(world()), { GITHUB_TOKEN: 'pat', ...CF_ENV }),
      config,
      greenlightRepo: 'me/greenlight',
      store,
    })

    expect(metrics.week).toBe('2026-W40')
    expect(metrics.window).toEqual({ start: '2026-09-28T00:00:00.000Z', end: '2026-10-05T00:00:00.000Z' })
    expect(metrics.notes).toEqual([])
    expect(store.asked).toEqual(['https://invoice-nudge.pages.dev 2026-09-28T00:00:00.000Z 2026-10-05T00:00:00.000Z'])
    expect(metrics.products).toHaveLength(1)
    expect(metrics.products[0]).toMatchObject({
      issue: 7,
      repo: 'me/invoice-nudge',
      url: 'https://invoice-nudge.pages.dev',
      liveSince: '2026-09-10T12:00:00Z',
      uptime: { checks: 28, ok: 27, pct: 96.4, source: 'probes' },
      current: { ok: true },
      traffic: { siteTag: SITE_TAG, thisWeek: { visits: 45, pageViews: 60 }, lastWeek: { visits: 20, pageViews: 30 } },
      successMetric: '50 visits/week and 5 reminders sent.',
    })
    expect(metrics.board).toMatchObject({ stuck: [{ issue: 9, title: '[idea] Shift Swap' }], ideasFiledThisWeek: 1 })
  })

  it('degrades to a point check and explains every gap in notes', async () => {
    const f = fakeFetch((url) => (url.hostname === 'api.cloudflare.com' ? undefined : world({ healthy: false })(url)))
    const metrics = await buildMetrics({ ctx: makeCtx(f), config, greenlightRepo: 'me/greenlight', store: null })
    expect(metrics.products[0]).toMatchObject({
      uptime: { checks: 1, ok: 0, pct: 0, source: 'point-check' },
      traffic: null,
      current: { ok: false },
    })
    expect(metrics.notes).toEqual([
      'No MONGODB_URI: uptime is a single check at report time, not a 7-day history.',
      'No CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID: no traffic numbers.',
    ])
    expect(f.calls.some((c) => c.url.includes('api.cloudflare.com'))).toBe(false)
  })

  it('uses configured site tags when discovery is not allowed', async () => {
    const f = fakeFetch((url) =>
      url.pathname.endsWith('/rum/site_info/list') ? json({ success: false, errors: [{ message: 'forbidden' }] }, 403) : world()(url),
    )
    const metrics = await buildMetrics({
      ctx: makeCtx(f, CF_ENV),
      config: { ...config, siteTags: { 'invoice-nudge.pages.dev': SITE_TAG } },
      greenlightRepo: 'me/greenlight',
      store: fakeStore(0, 0),
    })
    expect(metrics.products[0]?.traffic?.thisWeek.visits).toBe(45)
    expect(metrics.products[0]?.uptime.pct).toBeNull() // no probes recorded yet
    expect(metrics.notes).toEqual([
      'Web Analytics site discovery failed (Web Analytics site list failed (HTTP 403: forbidden)); only observer/config.json siteTags are used.',
    ])
  })
})
