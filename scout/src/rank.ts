import { truncate } from './text.ts'
import type { Signal, SourceName } from './types.ts'

/** Export record for the Analyst: a Signal plus how it was ranked. */
export interface RankedSignal extends Signal {
  /** Number of distinct pain phrases found in title + text. */
  painScore: number
  /** 0..~1.2: engagement percentile within its source (60%), pain phrases (40%), +0.1 per extra source. */
  rank: number
  /** Discussion URLs of the same link on other sources (cross-source duplicates merged into this one). */
  alsoSeenIn: string[]
}

export interface RankOptions {
  limit: number
  maxSharePerSource: number
  maxTextLength: number
  painPhrases: string[]
}

export function painScore(signal: Pick<Signal, 'title' | 'text'>, phrases: string[]): number {
  const haystack = `${signal.title}\n${signal.text}`.toLowerCase()
  return phrases.filter((phrase) => haystack.includes(phrase)).length
}

const engagement = (s: Signal) => s.score + 2 * s.comments

/**
 * Mid-rank percentile of engagement within each source, 0..1. Sources are ranked separately
 * because 50 HN points and 50 GitHub stars mean very different things. All-equal groups
 * (RSS has no engagement numbers) get 0.5. O(n log n).
 */
export function sourcePercentiles(signals: Signal[]): Map<string, number> {
  const bySource = new Map<SourceName, Signal[]>()
  for (const s of signals) {
    const group = bySource.get(s.source)
    if (group) group.push(s)
    else bySource.set(s.source, [s])
  }
  const result = new Map<string, number>()
  for (const group of bySource.values()) {
    if (group.length === 1) {
      result.set((group[0] as Signal).id, 0.5)
      continue
    }
    const sorted = group.map(engagement).sort((a, b) => a - b)
    // value -> [index of first occurrence, count] in the sorted list
    const positions = new Map<number, [number, number]>()
    sorted.forEach((value, i) => {
      const seen = positions.get(value)
      if (seen) seen[1] += 1
      else positions.set(value, [i, 1])
    })
    for (const s of group) {
      const [below, equal] = positions.get(engagement(s)) as [number, number]
      result.set(s.id, (below + (equal - 1) / 2) / (group.length - 1))
    }
  }
  return result
}

/**
 * Rank, merge cross-source duplicates, and pick at most `limit` signals with no source taking more
 * than `maxSharePerSource` of the slots (unless the other sources run out).
 */
export function rankSignals(signals: Signal[], options: RankOptions): RankedSignal[] {
  const pct = sourcePercentiles(signals)
  const scored: RankedSignal[] = signals.map((s) => {
    const pain = painScore(s, options.painPhrases)
    return { ...s, painScore: pain, rank: 0.6 * (pct.get(s.id) ?? 0) + (0.4 * Math.min(pain, 3)) / 3, alsoSeenIn: [] }
  })
  scored.sort((a, b) => b.rank - a.rank)

  // The same article posted on HN and Reddit is one signal with two discussions.
  const byLink = new Map<string, RankedSignal>()
  for (const s of scored) {
    const existing = byLink.get(s.link)
    if (!existing) {
      byLink.set(s.link, s)
    } else if (existing.source !== s.source && !existing.alsoSeenIn.includes(s.url)) {
      existing.alsoSeenIn.push(s.url)
      existing.rank += 0.1
      existing.painScore = Math.max(existing.painScore, s.painScore)
    }
  }

  const merged = [...byLink.values()].sort(
    (a, b) => b.rank - a.rank || engagement(b) - engagement(a) || b.createdAt.localeCompare(a.createdAt),
  )

  const cap = Math.max(1, Math.ceil(options.limit * options.maxSharePerSource))
  const perSource = new Map<SourceName, number>()
  const picked: RankedSignal[] = []
  const overflow: RankedSignal[] = []
  for (const s of merged) {
    if (picked.length >= options.limit) break
    const count = perSource.get(s.source) ?? 0
    if (count < cap) {
      picked.push(s)
      perSource.set(s.source, count + 1)
    } else {
      overflow.push(s)
    }
  }
  for (const s of overflow) {
    if (picked.length >= options.limit) break
    picked.push(s)
  }

  return picked
    .sort((a, b) => b.rank - a.rank)
    .map((s) => ({ ...s, rank: Math.round(s.rank * 1000) / 1000, text: truncate(s.text, options.maxTextLength) }))
}
