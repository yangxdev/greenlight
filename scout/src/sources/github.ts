import { getJson } from '../http.ts'
import { htmlToText, toIso, truncate } from '../text.ts'
import type { Source } from '../types.ts'

interface GithubRepo {
  id: number
  full_name: string
  html_url: string
  description: string | null
  stargazers_count: number
  language: string | null
  topics?: string[]
  created_at: string
}

interface GithubSearch {
  items: GithubRepo[]
}

/**
 * "Trending" via the official search API: repos created recently that already collected stars.
 * GitHub has no trending API, and scraping the trending page breaks whenever the markup changes.
 */
export const github: Source = {
  name: 'github',
  async fetch(ctx) {
    const { minStars, createdWithinDays, perPage } = ctx.config.github
    const since = new Date(ctx.now.getTime() - createdWithinDays * 86_400_000).toISOString().slice(0, 10)
    const params = new URLSearchParams({
      q: `created:>=${since} stars:>=${minStars}`,
      sort: 'stars',
      order: 'desc',
      per_page: String(perPage),
    })
    const headers: Record<string, string> = {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
    }
    if (ctx.env.GITHUB_TOKEN) headers.authorization = `Bearer ${ctx.env.GITHUB_TOKEN}`
    const res = await getJson<GithubSearch>(ctx, `https://api.github.com/search/repositories?${params}`, { headers })

    return res.items.map((repo) => {
      const topics = repo.topics?.length ? `\nTopics: ${repo.topics.join(', ')}` : ''
      return {
        id: `github:${repo.id}`,
        source: 'github' as const,
        channel: repo.language ?? 'unknown',
        url: repo.html_url,
        link: repo.html_url,
        title: repo.full_name,
        text: truncate(`${htmlToText(repo.description)}${topics}`.trim(), ctx.config.maxTextLength),
        score: repo.stargazers_count,
        comments: 0,
        createdAt: toIso(repo.created_at, ctx.now),
      }
    })
  },
}
