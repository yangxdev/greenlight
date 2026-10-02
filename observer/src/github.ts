import type { Ctx } from './types.ts'

const API = 'https://api.github.com'

export interface GhIssue {
  number: number
  title: string
  state: 'open' | 'closed'
  labels: { name: string }[]
  created_at: string
  pull_request?: unknown
}

export interface GhComment {
  body: string | null
  created_at: string
  user?: { login: string } | null
  author_association?: string
}

function headers(ctx: Ctx, accept = 'application/vnd.github+json'): Record<string, string> {
  const h: Record<string, string> = {
    accept,
    'x-github-api-version': '2022-11-28',
    'user-agent': 'greenlight-observer',
  }
  if (ctx.env.GITHUB_TOKEN) h.authorization = `Bearer ${ctx.env.GITHUB_TOKEN}`
  return h
}

/** Parse the `rel="next"` URL out of a GitHub Link header. */
export function nextLink(link: string | null): string | null {
  if (!link) return null
  for (const part of link.split(',')) {
    const match = /<([^>]+)>;\s*rel="next"/.exec(part)
    if (match?.[1]) return match[1]
  }
  return null
}

/** GET a paginated list endpoint (at most 10 pages of 100). */
export async function ghList<T>(ctx: Ctx, path: string): Promise<T[]> {
  const items: T[] = []
  let url: string | null = `${API}${path}${path.includes('?') ? '&' : '?'}per_page=100`
  for (let page = 0; url && page < 10; page++) {
    const res: Response = await ctx.fetch(url, { headers: headers(ctx), signal: AbortSignal.timeout(20_000) })
    if (!res.ok) throw new Error(`GitHub ${res.status} for ${path}`)
    items.push(...((await res.json()) as T[]))
    url = nextLink(res.headers.get('link'))
  }
  return items
}

/** Raw file contents from a repo, or null if it doesn't exist or the token can't see it. */
export async function ghFile(ctx: Ctx, repo: string, path: string): Promise<string | null> {
  const res = await ctx.fetch(`${API}/repos/${repo}/contents/${path}`, {
    headers: headers(ctx, 'application/vnd.github.raw+json'),
    signal: AbortSignal.timeout(20_000),
  })
  if (res.status === 404 || res.status === 403) return null
  if (!res.ok) throw new Error(`GitHub ${res.status} for ${repo}/${path}`)
  return res.text()
}
