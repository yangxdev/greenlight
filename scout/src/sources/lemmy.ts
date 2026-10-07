import { getJson } from '../http.ts'
import { canonicalUrl, htmlToText, toIso, truncate } from '../text.ts'
import type { FetchContext, Signal, Source } from '../types.ts'

interface LemmyPostView {
  post: {
    id: number
    name: string
    body?: string
    url?: string
    published: string
    ap_id: string
    nsfw?: boolean
    deleted?: boolean
    removed?: boolean
    featured_community?: boolean
    featured_local?: boolean
  }
  counts: { score: number; comments: number }
}

interface PostList {
  posts: LemmyPostView[]
}

/** A daily run needs one page; this only matters for a backfill (`fetch --days`). */
const MAX_PAGES = 5

/** Lemmy before 0.19 wrote timestamps without a zone; they are UTC. */
function utc(published: string): string {
  return /(Z|[+-]\d\d:?\d\d)$/.test(published) ? published : `${published}Z`
}

/** Posts created in the lookback window, newest first, read from the community's home instance. */
async function fetchCommunity(ctx: FetchContext, community: string): Promise<Signal[]> {
  const [name, host] = community.split('@') as [string, string]
  const cutoff = ctx.now.getTime() - ctx.config.lookbackHours * 3600 * 1000
  const { limit } = ctx.config.lemmy
  const signals: Signal[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({ community_name: name, sort: 'New', type_: 'All', limit: String(limit), page: String(page) })
    const res = await getJson<PostList>(ctx, `https://${host}/api/v3/post/list?${params}`)
    let older = false
    for (const { post, counts } of res.posts) {
      const published = utc(post.published)
      if (new Date(published).getTime() < cutoff) {
        older = true
        continue
      }
      if (post.nsfw || post.deleted || post.removed || post.featured_community || post.featured_local) continue
      signals.push({
        id: `lemmy:${community}:${post.id}`,
        source: 'lemmy',
        channel: community,
        url: post.ap_id,
        link: post.url ? canonicalUrl(post.url) : post.ap_id,
        title: htmlToText(post.name),
        text: truncate(htmlToText(post.body), ctx.config.maxTextLength),
        score: counts.score,
        comments: counts.comments,
        createdAt: toIso(published, ctx.now),
      })
    }
    if (older || res.posts.length < limit) return signals
  }
  ctx.log(`lemmy: ${community} has more than ${MAX_PAGES} pages; only the newest are kept`)
  return signals
}

/**
 * New posts in Lemmy communities, from the open API every instance serves. No key. The closest thing to Reddit
 * that can be read without asking: the same kind of question and help communities, federated.
 */
export const lemmy: Source = {
  name: 'lemmy',
  async fetch(ctx) {
    const { communities } = ctx.config.lemmy
    const signals: Signal[] = []
    const failures: string[] = []
    for (const community of communities) {
      try {
        signals.push(...(await fetchCommunity(ctx, community)))
      } catch (error) {
        failures.push(`${community}: ${(error as Error).message}`)
      }
    }
    if (communities.length > 0 && failures.length === communities.length) {
      throw new Error(`all communities failed: ${failures.join('; ')}`)
    }
    for (const failure of failures) ctx.log(`lemmy: skipped ${failure}`)
    return signals
  },
}
