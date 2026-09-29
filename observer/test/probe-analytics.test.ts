import { describe, expect, it } from 'vitest'
import { listSiteTags, weeklyTraffic } from '../src/analytics.ts'
import { probe } from '../src/probe.ts'
import { reportWindow } from '../src/week.ts'
import { ACCOUNT, NOW, SITE_TAG, fakeFetch, json, makeCtx, world } from './helpers.ts'

const CF_ENV = { CLOUDFLARE_API_TOKEN: 'cf', CLOUDFLARE_ACCOUNT_ID: ACCOUNT }

describe('probe', () => {
  it('is up when /api/health says ok and / answers 200', async () => {
    const result = await probe(makeCtx(fakeFetch(world())), 'https://invoice-nudge.pages.dev/', 1000)
    expect(result).toMatchObject({ url: 'https://invoice-nudge.pages.dev', ok: true, healthOk: true, homeStatus: 200, error: null })
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    expect(result.at).toBe(NOW.toISOString())
  })

  it('is down on 5xx, and says which check failed', async () => {
    const result = await probe(makeCtx(fakeFetch(world({ healthy: false }))), 'https://invoice-nudge.pages.dev', 1000)
    expect(result).toMatchObject({ ok: false, healthOk: false, homeStatus: 502 })
    expect(result.error).toBe('/api/health: HTTP 502, not JSON; /: HTTP 502')
  })

  it('is down when health answers 200 without ok: true', async () => {
    const f = fakeFetch((url) => (url.pathname === '/api/health' ? json({ ok: false }) : new Response('ok')))
    expect(await probe(makeCtx(f), 'https://x.pages.dev', 1000)).toMatchObject({ ok: false, healthOk: false, homeStatus: 200 })
  })

  it('records network errors instead of throwing', async () => {
    const f = fakeFetch(() => {
      throw new TypeError('fetch failed')
    })
    const result = await probe(makeCtx(f), 'https://x.pages.dev', 1000)
    expect(result).toMatchObject({ ok: false, latencyMs: null, homeStatus: null })
    expect(result.error).toBe('/api/health: fetch failed; /: fetch failed')
  })
})

describe('listSiteTags', () => {
  it('maps hosts and zone names to site tags', async () => {
    const f = fakeFetch(() =>
      json({
        success: true,
        result: [
          { site_tag: SITE_TAG, host: 'Invoice-Nudge.pages.dev' },
          { site_tag: 'c'.repeat(32), host: null, ruleset: { zone_name: 'example.com' } },
        ],
      }),
    )
    const tags = await listSiteTags(makeCtx(f, CF_ENV))
    expect([...tags.entries()]).toEqual([
      ['invoice-nudge.pages.dev', SITE_TAG],
      ['example.com', 'c'.repeat(32)],
    ])
    expect(f.calls[0]?.url).toBe(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/rum/site_info/list?per_page=100`)
  })

  it('reports permission errors', async () => {
    const f = fakeFetch(() => json({ success: false, errors: [{ message: 'Authentication error' }] }, 403))
    await expect(listSiteTags(makeCtx(f, CF_ENV))).rejects.toThrow('Web Analytics site list failed (HTTP 403: Authentication error)')
  })
})

describe('weeklyTraffic', () => {
  const window = reportWindow(NOW)

  it('splits the two weeks and sums visits and page views', async () => {
    const f = fakeFetch(world())
    const traffic = await weeklyTraffic(makeCtx(f, CF_ENV), SITE_TAG, window)
    expect(traffic).toEqual({ thisWeek: { visits: 45, pageViews: 60 }, lastWeek: { visits: 20, pageViews: 30 } })
    const { query } = JSON.parse(String(f.calls[0]?.init?.body)) as { query: string }
    expect(query).toContain(`accountTag: "${ACCOUNT}"`)
    expect(query).toContain(`siteTag: "${SITE_TAG}", date_geq: "2026-09-21", date_leq: "2026-10-04"`)
  })

  it('treats GraphQL errors in a 200 response as failures', async () => {
    const f = fakeFetch(() => json({ data: null, errors: [{ message: 'not authorized for that account' }] }))
    await expect(weeklyTraffic(makeCtx(f, CF_ENV), SITE_TAG, window)).rejects.toThrow('not authorized for that account')
  })

  it('refuses ids that are not 32 hex chars (they are inlined into the query)', async () => {
    const f = fakeFetch(world())
    await expect(weeklyTraffic(makeCtx(f, CF_ENV), 'x" } evil', window)).rejects.toThrow('is not a 32-character hex id')
    await expect(weeklyTraffic(makeCtx(f, { ...CF_ENV, CLOUDFLARE_ACCOUNT_ID: 'nope' }), SITE_TAG, window)).rejects.toThrow('CLOUDFLARE_ACCOUNT_ID')
    expect(f.calls).toHaveLength(0)
  })
})
