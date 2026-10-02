import { describe, expect, it } from 'vitest'
import { discourse } from '../src/sources/discourse.ts'
import { github } from '../src/sources/github.ts'
import { hn } from '../src/sources/hn.ts'
import { producthunt } from '../src/sources/producthunt.ts'
import { reddit } from '../src/sources/reddit.ts'
import { rss } from '../src/sources/rss.ts'
import { stackexchange } from '../src/sources/stackexchange.ts'
import {
  NOW,
  configWith,
  fakeFetch,
  fixture,
  fixtureRoutes,
  header,
  json,
  makeCtx,
  REDDIT_ENV,
  TEST_USER_AGENT,
  xml,
} from './helpers.ts'

const CUTOFF_EPOCH = 1790589600 // NOW - 26h

describe('hn', () => {
  const storiesOnly = configWith((c) => {
    c.hn.comments.enabled = false
  })

  it('merges the story and Ask HN queries and skips untitled hits', async () => {
    const f = fakeFetch(fixtureRoutes)
    const signals = await hn.fetch(makeCtx(f, { config: storiesOnly }))

    expect(signals.map((s) => s.id).sort()).toEqual(['hn:45100001', 'hn:45100002', 'hn:45100004'])
    const [stories, asks] = f.calls.map((c) => new URL(c.url).searchParams)
    expect(stories?.get('numericFilters')).toBe(`created_at_i>${CUTOFF_EPOCH},points>=50`)
    expect(asks?.get('tags')).toBe('ask_hn')
    expect(asks?.get('numericFilters')).toBe(`created_at_i>${CUTOFF_EPOCH},points>=10`)
  })

  it('pages through Algolia results when a long window has more than one page', async () => {
    const stories = JSON.parse(fixture('hn-stories.json'))
    const f = fakeFetch((url) => {
      if (url.searchParams.get('tags') === 'ask_hn') return json({ hits: [], nbPages: 0 })
      const page = Number(url.searchParams.get('page'))
      return json({ hits: page === 0 ? stories.hits : [{ ...stories.hits[0], objectID: '45100099' }], nbPages: 2 })
    })
    const signals = await hn.fetch(makeCtx(f, { config: storiesOnly }))

    const storyPages = f.calls.filter((c) => new URL(c.url).searchParams.get('tags') === 'story')
    expect(storyPages.map((c) => new URL(c.url).searchParams.get('page'))).toEqual(['0', '1'])
    expect(signals.map((s) => s.id)).toContain('hn:45100099')
  })

  it('normalises link posts and self posts', async () => {
    const signals = await hn.fetch(makeCtx(fakeFetch(fixtureRoutes), { config: storiesOnly }))
    expect(signals.find((s) => s.id === 'hn:45100001')).toEqual({
      id: 'hn:45100001',
      source: 'hn',
      channel: 'show_hn',
      url: 'https://news.ycombinator.com/item?id=45100001',
      link: 'https://example.com/invoices',
      title: 'Show HN: I built a tiny invoice generator for freelancers',
      text: '',
      score: 212,
      comments: 87,
      createdAt: '2026-09-29T08:15:00.000Z',
    })
    const ask = signals.find((s) => s.id === 'hn:45100002')
    expect(ask?.channel).toBe('ask_hn')
    expect(ask?.link).toBe(ask?.url)
    expect(ask?.text).toBe("I'm tired of keeping glossaries in a spreadsheet & emailing them around.\nIs there a tool that does this?")
  })

  it('turns the most-replied top-level comments of busy Ask HN threads into signals', async () => {
    const f = fakeFetch(fixtureRoutes)
    const signals = await hn.fetch(makeCtx(f))
    const comments = signals.filter((s) => s.channel === 'ask_hn_comment')

    // Most replies first; "+1" (too short) and the deleted comment are skipped.
    expect(comments.map((s) => s.id)).toEqual(['hn:45100101', 'hn:45100102', 'hn:45100105'])
    expect(comments[0]).toEqual({
      id: 'hn:45100101',
      source: 'hn',
      channel: 'ask_hn_comment',
      url: 'https://news.ycombinator.com/item?id=45100101',
      link: 'https://news.ycombinator.com/item?id=45100101',
      title: 'Ask HN reply',
      text: "Same here. I gave up on the CAT tool's termbase and keep a spreadsheet per client, but I still paste terms manually into every job.",
      score: 0,
      comments: 3,
      createdAt: '2026-09-29T06:30:00.000Z',
      context: 'Ask HN: How do you handle client glossaries as a translator?',
    })

    const threadQuery = f.calls.map((c) => new URL(c.url)).find((u) => u.searchParams.get('numericFilters')?.includes('num_comments'))
    expect(threadQuery?.searchParams.get('numericFilters')).toBe(`created_at_i>${NOW.getTime() / 1000 - 3 * 86_400},num_comments>=20`)
    // The 9-comment thread in the fixture is below minComments, so only one thread is opened.
    expect(f.calls.filter((c) => c.url.includes('/api/v1/items/')).map((c) => c.url)).toEqual(['https://hn.algolia.com/api/v1/items/45100002'])
  })

  it('caps comments per thread and keeps the stories when comments fail', async () => {
    const two = configWith((c) => {
      c.hn.comments.perThread = 2
    })
    const capped = await hn.fetch(makeCtx(fakeFetch(fixtureRoutes), { config: two }))
    expect(capped.filter((s) => s.channel === 'ask_hn_comment')).toHaveLength(2)

    const broken = fakeFetch((url) => (url.pathname.startsWith('/api/v1/items/') ? json({ error: 'boom' }, 500) : fixtureRoutes(url)))
    const ctx = makeCtx(broken)
    const signals = await hn.fetch(ctx)
    expect(signals.map((s) => s.id).sort()).toEqual(['hn:45100001', 'hn:45100002', 'hn:45100004'])
    expect(ctx.logs.some((l) => l.startsWith('hn: skipped comments of 45100002: HTTP 500'))).toBe(true)
  })
})

describe('reddit', () => {
  const oneSub = configWith((c) => {
    c.userAgent = TEST_USER_AGENT
    c.reddit.subreddits = ['smallbusiness']
  })

  it('keeps recent, non-stickied, SFW posts above minScore', async () => {
    const signals = await reddit.fetch(makeCtx(fakeFetch(fixtureRoutes), { config: oneSub, env: REDDIT_ENV }))

    expect(signals.map((s) => s.id)).toEqual(['reddit:1ab001', 'reddit:1ab002'])
    expect(signals[0]).toMatchObject({
      channel: 'smallbusiness',
      url: 'https://www.reddit.com/r/smallbusiness/comments/1ab001/is_there_an_app_that_reminds_customers/',
      score: 340,
      comments: 122,
    })
    expect(signals[0]?.link).toBe(signals[0]?.url)
    expect(signals[1]?.link).toBe('https://example.com/invoices')
  })

  it('uses application-only OAuth against oauth.reddit.com', async () => {
    const f = fakeFetch(fixtureRoutes)
    await reddit.fetch(makeCtx(f, { config: oneSub, env: REDDIT_ENV }))

    expect(f.calls[0]?.init?.method).toBe('POST')
    expect(header(f.calls[0], 'authorization')).toBe(`Basic ${Buffer.from('id:secret').toString('base64')}`)
    expect(f.calls[1]?.url).toBe('https://oauth.reddit.com/r/smallbusiness/top?t=day&limit=50&raw_json=1')
    expect(header(f.calls[1], 'authorization')).toBe('bearer tok')
    expect(header(f.calls[1], 'user-agent')).toBe(TEST_USER_AGENT)
  })

  it('is skipped, not failed, without credentials, and makes no requests', async () => {
    const f = fakeFetch(fixtureRoutes)
    const ctx = makeCtx(f, { config: oneSub })
    expect(await reddit.fetch(ctx)).toEqual([])
    expect(f.calls).toHaveLength(0)
    expect(ctx.logs.join('\n')).toContain('reddit: skipped')
  })

  it('refuses to call Reddit while the user agent still says CHANGE_ME', async () => {
    const f = fakeFetch(fixtureRoutes)
    const placeholder = configWith((c) => void (c.userAgent = 'github-actions:greenlight-scout:0.1.0 (by /u/CHANGE_ME)'))
    await expect(reddit.fetch(makeCtx(f, { config: placeholder, env: REDDIT_ENV }))).rejects.toThrow('set your Reddit username')
    expect(f.calls).toHaveLength(0)
  })

  it('skips a failing subreddit but fails when all of them fail', async () => {
    const two = configWith((c) => {
      c.userAgent = TEST_USER_AGENT
      c.reddit.subreddits = ['smallbusiness', 'private_sub']
    })
    const partial = fakeFetch((url) => (url.pathname.startsWith('/r/private_sub') ? json({ reason: 'private' }, 403) : fixtureRoutes(url)))
    const ctx = makeCtx(partial, { config: two, env: REDDIT_ENV })
    expect(await reddit.fetch(ctx)).toHaveLength(2)
    expect(ctx.logs.some((l) => l.includes('skipped r/private_sub: HTTP 403'))).toBe(true)

    const blocked = fakeFetch((url) => (url.hostname === 'oauth.reddit.com' ? new Response('blocked', { status: 403 }) : fixtureRoutes(url)))
    await expect(reddit.fetch(makeCtx(blocked, { config: two, env: REDDIT_ENV }))).rejects.toThrow('all subreddits failed')
  })
})

describe('github', () => {
  it('searches recent repos by stars and sends the token', async () => {
    const f = fakeFetch(fixtureRoutes)
    const signals = await github.fetch(makeCtx(f, { env: { GITHUB_TOKEN: 'ghs_test' } }))

    expect(new URL(f.calls[0]?.url ?? '').searchParams.get('q')).toBe('created:>=2026-09-22 stars:>=100')
    expect(header(f.calls[0], 'authorization')).toBe('Bearer ghs_test')
    expect(signals[0]).toEqual({
      id: 'github:880001',
      source: 'github',
      channel: 'TypeScript',
      url: 'https://github.com/someone/receipt-ocr',
      link: 'https://github.com/someone/receipt-ocr',
      title: 'someone/receipt-ocr',
      text: 'Turn receipt photos into a spreadsheet — runs locally\nTopics: ocr, receipts, spreadsheet',
      score: 1450,
      comments: 0,
      createdAt: '2026-09-25T10:00:00.000Z',
    })
    expect(signals[1]).toMatchObject({ channel: 'unknown', text: '' })
  })
})

describe('producthunt', () => {
  it('uses the GraphQL API when PRODUCTHUNT_TOKEN is set', async () => {
    const f = fakeFetch((url) => (url.hostname === 'api.producthunt.com' ? json(fixture('producthunt-api.json')) : undefined))
    const signals = await producthunt.fetch(makeCtx(f, { env: { PRODUCTHUNT_TOKEN: 'ph' } }))

    const body = JSON.parse(String(f.calls[0]?.init?.body)) as { variables: { postedAfter: string; first: number } }
    expect(body.variables).toEqual({ postedAfter: '2026-09-28T10:00:00.000Z', first: 30 })
    expect(header(f.calls[0], 'authorization')).toBe('Bearer ph')
    expect(signals[0]).toEqual({
      id: 'producthunt:700001',
      source: 'producthunt',
      channel: 'Productivity',
      url: 'https://producthunt.com/posts/shiftswap',
      link: 'https://producthunt.com/r/ABCDEF',
      title: 'ShiftSwap',
      text: 'Let hourly staff swap shifts without a group chat\nBuilt for small restaurants.\nTopics: Productivity, SaaS',
      score: 410,
      comments: 37,
      createdAt: '2026-09-29T07:01:00.000Z',
    })
    expect(signals[1]).toMatchObject({ channel: 'launch', link: 'https://producthunt.com/posts/quiet-launch' })
  })

  it('surfaces GraphQL errors', async () => {
    const f = fakeFetch(() => json({ errors: [{ message: 'invalid_oauth_token' }] }))
    await expect(producthunt.fetch(makeCtx(f, { env: { PRODUCTHUNT_TOKEN: 'bad' } }))).rejects.toThrow('invalid_oauth_token')
  })

  it('falls back to the Atom feed and drops old entries', async () => {
    const signals = await producthunt.fetch(makeCtx(fakeFetch(fixtureRoutes)))
    expect(signals).toHaveLength(1)
    expect(signals[0]).toMatchObject({
      id: 'producthunt:tag:www.producthunt.com,2005:Post/700001',
      channel: 'feed',
      url: 'https://producthunt.com/products/shiftswap',
      title: 'ShiftSwap',
      score: 0,
      createdAt: '2026-09-29T07:01:00.000Z',
    })
    expect(signals[0]?.text).toBe('Let hourly staff swap shifts without a group chat\nDiscussion\n|\nLink')
  })
})

describe('stackexchange', () => {
  const oneSite = configWith((c) => {
    c.stackexchange.sites = ['softwarerecs']
  })

  it('keeps open questions at or above minScore, with site-scoped ids', async () => {
    const signals = await stackexchange.fetch(makeCtx(fakeFetch(fixtureRoutes), { config: oneSite }))

    expect(signals.map((s) => s.id)).toEqual(['stackexchange:softwarerecs:91001', 'stackexchange:softwarerecs:91004'])
    const link = 'https://softwarerecs.stackexchange.com/questions/91001/tool-to-track-freelance-invoices-and-send-polite-reminders'
    expect(signals[0]).toEqual({
      id: 'stackexchange:softwarerecs:91001',
      source: 'stackexchange',
      channel: 'softwarerecs',
      url: link,
      link,
      title: 'Tool to track freelance invoices & send polite reminders',
      text:
        "I'm a freelancer with about 20 clients. I track invoices in a spreadsheet and chase late payments manually.\n" +
        'Is there a web app that does this for free?\nTags: web-apps, invoicing',
      score: 3,
      comments: 1,
      createdAt: '2026-09-29T02:46:40.000Z',
    })
  })

  it('asks for new questions in the lookback window, with the key when set', async () => {
    const f = fakeFetch(fixtureRoutes)
    await stackexchange.fetch(makeCtx(f, { config: oneSite }))
    const params = new URL(f.calls[0]?.url ?? '').searchParams
    expect(Object.fromEntries(params)).toEqual({
      site: 'softwarerecs',
      fromdate: String(CUTOFF_EPOCH),
      sort: 'creation',
      order: 'desc',
      page: '1',
      pagesize: '100',
      filter: 'withbody',
    })

    const keyed = fakeFetch(fixtureRoutes)
    await stackexchange.fetch(makeCtx(keyed, { config: oneSite, env: { STACKEXCHANGE_KEY: 'k3y' } }))
    expect(new URL(keyed.calls[0]?.url ?? '').searchParams.get('key')).toBe('k3y')
  })

  it('cuts the body, not the tags, when the text is too long', async () => {
    const short = configWith((c) => {
      c.stackexchange.sites = ['softwarerecs']
      c.maxTextLength = 100
    })
    const [first] = await stackexchange.fetch(makeCtx(fakeFetch(fixtureRoutes), { config: short }))
    expect(first?.text).toHaveLength(100)
    expect(first?.text).toMatch(/…\nTags: web-apps, invoicing$/)
  })

  it('pages through a long window until has_more is false', async () => {
    const page1 = JSON.parse(fixture('stackexchange-softwarerecs.json'))
    const page2 = { ...page1, has_more: false, items: [{ ...page1.items[0], question_id: 91005 }] }
    const f = fakeFetch((url) => json(url.searchParams.get('page') === '1' ? { ...page1, has_more: true } : page2))
    const signals = await stackexchange.fetch(makeCtx(f, { config: oneSite }))

    expect(f.calls.map((c) => new URL(c.url).searchParams.get('page'))).toEqual(['1', '2'])
    expect(signals.map((s) => s.id)).toContain('stackexchange:softwarerecs:91005')
  })

  it('waits out backoff, skips a failing site and fails when all of them fail', async () => {
    const two = configWith((c) => {
      c.stackexchange.sites = ['softwarerecs', 'webapps']
    })
    const throttled = json({ error_id: 502, error_message: 'too many requests from this IP', error_name: 'throttle_violation' }, 400)
    const withBackoff = { ...JSON.parse(fixture('stackexchange-softwarerecs.json')), backoff: 5, quota_remaining: 12 }
    const f = fakeFetch((url) => (url.searchParams.get('site') === 'webapps' ? throttled : json(withBackoff)))
    const ctx = makeCtx(f, { config: two })
    const sleeps: number[] = []
    ctx.sleep = async (ms) => void sleeps.push(ms)

    expect(await stackexchange.fetch(ctx)).toHaveLength(2)
    expect(sleeps).toEqual([5000])
    expect(ctx.logs.some((l) => l.includes('skipped webapps: HTTP 400') && l.includes('throttle_violation'))).toBe(true)
    expect(ctx.logs.some((l) => l.includes('only 12 requests left today'))).toBe(true)

    const down = fakeFetch(() => new Response('unavailable', { status: 400 }))
    await expect(stackexchange.fetch(makeCtx(down, { config: two }))).rejects.toThrow('all sites failed')
  })
})

describe('discourse', () => {
  const oneForum = configWith((c) => {
    c.discourse.forums = [{ name: 'garden', url: 'https://forum.example' }]
  })

  it('keeps new, listed, unpinned topics with the text of their opening post', async () => {
    const f = fakeFetch(fixtureRoutes)
    const signals = await discourse.fetch(makeCtx(f, { config: oneForum }))

    expect(signals.map((s) => s.id)).toEqual(['discourse:garden:501', 'discourse:garden:502'])
    const url = 'https://forum.example/t/tracking-which-plants-i-watered-when/501'
    expect(signals[0]).toEqual({
      id: 'discourse:garden:501',
      source: 'discourse',
      channel: 'garden',
      url,
      link: url,
      title: 'Tracking which plants I watered & when',
      text: "I keep a spreadsheet of when I watered each plant, and I'm tired of it.\nIs there a simple way to see which ones are overdue?",
      score: 6,
      comments: 3,
      createdAt: '2026-09-29T08:00:00.000Z',
    })
    // The listing is by creation date, and an older topic on the first page means there is no need for a second.
    expect(f.calls.map((c) => c.url)).toEqual([
      'https://forum.example/latest.json?order=created',
      'https://forum.example/t/501.json',
      'https://forum.example/t/502.json',
    ])
  })

  it('pages through a long window and stops at maxTopics', async () => {
    const latest = JSON.parse(fixture('discourse-latest.json'))
    const fresh = latest.topic_list.topics.filter((t: { id: number }) => t.id === 501)
    const page = (topics: unknown[], more: boolean) => ({ topic_list: { topics, ...(more ? { more_topics_url: '/latest?page=x' } : {}) } })
    const f = fakeFetch((url) => {
      if (url.pathname === '/latest.json') {
        const n = Number(url.searchParams.get('page') ?? 0)
        return json(page([{ ...fresh[0], id: 600 + n }], true))
      }
      return json(fixture('discourse-topic.json'))
    })
    const capped = configWith((c) => {
      c.discourse.forums = [{ name: 'garden', url: 'https://forum.example' }]
      c.discourse.maxTopics = 3
    })
    const ctx = makeCtx(f, { config: capped })
    const signals = await discourse.fetch(ctx)

    expect(signals.map((s) => s.id)).toEqual(['discourse:garden:600', 'discourse:garden:601', 'discourse:garden:602'])
    expect(ctx.logs).toContain('discourse: garden has more than 3 new topics; only the newest are kept')
  })

  it('keeps a topic whose opening post fails, skips a failing forum and fails when all of them fail', async () => {
    const two = configWith((c) => {
      c.discourse.forums = [
        { name: 'garden', url: 'https://forum.example' },
        { name: 'down', url: 'https://down.example' },
      ]
    })
    const f = fakeFetch((url) => {
      if (url.hostname === 'down.example') return new Response('bad gateway', { status: 502 })
      if (url.pathname === '/t/502.json') return new Response('gone', { status: 404 })
      return fixtureRoutes(url)
    })
    const ctx = makeCtx(f, { config: two })
    const signals = await discourse.fetch(ctx)

    expect(signals.map((s) => s.id)).toEqual(['discourse:garden:501', 'discourse:garden:502'])
    expect(signals[1]?.text).toBe('')
    expect(ctx.logs).toContain('discourse: garden: 1 topic(s) kept without their text')
    expect(ctx.logs.some((l) => l.startsWith('discourse: skipped down: HTTP 502'))).toBe(true)

    const down = fakeFetch(() => new Response('unavailable', { status: 503 }))
    await expect(discourse.fetch(makeCtx(down, { config: two }))).rejects.toThrow('all forums failed')
  })
})

describe('rss', () => {
  it('maps feed items and drops ones outside the lookback window', async () => {
    const signals = await rss.fetch(makeCtx(fakeFetch(fixtureRoutes)))
    expect(signals).toEqual([
      {
        id: 'rss:https://lobste.rs/s/abc123',
        source: 'rss',
        channel: 'Lobsters Ask',
        url: 'https://lobste.rs/s/abc123/how_do_you_manage_dotfiles',
        link: 'https://lobste.rs/s/abc123/how_do_you_manage_dotfiles',
        title: 'How do you manage dotfiles across work & personal machines?',
        text: 'I keep a git repo but syncing secrets is a pain in the neck.',
        score: 0,
        comments: 14,
        createdAt: '2026-09-29T07:12:00.000Z',
      },
    ])
  })

  it('tolerates one broken feed, not all of them', async () => {
    const config = configWith((c) => {
      c.rss.feeds = [
        { name: 'Lobsters Ask', url: 'https://lobste.rs/t/ask.rss' },
        { name: 'Behind a bot wall', url: 'https://walled.example/feed' },
      ]
    })
    const f = fakeFetch((url) => (url.hostname === 'walled.example' ? xml('<html>Just a moment...</html>') : fixtureRoutes(url)))
    const ctx = makeCtx(f, { config })
    expect(await rss.fetch(ctx)).toHaveLength(1)
    expect(ctx.logs).toEqual(['rss: skipped Behind a bot wall: not an RSS or Atom document'])

    const broken = fakeFetch(() => undefined)
    await expect(rss.fetch(makeCtx(broken, { config }))).rejects.toThrow('all feeds failed')
  })
})
