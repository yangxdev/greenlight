import type { FetchContext } from './types.ts'

export class HttpError extends Error {
  readonly status: number
  readonly url: string

  constructor(status: number, url: string, detail: string) {
    super(`HTTP ${status} from ${url}${detail ? `: ${detail}` : ''}`)
    this.status = status
    this.url = url
  }
}

const TIMEOUT_MS = 20_000
const RETRYABLE = new Set([429, 500, 502, 503, 504])

/** GET/POST with a timeout, the configured User-Agent, and one retry on 429/5xx. */
export async function request(ctx: FetchContext, url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (!headers.has('user-agent')) headers.set('user-agent', ctx.config.userAgent)
  for (let attempt = 1; ; attempt++) {
    const res = await ctx.fetch(url, { ...init, headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (res.ok) return res
    if (attempt < 2 && RETRYABLE.has(res.status)) {
      const retryAfter = Number(res.headers.get('retry-after'))
      await ctx.sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : 3000)
      continue
    }
    const body = (await res.text().catch(() => '')).slice(0, 200).replace(/\s+/g, ' ').trim()
    throw new HttpError(res.status, url, body)
  }
}

export async function getJson<T>(ctx: FetchContext, url: string, init?: RequestInit): Promise<T> {
  const res = await request(ctx, url, init)
  return (await res.json()) as T
}

export async function getText(ctx: FetchContext, url: string, init?: RequestInit): Promise<string> {
  const res = await request(ctx, url, init)
  return res.text()
}
