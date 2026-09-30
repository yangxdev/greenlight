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

const API = 'https://hn.algolia.com/api/v1/search_by_date'
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
    return [...byId.values()]
  },
}
