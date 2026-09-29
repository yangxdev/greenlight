import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseConfig } from '../src/config.ts'
import { main, type Deps } from '../src/cli.ts'
import type { ProbeStore } from '../src/store.ts'
import type { Metrics, ProbeResult } from '../src/types.ts'
import { NOW, fakeFetch, world } from './helpers.ts'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'observer-cli-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function deps(patch: Partial<Deps> = {}) {
  const logs: string[] = []
  const inserted: (ProbeResult & { issue: number })[] = []
  let closed = 0
  const store: ProbeStore = {
    async insert(results) {
      inserted.push(...results)
    },
    async uptime() {
      return { checks: 4, ok: 4 }
    },
    async close() {
      closed += 1
    },
  }
  const d: Deps = {
    fetch: fakeFetch(world()),
    env: { GREENLIGHT_REPO: 'me/greenlight' },
    now: () => NOW,
    log: (m) => logs.push(m),
    openStore: async () => store,
    ...patch,
  }
  return { d, logs, inserted, closedCount: () => closed }
}

describe('observer probe', () => {
  it('probes live products and stores results when MONGODB_URI is set', async () => {
    const t = deps({ env: { GREENLIGHT_REPO: 'me/greenlight', MONGODB_URI: 'mongodb://m' } })
    expect(await main(['probe'], t.d)).toBe(0)
    expect(t.inserted).toHaveLength(1)
    expect(t.inserted[0]).toMatchObject({ issue: 7, url: 'https://invoice-nudge.pages.dev', ok: true })
    expect(t.closedCount()).toBe(1)
    expect(t.logs[0]).toMatch(/^#7 https:\/\/invoice-nudge\.pages\.dev: up \d+ms$/)
  })

  it('still succeeds when a product is down or there is no database', async () => {
    const t = deps({ fetch: fakeFetch(world({ healthy: false })) })
    expect(await main(['probe'], t.d)).toBe(0)
    expect(t.logs[0]).toContain(': DOWN')
    expect(t.logs).toContain('MONGODB_URI not set: results were not stored.')
  })
})

describe('observer metrics', () => {
  it('writes metrics.json', async () => {
    const out = join(dir, 'metrics.json')
    const t = deps({ env: { GREENLIGHT_REPO: 'me/greenlight', MONGODB_URI: 'mongodb://m' } })
    expect(await main(['metrics', '--out', out], t.d)).toBe(0)
    const metrics = JSON.parse(await readFile(out, 'utf8')) as Metrics
    expect(metrics.week).toBe('2026-W40')
    expect(metrics.products[0]?.uptime).toEqual({ checks: 4, ok: 4, pct: 100, source: 'probes' })
    expect(t.logs[0]).toBe('2026-W40: 1 live product(s), 1 idea(s) filed, 1 stuck, 1 data note(s)')
  })

  it('validates arguments and the repo name', async () => {
    const t = deps({ env: {} })
    expect(await main(['metrics'], t.d)).toBe(2)
    expect(await main(['metrics', '--out', join(dir, 'm.json')], t.d)).toBe(2)
    expect(t.logs.at(-1)).toContain('set GREENLIGHT_REPO=owner/name')
    expect(await main(['nope'], t.d)).toBe(2)
    expect(await main([], t.d)).toBe(0)
  })
})

describe('config', () => {
  it('ships a valid config.json and rejects bad site tags', async () => {
    const shipped = JSON.parse(await readFile(new URL('../config.json', import.meta.url), 'utf8')) as unknown
    expect(parseConfig(shipped)).toEqual({ siteTags: {}, probeTimeoutMs: 15000, probeRetentionDays: 35 })
    expect(() => parseConfig({ siteTags: { 'a.pages.dev': 'short' } })).toThrow('must be a 32-character hex site tag')
  })
})
