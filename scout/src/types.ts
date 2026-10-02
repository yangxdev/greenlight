export type SourceName = 'hn' | 'reddit' | 'github' | 'producthunt' | 'stackexchange' | 'rss'

export const SOURCE_NAMES: readonly SourceName[] = ['hn', 'reddit', 'github', 'producthunt', 'stackexchange', 'rss']

/** One normalised item from any source. This is the Analyst's input record (plus rank fields on export). */
export interface Signal {
  /** Stable id `<source>:<native id>`, used as the MongoDB `_id`. */
  id: string
  source: SourceName
  /** Sub-feed: subreddit, feed name, HN tag (`story`, `ask_hn`, `show_hn`, `ask_hn_comment`), repo language, Stack Exchange site. */
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
  /** For replies: the title of the thread they answer. Shown to the Analyst, never used for ranking. */
  context?: string
}

export interface HnCommentsConfig {
  enabled: boolean
  /** Threads created within this many days (more for a longer `fetch --days`), so they have had time to fill up. */
  threadDays: number
  minComments: number
  maxThreads: number
  perThread: number
  /** Shorter comments ("+1", "This.") are skipped. */
  minLength: number
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
  hn: {
    enabled: boolean
    minPoints: number
    askMinPoints: number
    hitsPerPage: number
    /** Top-level comments of the most discussed recent Ask HN threads: that is where the complaints are. */
    comments: HnCommentsConfig
  }
  reddit: { enabled: boolean; subreddits: string[]; limit: number; minScore: number }
  github: { enabled: boolean; minStars: number; createdWithinDays: number; perPage: number }
  producthunt: { enabled: boolean; limit: number }
  /** `sites` are API site names, e.g. `softwarerecs` for softwarerecs.stackexchange.com. */
  stackexchange: { enabled: boolean; sites: string[]; minScore: number; pageSize: number }
  rss: { enabled: boolean; feeds: FeedConfig[] }
  /** Case-insensitive phrases that suggest someone is describing a problem. Used for ranking only. */
  painPhrases: string[]
  /** What the Analyst gets. This is what costs Claude usage, so it is capped hard. */
  export: {
    days: number
    limit: number
    maxSharePerSource: number
    maxTextLength: number
    /** `source` or `source:channel` patterns; see rank.ts. */
    questionChannels: string[]
    questionBoost: number
    dropWithoutPain: string[]
    /**
     * Sources that show what people build and launch, not what they struggle with. They never take the Analyst's
     * slots; `export --context-out` writes them to a separate file the Analyst and Critic search for competition.
     */
    contextSources: SourceName[]
    /** At most this many context items, most engaged first. The file is searched, not read whole. */
    contextLimit: number
  }
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
