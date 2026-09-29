import { describe, expect, it } from 'vitest'
import { painScore, rankSignals, sourcePercentiles } from '../src/rank.ts'
import type { Signal, SourceName } from '../src/types.ts'

let seq = 0
function signal(source: SourceName, patch: Partial<Signal> = {}): Signal {
  seq += 1
  const url = `https://${source}.example/${seq}`
  return {
    id: `${source}:${seq}`,
    source,
    channel: 'c',
    url,
    link: url,
    title: `title ${seq}`,
    text: '',
    score: 0,
    comments: 0,
    createdAt: '2026-09-29T00:00:00.000Z',
    ...patch,
  }
}

const options = { limit: 10, maxSharePerSource: 1, maxTextLength: 600, painPhrases: ['is there a tool', 'manually', 'tired of'] }

describe('painScore', () => {
  it('counts distinct phrases across title and text, case-insensitively', () => {
    expect(painScore({ title: 'Is there a TOOL for this?', text: "I'm tired of doing it manually. Manually!" }, options.painPhrases)).toBe(3)
    expect(painScore({ title: 'Show HN: my app', text: '' }, options.painPhrases)).toBe(0)
  })
})

describe('sourcePercentiles', () => {
  it('ranks engagement within each source separately and gives ties the mid rank', () => {
    const low = signal('hn', { score: 10 })
    const high = signal('hn', { score: 500 })
    const tieA = signal('rss')
    const tieB = signal('rss')
    const alone = signal('github', { score: 5 })
    const pct = sourcePercentiles([low, high, tieA, tieB, alone])
    expect(pct.get(low.id)).toBe(0)
    expect(pct.get(high.id)).toBe(1)
    expect(pct.get(tieA.id)).toBe(0.5)
    expect(pct.get(tieB.id)).toBe(0.5)
    expect(pct.get(alone.id)).toBe(0.5)
  })

  it('counts comments double', () => {
    const votes = signal('reddit', { score: 30, comments: 0 })
    const talk = signal('reddit', { score: 10, comments: 11 })
    const pct = sourcePercentiles([votes, talk])
    expect(pct.get(talk.id)).toBe(1)
  })
})

describe('rankSignals', () => {
  it('puts pain above raw popularity when engagement is equal', () => {
    const popular = signal('reddit', { score: 100, title: 'Look at my dashboard' })
    const painful = signal('reddit', { score: 100, title: "I'm tired of doing invoices manually. Is there a tool?" })
    const ranked = rankSignals([popular, painful], options)
    expect(ranked.map((s) => s.id)).toEqual([painful.id, popular.id])
    expect(ranked[0]).toMatchObject({ painScore: 3, rank: 0.7, alsoSeenIn: [] }) // 0.6 * 0.5 + 0.4
    expect(ranked[1]).toMatchObject({ painScore: 0, rank: 0.3 })
  })

  it('still lets a far more discussed post beat a mildly painful one', () => {
    const hot = signal('hn', { score: 900, comments: 300 })
    const mild = signal('hn', { score: 20, text: 'I do this manually' })
    const ranked = rankSignals([hot, mild], options)
    expect(ranked.map((s) => s.id)).toEqual([hot.id, mild.id]) // 0.6 vs 0.133
  })

  it('merges the same link across sources and boosts it', () => {
    const onHn = signal('hn', { score: 200, link: 'https://example.com/tool' })
    const onReddit = signal('reddit', { score: 50, link: 'https://example.com/tool' })
    const other = signal('hn', { score: 100 })
    const ranked = rankSignals([onHn, onReddit, other], options)
    expect(ranked).toHaveLength(2)
    const merged = ranked.find((s) => s.link === 'https://example.com/tool')
    expect(merged?.alsoSeenIn).toEqual([onReddit.url])
    expect(merged?.rank).toBe(0.7) // 0.6 (top of HN) + 0.1 cross-source bonus
  })

  it('caps each source, then fills leftover slots from the overflow', () => {
    const hnSignals = Array.from({ length: 8 }, (_, i) => signal('hn', { score: 100 + i }))
    const rssSignals = Array.from({ length: 2 }, () => signal('rss'))
    const ranked = rankSignals([...hnSignals, ...rssSignals], { ...options, limit: 6, maxSharePerSource: 0.5 })
    expect(ranked).toHaveLength(6)
    expect(ranked.filter((s) => s.source === 'rss')).toHaveLength(2)
    expect(ranked.filter((s) => s.source === 'hn')).toHaveLength(4) // 3 by cap + 1 overflow fill
  })

  it('truncates text for the export', () => {
    const long = signal('hn', { text: 'x'.repeat(1000) })
    const [ranked] = rankSignals([long], { ...options, maxTextLength: 100 })
    expect(ranked?.text).toHaveLength(100)
  })

  it('returns nothing for no input', () => {
    expect(rankSignals([], options)).toEqual([])
  })
})
