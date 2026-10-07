import { getJson } from '../http.ts'
import { htmlToText, toIso, truncate } from '../text.ts'
import type { FetchContext, Signal, Source } from '../types.ts'

interface GithubIssue {
  id: number
  html_url: string
  title: string
  body: string | null
  comments: number
  created_at: string
  repository_url: string
  labels: { name: string }[]
  reactions?: { total_count: number }
  pull_request?: unknown
}

interface IssueSearch {
  items: GithubIssue[]
}

/** The search API allows 30 requests a minute with a token; this keeps a few queries far under it. */
const GAP_MS = 2500

/** `https://api.github.com/repos/<owner>/<repo>` → `<owner>/<repo>`. */
function repoOf(issue: GithubIssue): string {
  return issue.repository_url.replace(/^https:\/\/api\.github\.com\/repos\//, '')
}

/** Body first, then the labels; the body is what gets cut when the text is too long. */
function textOf(issue: GithubIssue, max: number): string {
  const labels = issue.labels.length > 0 ? `\nLabels: ${issue.labels.map((l) => l.name).join(', ')}` : ''
  return truncate(htmlToText(issue.body), Math.max(0, max - labels.length)) + labels
}

async function search(ctx: FetchContext, query: string, since: string): Promise<GithubIssue[]> {
  const { perPage } = ctx.config.issues
  const params = new URLSearchParams({
    q: `is:issue ${query} created:>=${since}`,
    sort: 'reactions',
    order: 'desc',
    per_page: String(perPage),
  })
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
  }
  if (ctx.env.GITHUB_TOKEN) headers.authorization = `Bearer ${ctx.env.GITHUB_TOKEN}`
  const res = await getJson<IssueSearch>(ctx, `https://api.github.com/search/issues?${params}`, { headers })
  return res.items
}

/**
 * Feature requests and "is there a way" issues on any public repo, created in the last `createdWithinDays` and
 * already collecting reactions. A reaction is someone else saying "me too", so these are requests with a count of
 * the people behind them. The window matches the export's, and daily runs refresh the reaction counts.
 */
export const issues: Source = {
  name: 'issues',
  async fetch(ctx) {
    const { queries, createdWithinDays } = ctx.config.issues
    // A backfill (`fetch --days`) widens the window; a daily run keeps createdWithinDays.
    const days = Math.max(createdWithinDays, Math.ceil(ctx.config.lookbackHours / 24))
    const since = new Date(ctx.now.getTime() - days * 86_400_000).toISOString().slice(0, 10)
    const signals: Signal[] = []
    const failures: string[] = []
    for (const [i, query] of queries.entries()) {
      if (i > 0) await ctx.sleep(GAP_MS)
      try {
        for (const issue of await search(ctx, query, since)) {
          if (issue.pull_request) continue
          signals.push({
            id: `issues:${issue.id}`,
            source: 'issues',
            channel: repoOf(issue),
            url: issue.html_url,
            link: issue.html_url,
            title: htmlToText(issue.title),
            text: textOf(issue, ctx.config.maxTextLength),
            score: issue.reactions?.total_count ?? 0,
            comments: issue.comments,
            createdAt: toIso(issue.created_at, ctx.now),
          })
        }
      } catch (error) {
        failures.push(`"${query}": ${(error as Error).message}`)
      }
    }
    if (queries.length > 0 && failures.length === queries.length) throw new Error(`all queries failed: ${failures.join('; ')}`)
    for (const failure of failures) ctx.log(`issues: skipped ${failure}`)
    return signals
  },
}
