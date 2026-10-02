import { readFileSync } from 'node:fs'
import { parseConfig } from '../src/config.ts'
import type { FetchContext, ScoutConfig } from '../src/types.ts'

/** 2026-09-29T12:00Z; the 26h lookback cutoff is 2026-09-28T10:00Z (epoch 1790589600). */
export const NOW = new Date('2026-09-29T12:00:00Z')

export function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
}

/** The real config.json, so tests also prove the shipped file is valid. */
export function shippedConfig(): ScoutConfig {
  return parseConfig(JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8')))
}

export function configWith(patch: (c: ScoutConfig) => void): ScoutConfig {
  const config = shippedConfig()
  patch(config)
  return config
}

/** Credentials and a filled-in user agent: what the reddit source needs before it makes any request. */
export const REDDIT_ENV = { REDDIT_CLIENT_ID: 'id', REDDIT_CLIENT_SECRET: 'secret' }
export const TEST_USER_AGENT = 'test:greenlight-scout:0.1.0 (by /u/tester)'

export interface Call {
  url: string
  init: RequestInit | undefined
}

type Handler = (url: URL, init?: RequestInit) => Response | undefined | Promise<Response | undefined>

/** A fetch that answers from `handler` (404 when it returns undefined) and records every call. */
export function fakeFetch(handler: Handler): typeof fetch & { calls: Call[] } {
  const calls: Call[] = []
  const fn = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    calls.push({ url: url.toString(), init })
    return (await handler(url, init)) ?? new Response('not found', { status: 404 })
  }
  return Object.assign(fn as typeof fetch, { calls })
}

export const json = (body: string | object, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

export const xml = (body: string) => new Response(body, { headers: { 'content-type': 'application/xml' } })

/** Serves each fixture where the real API would answer. */
export function fixtureRoutes(url: URL): Response | undefined {
  if (url.hostname === 'hn.algolia.com' && url.pathname.startsWith('/api/v1/items/')) {
    return url.pathname.endsWith('/45100002') ? json(fixture('hn-item.json')) : undefined
  }
  if (url.hostname === 'hn.algolia.com') {
    return json(fixture(url.searchParams.get('tags') === 'ask_hn' ? 'hn-ask.json' : 'hn-stories.json'))
  }
  if (url.hostname === 'www.reddit.com' && url.pathname === '/api/v1/access_token') {
    return json({ access_token: 'tok', token_type: 'bearer', expires_in: 86400 })
  }
  if (url.hostname === 'oauth.reddit.com' && url.pathname.endsWith('/top')) return json(fixture('reddit-smallbusiness.json'))
  if (url.hostname === 'api.github.com') return json(fixture('github-search.json'))
  if (url.hostname === 'api.stackexchange.com') return json(fixture('stackexchange-softwarerecs.json'))
  if (url.hostname === 'www.producthunt.com' && url.pathname === '/feed') return xml(fixture('producthunt-feed.xml'))
  if (url.hostname === 'lobste.rs') return xml(fixture('rss-lobsters.xml'))
  // One forum of the shipped config answers; the others are skipped as failing, which the source tolerates.
  if (url.hostname === 'forum.obsidian.md' || url.hostname === 'forum.example') {
    if (url.pathname === '/latest.json') return json(fixture('discourse-latest.json'))
    if (/^\/t\/50[12]\.json$/.test(url.pathname)) return json(fixture('discourse-topic.json'))
  }
  return undefined
}

export function makeCtx(
  fetchImpl: typeof fetch,
  options: { env?: Record<string, string>; config?: ScoutConfig } = {},
): FetchContext & { logs: string[] } {
  const logs: string[] = []
  return {
    fetch: fetchImpl,
    now: NOW,
    config: options.config ?? shippedConfig(),
    env: options.env ?? {},
    sleep: async () => {},
    log: (message) => logs.push(message),
    logs,
  }
}

export function header(call: Call | undefined, name: string): string | null {
  return new Headers(call?.init?.headers).get(name)
}
