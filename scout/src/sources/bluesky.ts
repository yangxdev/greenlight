import { getJson } from '../http.ts'
import { toIso, truncate } from '../text.ts'
import type { FetchContext, Signal, Source } from '../types.ts'

interface Session {
  accessJwt: string
}

interface PostView {
  uri: string
  author: { did: string; labels?: { val: string }[] }
  record: { text?: string; createdAt?: string }
  likeCount?: number
  replyCount?: number
  indexedAt: string
}

interface SearchResponse {
  posts: PostView[]
  cursor?: string
}

/** A daily run needs one page per query; this only matters for a backfill (`fetch --days`). */
const MAX_PAGES = 3
const TITLE_LENGTH = 100

async function login(ctx: FetchContext, identifier: string, password: string): Promise<string> {
  const res = await getJson<Session>(ctx, `${ctx.config.bluesky.service}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  })
  return res.accessJwt
}

/** `at://<did>/app.bsky.feed.post/<rkey>` → the post's page, addressed by DID so no handle is stored. */
function postUrl(uri: string): string {
  const [, did, , rkey] = uri.replace(/^at:\/\//, '/').split('/')
  return `https://bsky.app/profile/${did}/post/${rkey}`
}

async function search(ctx: FetchContext, token: string, query: string): Promise<PostView[]> {
  const since = new Date(ctx.now.getTime() - ctx.config.lookbackHours * 3600 * 1000).toISOString()
  const posts: PostView[] = []
  let cursor: string | undefined
  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({ q: query, sort: 'latest', since, limit: String(ctx.config.bluesky.limit) })
    if (ctx.config.bluesky.lang) params.set('lang', ctx.config.bluesky.lang)
    if (cursor) params.set('cursor', cursor)
    const res = await getJson<SearchResponse>(ctx, `${ctx.config.bluesky.service}/xrpc/app.bsky.feed.searchPosts?${params}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    posts.push(...res.posts)
    cursor = res.cursor
    if (!cursor || res.posts.length === 0) break
  }
  return posts
}

/**
 * Bluesky posts that match a "someone should build this" phrase. Search needs a logged-in session, so the source
 * reads BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD (an app password, not the account password) and is skipped
 * without them. Authors who asked not to be shown to logged-out users are left out, because the idea cards are
 * public.
 */
export const bluesky: Source = {
  name: 'bluesky',
  async fetch(ctx) {
    const identifier = ctx.env.BLUESKY_IDENTIFIER
    const password = ctx.env.BLUESKY_APP_PASSWORD
    if (!identifier || !password) {
      ctx.log('bluesky: skipped (set BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD to enable)')
      return []
    }
    const token = await login(ctx, identifier, password)
    const { queries } = ctx.config.bluesky
    const signals: Signal[] = []
    const failures: string[] = []
    for (const query of queries) {
      try {
        for (const post of await search(ctx, token, query)) {
          if (post.author.labels?.some((l) => l.val === '!no-unauthenticated')) continue
          const text = (post.record.text ?? '').trim()
          if (text === '') continue
          const url = postUrl(post.uri)
          signals.push({
            id: `bluesky:${post.uri.replace(/^at:\/\//, '')}`,
            source: 'bluesky',
            channel: 'search',
            url,
            link: url,
            title: truncate(text.split('\n')[0] ?? text, TITLE_LENGTH),
            text: truncate(text, ctx.config.maxTextLength),
            score: post.likeCount ?? 0,
            comments: post.replyCount ?? 0,
            createdAt: toIso(post.record.createdAt ?? post.indexedAt, ctx.now),
          })
        }
      } catch (error) {
        failures.push(`"${query}": ${(error as Error).message}`)
      }
    }
    if (queries.length > 0 && failures.length === queries.length) throw new Error(`all queries failed: ${failures.join('; ')}`)
    for (const failure of failures) ctx.log(`bluesky: skipped ${failure}`)
    return signals
  },
}
