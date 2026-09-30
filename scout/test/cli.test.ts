import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { main, type Deps } from '../src/cli.ts'
import type { RankedSignal } from '../src/rank.ts'
import { readJsonl, type Store } from '../src/store.ts'
import type { Signal } from '../src/types.ts'
import { configWith, fakeFetch, fixtureRoutes, NOW, REDDIT_ENV, TEST_USER_AGENT } from './helpers.ts'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'scout-cli-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

/** In-memory Store standing in for MongoDB. */
function memoryStore() {
  const rows = new Map<string, Signal>()
  const opened: string[] = []
  let closed = 0
  const store: Store = {
    async upsert(signals) {
      let inserted = 0
      for (const s of signals) {
        if (!rows.has(s.id)) inserted += 1
        rows.set(s.id, s)
      }
      return { inserted, updated: signals.length - inserted }
    },
    async since(date) {
      return [...rows.values()].filter((s) => new Date(s.createdAt) >= date)
    },
    async close() {
      closed += 1
    },
  }
  return {
    rows,
    opened,
    closedCount: () => closed,
    open: async (uri: string, dbName: string) => {
      opened.push(`${uri}#${dbName}`)
      return store
    },
  }
}

/** The shipped config with Reddit switched on and a test user agent, so every source runs. */
async function redditReadyConfig(): Promise<string> {
  const path = join(dir, 'config.json')
  const config = configWith((c) => {
    c.userAgent = TEST_USER_AGENT
    c.reddit.enabled = true
  })
  await writeFile(path, JSON.stringify(config))
  return path
}

function deps(patch: Partial<Deps> = {}): Deps & { logs: string[] } {
  const logs: string[] = []
  return {
    fetch: fakeFetch(fixtureRoutes),
    env: {},
    now: () => NOW,
    sleep: async () => {},
    log: (m) => logs.push(m),
    openStore: memoryStore().open,
    ...patch,
    logs,
  }
}

describe('scout fetch', () => {
  it('collects every enabled source into a JSONL file', async () => {
    const out = join(dir, 'signals.jsonl')
    const d = deps({ env: REDDIT_ENV })
    expect(await main(['fetch', '--out', out, '--config', await redditReadyConfig()], d)).toBe(0)

    const signals = await readJsonl<Signal>(out)
    const sources = new Set(signals.map((s) => s.source))
    expect([...sources].sort()).toEqual(['github', 'hn', 'producthunt', 'reddit', 'rss', 'stackexchange'])
    // Every subreddit returns the same fixture here; duplicates collapse by id.
    expect(signals.filter((s) => s.source === 'reddit')).toHaveLength(2)
    expect(new Set(signals.map((s) => s.id)).size).toBe(signals.length)
    expect(d.logs).toContain('hn: 3 signals')
  })

  it('upserts into the store when MONGODB_URI is set', async () => {
    const mem = memoryStore()
    const d = deps({ env: { MONGODB_URI: 'mongodb+srv://x', MONGODB_DB: 'gl' }, openStore: mem.open })
    expect(await main(['fetch', '--sources', 'hn,github'], d)).toBe(0)
    expect(mem.opened).toEqual(['mongodb+srv://x#gl'])
    expect(mem.rows.size).toBe(5)
    expect(mem.closedCount()).toBe(1)
    expect(d.logs.at(-1)).toBe('MongoDB: 5 new, 0 updated (5 fetched)')
  })

  it('widens the lookback window with --days', async () => {
    const f = fakeFetch(fixtureRoutes)
    const d = deps({ fetch: f })
    expect(await main(['fetch', '--out', join(dir, 'b.jsonl'), '--sources', 'hn', '--days', '30'], d)).toBe(0)
    const since = Number(new URL(f.calls[0]?.url ?? '').searchParams.get('numericFilters')?.match(/created_at_i>(\d+)/)?.[1])
    expect(since).toBe(NOW.getTime() / 1000 - 30 * 86_400)
    expect(d.logs[0]).toBe('looking back 30 days instead of 26 hours')
    expect(await main(['fetch', '--out', join(dir, 'b.jsonl'), '--days', '0'], d)).toBe(2)
  })

  it('exits 0 when some sources fail and 1 when all fail', async () => {
    const out = join(dir, 's.jsonl')
    const partial = deps({ fetch: fakeFetch((url) => (url.hostname === 'api.github.com' ? undefined : fixtureRoutes(url))) })
    expect(await main(['fetch', '--out', out, '--sources', 'hn,github'], partial)).toBe(0)
    expect(partial.logs.some((l) => l.startsWith('github: FAILED (HTTP 404'))).toBe(true)

    const none = deps({ fetch: fakeFetch(() => undefined), env: { GITHUB_ACTIONS: 'true' } })
    expect(await main(['fetch', '--out', out, '--sources', 'hn,github'], none)).toBe(1)
    expect(none.logs.some((l) => l.startsWith('::warning title=Scout source hn failed::'))).toBe(true)
  })

  it('writes a GitHub step summary when running in Actions', async () => {
    const summary = join(dir, 'summary.md')
    await main(['fetch', '--out', join(dir, 's.jsonl'), '--sources', 'hn'], deps({ env: { GITHUB_STEP_SUMMARY: summary } }))
    expect(await readFile(summary, 'utf8')).toContain('| hn | ✅ | 3 |')
  })

  it('refuses to run without a destination, and rejects unknown sources', async () => {
    const d = deps()
    expect(await main(['fetch'], d)).toBe(2)
    expect(d.logs[0]).toContain('set MONGODB_URI or pass --out')
    expect(await main(['fetch', '--out', 'x.jsonl', '--sources', 'twitter'], d)).toBe(2)
    expect(await main(['fetch', '--nope'], d)).toBe(2)
  })
})

describe('scout export', () => {
  it('ranks signals from a JSONL file for the Analyst', async () => {
    const raw = join(dir, 'signals.jsonl')
    const out = join(dir, 'analyst.jsonl')
    await main(['fetch', '--out', raw, '--config', await redditReadyConfig()], deps({ env: REDDIT_ENV }))
    const d = deps()
    expect(await main(['export', '--from', raw, '--out', out, '--limit', '5'], d)).toBe(0)

    const ranked = await readJsonl<RankedSignal>(out)
    expect(ranked).toHaveLength(5)
    expect(ranked.map((s) => s.rank)).toEqual([...ranked.map((s) => s.rank)].sort((a, b) => b - a))
    expect(ranked.every((s) => typeof s.painScore === 'number' && Array.isArray(s.alsoSeenIn))).toBe(true)
    // The invoice tool was posted on HN and Reddit; it should come out as one merged signal.
    const invoice = ranked.find((s) => s.link === 'https://example.com/invoices')
    expect(invoice?.alsoSeenIn).toHaveLength(1)
    expect(d.logs.at(-1)).toMatch(/^exported 5 of \d+ signals from the last 7 days/)
  })

  it('reads from the store when no --from is given', async () => {
    const mem = memoryStore()
    await main(['fetch', '--sources', 'hn'], deps({ env: { MONGODB_URI: 'mongodb://m' }, openStore: mem.open }))
    const out = join(dir, 'analyst.jsonl')
    expect(await main(['export', '--out', out], deps({ env: { MONGODB_URI: 'mongodb://m' }, openStore: mem.open }))).toBe(0)
    expect(await readJsonl(out)).toHaveLength(3)
  })

  it('validates its flags', async () => {
    const d = deps()
    expect(await main(['export'], d)).toBe(2)
    expect(await main(['export', '--out', 'x.jsonl'], d)).toBe(2) // no MONGODB_URI, no --from
    expect(await main(['export', '--out', 'x.jsonl', '--from', 'y.jsonl', '--days', '0'], d)).toBe(2)
  })
})

describe('usage', () => {
  it('prints usage for help and unknown commands', async () => {
    const d = deps()
    expect(await main([], d)).toBe(0)
    expect(await main(['crawl'], d)).toBe(2)
    expect(d.logs[0]).toContain('Usage:')
  })
})
