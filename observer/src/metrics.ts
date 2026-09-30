import { listSiteTags, weeklyTraffic } from './analytics.ts'
import { ghFile, ghList, type GhIssue } from './github.ts'
import { probe } from './probe.ts'
import { discoverProducts } from './products.ts'
import type { ProbeStore } from './store.ts'
import type { BoardMetrics, Ctx, Metrics, ObserverConfig, Product, ProductMetrics } from './types.ts'
import { reportWindow, type ReportWindow } from './week.ts'

export const STATE_LABELS = ['idea', 'approved', 'blueprint-ready', 'blueprint-ok', 'building', 'live', 'stuck', 'archived']

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** The text under `## <heading>` up to the next `## ` heading, or null. */
export function markdownSection(markdown: string, heading: string): string | null {
  const lines = markdown.split('\n')
  const start = lines.findIndex((l) => l.trim().toLowerCase() === `## ${heading}`.toLowerCase())
  if (start === -1) return null
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((l) => /^##\s/.test(l))
  const text = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim()
  return text || null
}

export function boardMetrics(issues: GhIssue[], window: ReportWindow): BoardMetrics {
  const counts: Record<string, number> = Object.fromEntries(STATE_LABELS.map((l) => [l, 0]))
  const stuck: BoardMetrics['stuck'] = []
  let ideasFiledThisWeek = 0
  for (const issue of issues) {
    if (issue.pull_request) continue
    const labels = issue.labels.map((l) => l.name)
    if (issue.state === 'open') {
      for (const label of labels) if (label in counts) counts[label] = (counts[label] ?? 0) + 1
      if (labels.includes('stuck')) stuck.push({ issue: issue.number, title: issue.title })
    }
    const created = new Date(issue.created_at)
    if (issue.title.startsWith('[idea]') && created >= window.start && created < window.end) ideasFiledThisWeek += 1
  }
  return { counts, stuck, ideasFiledThisWeek }
}

export interface MetricsDeps {
  ctx: Ctx
  config: ObserverConfig
  greenlightRepo: string
  /** Probe history; null means no MongoDB, so uptime falls back to one check now. */
  store: ProbeStore | null
}

export async function buildMetrics({ ctx, config, greenlightRepo, store }: MetricsDeps): Promise<Metrics> {
  const window = reportWindow(ctx.now)
  const notes: string[] = []

  const [products, issues] = await Promise.all([
    discoverProducts(ctx, greenlightRepo),
    ghList<GhIssue>(ctx, `/repos/${greenlightRepo}/issues?state=all`),
  ])

  if (!store) notes.push('No MONGODB_URI: uptime is a single check at report time, not a 7-day history.')

  let siteTags = new Map(Object.entries(config.siteTags).map(([host, tag]) => [host.toLowerCase(), tag]))
  const hasCloudflare = Boolean(ctx.env.CLOUDFLARE_API_TOKEN && ctx.env.CLOUDFLARE_ACCOUNT_ID)
  if (!hasCloudflare) {
    notes.push('No CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID: no traffic numbers.')
  } else if (products.length > 0) {
    try {
      siteTags = new Map([...(await listSiteTags(ctx)), ...siteTags]) // config overrides win
    } catch (error) {
      notes.push(`Web Analytics site discovery failed (${message(error)}); only observer/config.json siteTags are used.`)
    }
  }

  const productMetrics: ProductMetrics[] = []
  for (const product of products) {
    productMetrics.push(await measure(ctx, config, store, product, window, siteTags, hasCloudflare, notes))
  }

  return {
    generatedAt: ctx.now.toISOString(),
    week: window.label,
    window: { start: window.start.toISOString(), end: window.end.toISOString() },
    products: productMetrics,
    board: boardMetrics(issues, window),
    notes,
  }
}

async function measure(
  ctx: Ctx,
  config: ObserverConfig,
  store: ProbeStore | null,
  product: Product,
  window: ReportWindow,
  siteTags: Map<string, string>,
  hasCloudflare: boolean,
  notes: string[],
): Promise<ProductMetrics> {
  const base: ProductMetrics = {
    ...product,
    uptime: { checks: 0, ok: 0, pct: null, source: 'none' },
    current: null,
    traffic: null,
    successMetric: null,
  }
  const label = `#${product.issue}`

  if (!product.url) {
    notes.push(`${label}: labelled live but no app URL recorded on the issue.`)
  } else {
    base.current = await probe(ctx, product.url, config.probeTimeoutMs)
    if (store) {
      const { checks, ok } = await store.uptime(product.url, window.start, window.end)
      base.uptime = { checks, ok, pct: checks ? Math.round((ok / checks) * 1000) / 10 : null, source: 'probes' }
    } else {
      const ok = base.current.ok ? 1 : 0
      base.uptime = { checks: 1, ok, pct: ok * 100, source: 'point-check' }
    }

    const host = new URL(product.url).host.toLowerCase()
    const siteTag = siteTags.get(host)
    if (hasCloudflare && siteTag) {
      try {
        base.traffic = { siteTag, ...(await weeklyTraffic(ctx, siteTag, window)) }
      } catch (error) {
        notes.push(`${label}: traffic query failed (${message(error)}).`)
      }
    } else if (hasCloudflare) {
      notes.push(`${label}: no Web Analytics site for ${host}. Add one in Cloudflare Web Analytics and set its token as the product repo's CF_BEACON_TOKEN variable (see greenlight README), or map it in observer/config.json.`)
    }
  }

  if (product.repo) {
    try {
      const blueprint = await ghFile(ctx, product.repo, 'blueprint.md')
      base.successMetric = blueprint ? markdownSection(blueprint, 'Success metric') : null
      if (!blueprint) notes.push(`${label}: could not read ${product.repo}/blueprint.md.`)
    } catch (error) {
      notes.push(`${label}: blueprint read failed (${message(error)}).`)
    }
  }
  return base
}
