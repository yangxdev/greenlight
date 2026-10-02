import { getJson } from '../http.ts'
import { htmlToText, toIso, truncate } from '../text.ts'
import type { FetchContext, ForumConfig, Signal, Source } from '../types.ts'

interface DiscourseTopic {
  id: number
  title: string
  slug: string
  posts_count: number
  like_count?: number
  created_at: string
  pinned?: boolean
  pinned_globally?: boolean
  visible?: boolean
}

interface LatestResponse {
  topic_list: { topics: DiscourseTopic[]; more_topics_url?: string }
}

interface TopicResponse {
  post_stream: { posts: { post_number: number; cooked: string }[] }
}

/** A daily run needs one page; this only matters for a backfill (`fetch --days`). */
const MAX_PAGES = 5
/** Between topic requests, to stay far under Discourse's default per-IP limits. */
const GAP_MS = 500

/** The opening post of each topic created in the lookback window, newest first, at most `maxTopics`. */
async function newTopics(ctx: FetchContext, forum: ForumConfig, maxTopics: number): Promise<DiscourseTopic[]> {
  const cutoff = ctx.now.getTime() - ctx.config.lookbackHours * 3600 * 1000
  const kept: DiscourseTopic[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    // order=created lists by creation date rather than last activity, so old topics with new replies don't crowd in.
    const params = new URLSearchParams({ order: 'created' })
    if (page > 0) params.set('page', String(page))
    const res = await getJson<LatestResponse>(ctx, `${forum.url}/latest.json?${params}`)
    const topics = res.topic_list.topics
    let older = false
    for (const topic of topics) {
      if (topic.pinned || topic.pinned_globally || topic.visible === false) continue
      if (new Date(topic.created_at).getTime() < cutoff) {
        older = true
        continue
      }
      kept.push(topic)
      if (kept.length >= maxTopics) {
        ctx.log(`discourse: ${forum.name} has more than ${maxTopics} new topics; only the newest are kept`)
        return kept
      }
    }
    if (older || topics.length === 0 || !res.topic_list.more_topics_url) return kept
  }
  ctx.log(`discourse: ${forum.name} has more than ${MAX_PAGES} pages; only the newest are kept`)
  return kept
}

async function firstPost(ctx: FetchContext, forum: ForumConfig, id: number): Promise<string> {
  const res = await getJson<TopicResponse>(ctx, `${forum.url}/t/${id}.json`)
  return res.post_stream.posts.find((p) => p.post_number === 1)?.cooked ?? ''
}

async function fetchForum(ctx: FetchContext, forum: ForumConfig): Promise<Signal[]> {
  const topics = await newTopics(ctx, forum, ctx.config.discourse.maxTopics)
  const signals: Signal[] = []
  let missingText = 0
  for (const topic of topics) {
    await ctx.sleep(GAP_MS)
    // A topic whose first post fails still counts by its title; one bad topic never drops the forum.
    const body = await firstPost(ctx, forum, topic.id).catch(() => {
      missingText++
      return ''
    })
    const url = `${forum.url}/t/${topic.slug}/${topic.id}`
    signals.push({
      id: `discourse:${forum.name}:${topic.id}`,
      source: 'discourse',
      channel: forum.name,
      url,
      link: url,
      title: htmlToText(topic.title),
      text: truncate(htmlToText(body), ctx.config.maxTextLength),
      score: topic.like_count ?? 0,
      comments: Math.max(0, topic.posts_count - 1),
      createdAt: toIso(topic.created_at, ctx.now),
    })
  }
  if (missingText > 0) ctx.log(`discourse: ${forum.name}: ${missingText} topic(s) kept without their text`)
  return signals
}

/**
 * New topics on public Discourse forums, read from the JSON that every Discourse site serves next to its pages
 * (`/latest.json`, `/t/<id>.json`). No key. Niche forums are where people outside software describe their
 * workarounds; the support-heavy ones only reach the Analyst with a pain phrase (export.dropWithoutPain).
 */
export const discourse: Source = {
  name: 'discourse',
  async fetch(ctx) {
    const { forums } = ctx.config.discourse
    const signals: Signal[] = []
    const failures: string[] = []
    for (const forum of forums) {
      try {
        signals.push(...(await fetchForum(ctx, forum)))
      } catch (error) {
        failures.push(`${forum.name}: ${(error as Error).message}`)
      }
    }
    if (forums.length > 0 && failures.length === forums.length) throw new Error(`all forums failed: ${failures.join('; ')}`)
    for (const failure of failures) ctx.log(`discourse: skipped ${failure}`)
    return signals
  },
}
