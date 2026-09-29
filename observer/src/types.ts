export interface Ctx {
  fetch: typeof fetch
  env: Readonly<Record<string, string | undefined>>
  now: Date
  log: (message: string) => void
}

export interface ObserverConfig {
  /** host (e.g. "my-app.pages.dev") -> Cloudflare Web Analytics site tag, for hosts the API can't match. */
  siteTags: Record<string, string>
  probeTimeoutMs: number
  probeRetentionDays: number
}

/** A greenlight issue labelled `live`, with what the Architect and Publisher recorded on it. */
export interface Product {
  issue: number
  title: string
  /** owner/name from the Architect's `greenlight:repo=` marker. */
  repo: string | null
  /** https://<project>.pages.dev from the Publisher's `greenlight:url=` marker (or its "live at" text). */
  url: string | null
  /** When the Publisher first reported it live (ISO). */
  liveSince: string | null
}

export interface ProbeResult {
  url: string
  at: string
  /** /api/health answered { ok: true } AND / answered 200. */
  ok: boolean
  healthOk: boolean
  homeStatus: number | null
  latencyMs: number | null
  error: string | null
}

export interface WeekTraffic {
  visits: number
  pageViews: number
}

export interface ProductMetrics {
  issue: number
  title: string
  repo: string | null
  url: string | null
  liveSince: string | null
  /** Share of probes in the report week that were ok. `source` says whether it's history or one check now. */
  uptime: { checks: number; ok: number; pct: number | null; source: 'probes' | 'point-check' | 'none' }
  current: ProbeResult | null
  /** Cloudflare Web Analytics (sampled, approximate). null when not configured. */
  traffic: { siteTag: string; thisWeek: WeekTraffic; lastWeek: WeekTraffic } | null
  /** The blueprint's "Success metric" section. */
  successMetric: string | null
}

export interface BoardMetrics {
  /** Open issues per state label. */
  counts: Record<string, number>
  stuck: { issue: number; title: string }[]
  ideasFiledThisWeek: number
}

export interface Metrics {
  generatedAt: string
  week: string
  window: { start: string; end: string }
  products: ProductMetrics[]
  board: BoardMetrics
  /** Data gaps the report must mention instead of guessing (missing secrets, failed APIs). */
  notes: string[]
}
