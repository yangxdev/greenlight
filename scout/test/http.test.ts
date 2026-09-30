import { describe, expect, it } from 'vitest'
import { getJson, HttpError } from '../src/http.ts'
import { fakeFetch, header, json, makeCtx } from './helpers.ts'

describe('http', () => {
  it('sets the configured User-Agent', async () => {
    const f = fakeFetch(() => json({ ok: true }))
    await getJson(makeCtx(f), 'https://example.com/a')
    expect(header(f.calls[0], 'user-agent')).toBe('github-actions:greenlight-scout:0.1.0 (by /u/CHANGE_ME)')
  })

  it('retries once on 429, honouring Retry-After', async () => {
    let n = 0
    const f = fakeFetch(() => (++n === 1 ? new Response('slow down', { status: 429, headers: { 'retry-after': '2' } }) : json({ n })))
    const ctx = makeCtx(f)
    const slept: number[] = []
    ctx.sleep = async (ms) => {
      slept.push(ms)
    }
    expect(await getJson(ctx, 'https://example.com/a')).toEqual({ n: 2 })
    expect(slept).toEqual([2000])
  })

  it('throws HttpError with status and a snippet of the body', async () => {
    const f = fakeFetch(() => new Response('<html>Forbidden by policy</html>', { status: 403 }))
    const error = await getJson(makeCtx(f), 'https://example.com/a').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(HttpError)
    expect((error as HttpError).status).toBe(403)
    expect((error as HttpError).message).toBe('HTTP 403 from https://example.com/a: <html>Forbidden by policy</html>')
    expect(f.calls).toHaveLength(1)
  })
})
