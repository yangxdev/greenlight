import { getJson } from '../http.ts'
import { htmlToText, toIso, truncate } from '../text.ts'
import type { FetchContext, Signal, Source } from '../types.ts'

interface SeQuestion {
  question_id: number
  title: string
  body?: string
  link: string
  score: number
  answer_count: number
  creation_date: number
  tags: string[]
  closed_date?: number
}

interface SeResponse {
  items: SeQuestion[]
  has_more: boolean
  quota_remaining: number
  /** Seconds to wait before calling the same method again. Ignoring it gets the IP throttled. */
  backoff?: number
}

const API = 'https://api.stackexchange.com/2.3/questions'

async function questions(ctx: FetchContext, site: string): Promise<SeResponse> {
  const since = Math.floor(ctx.now.getTime() / 1000 - ctx.config.lookbackHours * 3600)
  const params = new URLSearchParams({
    site,
    fromdate: String(since),
    sort: 'creation',
    order: 'desc',
    pagesize: String(ctx.config.stackexchange.pageSize),
    filter: 'withbody', // built-in filter: the default fields plus the question body
  })
  // Optional, and not a secret: a registered key lifts the shared per-IP quota from 300 to 10,000 a day.
  if (ctx.env.STACKEXCHANGE_KEY) params.set('key', ctx.env.STACKEXCHANGE_KEY)
  return getJson<SeResponse>(ctx, `${API}?${params}`)
}

/** Body first, then the tags; the body is what gets cut when the text is too long. */
function textOf(q: SeQuestion, max: number): string {
  const tags = q.tags.length > 0 ? `\nTags: ${q.tags.join(', ')}` : ''
  return truncate(htmlToText(q.body), Math.max(0, max - tags.length)) + tags
}

/**
 * New questions on Stack Exchange sites. Software Recommendations and Web Applications are mostly people
 * asking whether a tool exists for their problem, which is exactly the pain the Analyst looks for.
 */
export const stackexchange: Source = {
  name: 'stackexchange',
  async fetch(ctx) {
    const { sites, minScore } = ctx.config.stackexchange
    const signals: Signal[] = []
    const failures: string[] = []
    let backoff = 0
    let quota: number | null = null

    for (const site of sites) {
      if (backoff > 0) await ctx.sleep(backoff * 1000)
      let res: SeResponse
      try {
        res = await questions(ctx, site)
      } catch (error) {
        failures.push(`${site}: ${(error as Error).message}`)
        continue
      }
      backoff = res.backoff ?? 0
      quota = res.quota_remaining
      if (res.has_more) ctx.log(`stackexchange: ${site} has more new questions than pageSize; only the newest are kept`)
      for (const q of res.items) {
        if (q.closed_date || q.score < minScore) continue
        signals.push({
          id: `stackexchange:${site}:${q.question_id}`,
          source: 'stackexchange',
          channel: site,
          url: q.link,
          link: q.link,
          title: htmlToText(q.title),
          text: textOf(q, ctx.config.maxTextLength),
          score: q.score,
          comments: q.answer_count,
          createdAt: toIso(q.creation_date, ctx.now),
        })
      }
    }

    if (quota !== null && quota < 50) {
      ctx.log(`stackexchange: only ${quota} requests left today for this IP (set STACKEXCHANGE_KEY to raise it)`)
    }
    if (failures.length > 0) {
      if (failures.length === sites.length) throw new Error(`all sites failed: ${failures.join('; ')}`)
      for (const failure of failures) ctx.log(`stackexchange: skipped ${failure}`)
    }
    return signals
  },
}
