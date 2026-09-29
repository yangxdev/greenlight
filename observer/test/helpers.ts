import type { Ctx } from '../src/types.ts'

/** Monday 2026-10-05 04:47 UTC: reports on 2026-W40 (Mon 2026-09-28 .. Sun 2026-10-04). */
export const NOW = new Date('2026-10-05T04:47:00Z')

export const ACCOUNT = 'a'.repeat(32)
export const SITE_TAG = 'b'.repeat(32)

export interface Call {
  url: string
  init: RequestInit | undefined
}

type Handler = (url: URL, init?: RequestInit) => Response | undefined | Promise<Response | undefined>

export function fakeFetch(handler: Handler): typeof fetch & { calls: Call[] } {
  const calls: Call[] = []
  const fn = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    calls.push({ url: url.toString(), init })
    return (await handler(url, init)) ?? new Response('not found', { status: 404 })
  }
  return Object.assign(fn as typeof fetch, { calls })
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

export function makeCtx(fetchImpl: typeof fetch, env: Record<string, string> = {}): Ctx & { logs: string[] } {
  const logs: string[] = []
  return { fetch: fetchImpl, env, now: NOW, log: (m) => logs.push(m), logs }
}

/** A small greenlight + product world: one live product (#7) with repo and URL markers, one stuck idea. */
export function world(options: { healthy?: boolean } = {}): (url: URL, init?: RequestInit) => Response | undefined {
  const healthy = options.healthy ?? true
  return (url) => {
    if (url.hostname === 'api.github.com') {
      if (url.pathname === '/repos/me/greenlight/issues') {
        if (url.searchParams.get('labels') === 'live') {
          return json([{ number: 7, title: '[idea] Invoice Nudge', state: 'open', labels: [{ name: 'live' }], created_at: '2026-09-01T00:00:00Z' }])
        }
        return json([
          { number: 7, title: '[idea] Invoice Nudge', state: 'open', labels: [{ name: 'live' }], created_at: '2026-09-01T00:00:00Z' },
          { number: 9, title: '[idea] Shift Swap', state: 'open', labels: [{ name: 'stuck' }], created_at: '2026-09-29T10:00:00Z' },
          { number: 10, title: '[idea] Old thing', state: 'closed', labels: [{ name: 'archived' }], created_at: '2026-08-01T00:00:00Z' },
          { number: 11, title: 'Greenlight weekly reports', state: 'open', labels: [], created_at: '2026-09-30T00:00:00Z' },
          { number: 12, title: 'Some PR', state: 'open', labels: [], created_at: '2026-09-30T00:00:00Z', pull_request: {} },
        ])
      }
      if (url.pathname === '/repos/me/greenlight/issues/7/comments') {
        return json([
          { body: '📐 **Architect:** blueprint ready\n\n<!-- greenlight:repo=me/invoice-nudge -->', created_at: '2026-09-02T00:00:00Z' },
          { body: '🚀 **Publisher:** live at https://invoice-nudge.pages.dev\n<!-- greenlight:url=https://invoice-nudge.pages.dev -->', created_at: '2026-09-10T12:00:00Z' },
        ])
      }
      if (url.pathname === '/repos/me/invoice-nudge/contents/blueprint.md') {
        return new Response('# Invoice Nudge\n\n## Success metric\n\n50 visits/week and 5 reminders sent.\n\n## Setup notes\n\nNone')
      }
      return undefined
    }
    if (url.hostname === 'invoice-nudge.pages.dev') {
      if (url.pathname === '/api/health') return healthy ? json({ ok: true }) : new Response('boom', { status: 502 })
      if (url.pathname === '/') return new Response('<html></html>', { status: healthy ? 200 : 502 })
    }
    if (url.hostname === 'api.cloudflare.com') {
      if (url.pathname.endsWith('/rum/site_info/list')) {
        return json({ success: true, result: [{ site_tag: SITE_TAG, host: 'invoice-nudge.pages.dev', ruleset: null }] })
      }
      if (url.pathname.endsWith('/graphql')) {
        return json({
          data: {
            viewer: {
              accounts: [
                {
                  rumPageloadEventsAdaptiveGroups: [
                    { count: 30, sum: { visits: 20 }, dimensions: { date: '2026-09-22' } },
                    { count: 50, sum: { visits: 40 }, dimensions: { date: '2026-09-29' } },
                    { count: 10, sum: { visits: 5 }, dimensions: { date: '2026-10-04' } },
                  ],
                },
              ],
            },
          },
          errors: null,
        })
      }
    }
    return undefined
  }
}
