import { ghList, type GhComment, type GhIssue } from './github.ts'
import type { Ctx, Product } from './types.ts'

const REPO_MARKER = /greenlight:repo=([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)/g
const URL_MARKER = /greenlight:url=(https:\/\/[^\s>"']+)/g
const APP_URL = /https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:workers|pages)\.dev\b/g

const lastMatch = (text: string, pattern: RegExp) => [...text.matchAll(pattern)].at(-1)

/**
 * Read what the pipeline recorded in an issue's comments: the product repo (Architect marker) and the live URL
 * (Publisher marker, falling back to a *.workers.dev or *.pages.dev link in a Publisher comment for older or
 * hand-written notes).
 */
export function parseProductComments(comments: GhComment[]): Pick<Product, 'repo' | 'url' | 'liveSince'> {
  let repo: string | null = null
  let url: string | null = null
  let liveSince: string | null = null
  for (const comment of comments) {
    const body = comment.body ?? ''
    const repoMatch = lastMatch(body, REPO_MARKER)
    if (repoMatch?.[1]) repo = repoMatch[1]
    const urlMatch = lastMatch(body, URL_MARKER) ?? (body.includes('Publisher') ? lastMatch(body, APP_URL) : undefined)
    const found = urlMatch?.[1] ?? urlMatch?.[0]
    if (found) {
      url = found.replace(/\/+$/, '')
      liveSince ??= comment.created_at
    }
  }
  return { repo, url, liveSince }
}

export async function discoverProducts(ctx: Ctx, greenlightRepo: string): Promise<Product[]> {
  const issues = await ghList<GhIssue>(ctx, `/repos/${greenlightRepo}/issues?state=open&labels=live`)
  const products: Product[] = []
  for (const issue of issues.filter((i) => !i.pull_request)) {
    const comments = await ghList<GhComment>(ctx, `/repos/${greenlightRepo}/issues/${issue.number}/comments`)
    products.push({ issue: issue.number, title: issue.title, ...parseProductComments(comments) })
  }
  return products
}
