import { getJson } from '../http.ts'
import { canonicalUrl, htmlToText, toIso, truncate } from '../text.ts'
import type { FetchContext, Signal, Source } from '../types.ts'

interface HnHit {
  objectID: string
  title: string | null
  url: string | null
  story_text: string | null
  points: number | null
  num_comments: number | null
  created_at: string
  _tags: string[]
}

interface HnResponse {
  hits: HnHit[]
  nbPages?: number
}

/** Algolia's /items/:id: the story with its whole comment tree. Deleted comments have no text. */
interface HnItem {
  id: number
  created_at: string
  title?: string | null
  text: string | null
  children: HnItem[]
}

const API = 'https://hn.algolia.com/api/v1/search_by_date'
const ITEMS = 'https://hn.algolia.com/api/v1/items'
/** Even a long `fetch --days` backfill reads at most this many threads. */
const MAX_COMMENT_THREADS = 50
/** Algolia stops at 1,000 results per query, which is 10 pages of 100. A daily run needs one. */
const MAX_PAGES = 10

function channelOf(tags: string[]): string {
  if (tags.includes('ask_hn')) return 'ask_hn'
  if (tags.includes('show_hn')) return 'show_hn'
  return 'story'
}

async function query(ctx: FetchContext, tags: string, minPoints: number): Promise<HnHit[]> {
  const since = Math.floor(ctx.now.getTime() / 1000 - ctx.config.lookbackHours * 3600)
  const params = new URLSearchParams({
    tags,
    numericFilters: `created_at_i>${since},points>=${minPoints}`,
    hitsPerPage: String(ctx.config.hn.hitsPerPage),
  })
  const hits: HnHit[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    params.set('page', String(page))
    const res = await getJson<HnResponse>(ctx, `${API}?${params}`)
    hits.push(...res.hits)
    if (page + 1 >= (res.nbPages ?? 1)) break
  }
  return hits
}

function descendants(item: HnItem): number {
  return item.children.reduce((n, child) => n + 1 + descendants(child), 0)
}

/**
 * The Ask HN question is one line; the complaints are in the replies. Takes the most discussed Ask HN threads of
 * the last `threadDays` (old enough to have filled up), and turns each thread's most-replied top-level comments
 * into signals of their own, so they are ranked, cited and merged like any other signal.
 */
async function askComments(ctx: FetchContext): Promise<Signal[]> {
  const { threadDays, minComments, maxThreads, perThread, minLength } = ctx.config.hn.comments
  const days = Math.max(threadDays, ctx.config.lookbackHours / 24)
  const threadLimit = Math.min(MAX_COMMENT_THREADS, Math.ceil((maxThreads * days) / threadDays))
  const since = Math.floor(ctx.now.getTime() / 1000 - days * 86_400)
  const params = new URLSearchParams({
    tags: 'ask_hn',
    numericFilters: `created_at_i>${since},num_comments>=${minComments}`,
    hitsPerPage: '100',
  })
  const { hits } = await getJson<HnResponse>(ctx, `${API}?${params}`)
  const threads = hits
    .filter((hit) => hit.title && (hit.num_comments ?? 0) >= minComments)
    .sort((a, b) => (b.num_comments ?? 0) - (a.num_comments ?? 0))
    .slice(0, threadLimit)

  const signals: Signal[] = []
  for (const thread of threads) {
    let item: HnItem
    try {
      item = await getJson<HnItem>(ctx, `${ITEMS}/${thread.objectID}`)
    } catch (error) {
      ctx.log(`hn: skipped comments of ${thread.objectID}: ${(error as Error).message}`)
      continue
    }
    // The thread's question goes in `context`, not the title: its pain phrases are the asker's, not this commenter's.
    const context = htmlToText(thread.title)
    const top = item.children
      .map((comment) => ({ comment, text: htmlToText(comment.text), replies: descendants(comment) }))
      .filter(({ text }) => text.length >= minLength)
      .sort((a, b) => b.replies - a.replies || a.comment.created_at.localeCompare(b.comment.created_at))
      .slice(0, perThread)
    for (const { comment, text, replies } of top) {
      const url = `https://news.ycombinator.com/item?id=${comment.id}`
      signals.push({
        id: `hn:${comment.id}`,
        source: 'hn',
        channel: 'ask_hn_comment',
        url,
        link: url,
        title: 'Ask HN reply',
        text: truncate(text, ctx.config.maxTextLength),
        score: 0, // HN does not expose comment points
        comments: replies,
        createdAt: toIso(comment.created_at, ctx.now),
        context,
      })
    }
  }
  return signals
}

export const hn: Source = {
  name: 'hn',
  async fetch(ctx) {
    const { minPoints, askMinPoints } = ctx.config.hn
    // Ask HN threads are where people describe problems, so they get a lower bar than link posts.
    const [stories, asks] = await Promise.all([query(ctx, 'story', minPoints), query(ctx, 'ask_hn', askMinPoints)])
    const byId = new Map<string, Signal>()
    for (const hit of [...stories, ...asks]) {
      if (!hit.title || byId.has(hit.objectID)) continue
      const url = `https://news.ycombinator.com/item?id=${hit.objectID}`
      byId.set(hit.objectID, {
        id: `hn:${hit.objectID}`,
        source: 'hn',
        channel: channelOf(hit._tags),
        url,
        link: hit.url ? canonicalUrl(hit.url) : url,
        title: htmlToText(hit.title),
        text: truncate(htmlToText(hit.story_text), ctx.config.maxTextLength),
        score: hit.points ?? 0,
        comments: hit.num_comments ?? 0,
        createdAt: toIso(hit.created_at, ctx.now),
      })
    }
    const signals = [...byId.values()]
    if (!ctx.config.hn.comments.enabled) return signals
    try {
      return [...signals, ...(await askComments(ctx))]
    } catch (error) {
      // Comments are extra context: losing them must not lose the stories.
      ctx.log(`hn: skipped Ask HN comments: ${(error as Error).message}`)
      return signals
    }
  },
}
