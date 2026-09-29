import { describe, expect, it } from 'vitest'
import { ghFile, ghList, nextLink } from '../src/github.ts'
import { discoverProducts, parseProductComments } from '../src/products.ts'
import { fakeFetch, json, makeCtx, world } from './helpers.ts'

describe('nextLink', () => {
  it('finds rel="next" among other relations', () => {
    const header = '<https://api.github.com/x?page=1>; rel="prev", <https://api.github.com/x?page=3>; rel="next", <https://api.github.com/x?page=9>; rel="last"'
    expect(nextLink(header)).toBe('https://api.github.com/x?page=3')
    expect(nextLink('<https://api.github.com/x?page=1>; rel="prev"')).toBeNull()
    expect(nextLink(null)).toBeNull()
  })
})

describe('ghList', () => {
  it('follows pagination and sends the token', async () => {
    const f = fakeFetch((url) =>
      url.searchParams.get('page') === '2'
        ? json([{ n: 2 }])
        : json([{ n: 1 }], 200, { link: '<https://api.github.com/repos/me/r/issues?per_page=100&page=2>; rel="next"' }),
    )
    const items = await ghList<{ n: number }>(makeCtx(f, { GITHUB_TOKEN: 'tok' }), '/repos/me/r/issues')
    expect(items).toEqual([{ n: 1 }, { n: 2 }])
    expect(f.calls[0]?.url).toBe('https://api.github.com/repos/me/r/issues?per_page=100')
    expect(new Headers(f.calls[0]?.init?.headers).get('authorization')).toBe('Bearer tok')
  })

  it('throws on errors', async () => {
    await expect(ghList(makeCtx(fakeFetch(() => json({}, 401))), '/x')).rejects.toThrow('GitHub 401 for /x')
  })
})

describe('ghFile', () => {
  it('returns raw text, or null when missing or forbidden', async () => {
    const f = fakeFetch((url) => (url.pathname.endsWith('/a.md') ? new Response('# A') : json({}, 404)))
    const ctx = makeCtx(f)
    expect(await ghFile(ctx, 'me/r', 'a.md')).toBe('# A')
    expect(new Headers(f.calls[0]?.init?.headers).get('accept')).toBe('application/vnd.github.raw+json')
    expect(await ghFile(ctx, 'me/r', 'missing.md')).toBeNull()
  })
})

describe('parseProductComments', () => {
  it('reads the Architect repo marker and the Publisher URL marker', () => {
    expect(
      parseProductComments([
        { body: 'blueprint <!-- greenlight:repo=me/app -->', created_at: '2026-09-01T00:00:00Z' },
        { body: 'Publisher live <!-- greenlight:url=https://app.pages.dev/ -->', created_at: '2026-09-02T00:00:00Z' },
        { body: 'Publisher redeploy <!-- greenlight:url=https://app.pages.dev -->', created_at: '2026-09-05T00:00:00Z' },
      ]),
    ).toEqual({ repo: 'me/app', url: 'https://app.pages.dev', liveSince: '2026-09-02T00:00:00Z' })
  })

  it('falls back to a pages.dev link in a Publisher comment, and ignores other links', () => {
    expect(
      parseProductComments([
        { body: 'look at https://other.pages.dev', created_at: '2026-09-01T00:00:00Z' },
        { body: '🚀 **Publisher:** live at https://app-x1.pages.dev (smoke test passed)', created_at: '2026-09-03T00:00:00Z' },
        { body: null, created_at: '2026-09-04T00:00:00Z' },
      ]),
    ).toEqual({ repo: null, url: 'https://app-x1.pages.dev', liveSince: '2026-09-03T00:00:00Z' })
  })
})

describe('discoverProducts', () => {
  it('returns open live issues with their markers', async () => {
    const products = await discoverProducts(makeCtx(fakeFetch(world())), 'me/greenlight')
    expect(products).toEqual([
      {
        issue: 7,
        title: '[idea] Invoice Nudge',
        repo: 'me/invoice-nudge',
        url: 'https://invoice-nudge.pages.dev',
        liveSince: '2026-09-10T12:00:00Z',
      },
    ])
  })
})
