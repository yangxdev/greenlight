export type SourceName = 'hn' | 'reddit' | 'github' | 'producthunt' | 'rss'

export const SOURCE_NAMES: readonly SourceName[] = ['hn', 'reddit', 'github', 'producthunt', 'rss']

/** One normalised item from any source. This is the Analyst's input record (plus rank fields on export). */
export interface Signal {
  /** Stable id `<source>:<native id>`, used as the MongoDB `_id`. */
  id: string
  source: SourceName
  /** Sub-feed: subreddit, feed name, HN tag (`story`, `ask_hn`, `show_hn`), repo language. */
  channel: string
  /** Where the discussion lives: HN item, Reddit thread, repo page, Product Hunt post, feed item. */
  url: string
  /** Canonicalised external link the item points at. Equals `url` for self posts. */
  link: string
  title: string
  /** Plain text (HTML stripped), truncated to `maxTextLength`. */
  text: string
  /** Upvotes / points / stars. 0 when the source has none (RSS). */
  score: number
  comments: number
  /** ISO 8601 creation time at the source. */
  createdAt: string
}

export interface FeedConfig {
  name: string
  url: string
}

export interface ScoutConfig {
  /** Sent with every request. Reddit asks for `<app>/<version> (by /u/<username>)`. */
  userAgent: string
  /** Only keep items created within this window. Slightly over 24h so daily runs overlap. */
  lookbackHours: number
  maxTextLength: number
  /** MongoDB TTL: signals are deleted this many days after first being seen. */
  retentionDays: number
  hn: { enabled: boolean; minPoints: number; askMinPoints: number; hitsPerPage: number }
  reddit: { enabled: boolean; subreddits: string[]; limit: number; minScore: number }
  github: { enabled: boolean; minStars: number; createdWithinDays: number; perPage: number }
  producthunt: { enabled: boolean; limit: number }
  rss: { enabled: boolean; feeds: FeedConfig[] }
  /** Case-insensitive phrases that suggest someone is describing a problem. Used for ranking only. */
  painPhrases: string[]
  /** What the Analyst gets. This is what costs Claude usage, so it is capped hard. */
  export: { days: number; limit: number; maxSharePerSource: number; maxTextLength: number }
}

export interface FetchContext {
  fetch: typeof fetch
  now: Date
  config: ScoutConfig
  env: Readonly<Record<string, string | undefined>>
  sleep: (ms: number) => Promise<void>
  log: (message: string) => void
}

export interface Source {
  name: SourceName
  fetch: (ctx: FetchContext) => Promise<Signal[]>
}
