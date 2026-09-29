import { parseFeed } from '../feed.ts'
import { getJson, getText } from '../http.ts'
import { canonicalUrl, htmlToText, toIso, truncate } from '../text.ts'
import type { FetchContext, Signal, Source } from '../types.ts'
import { feedItemsToSignals } from './rss.ts'

interface PhPost {
  id: string
  name: string
  tagline: string
  description: string | null
  url: string
  website: string | null
  votesCount: number
  commentsCount: number
  createdAt: string
  topics: { edges: { node: { name: string } }[] }
}

interface PhResponse {
  data?: { posts: { edges: { node: PhPost }[] } }
  errors?: { message: string }[]
}

const QUERY = `query Greenlight($postedAfter: DateTime!, $first: Int!) {
  posts(order: VOTES, postedAfter: $postedAfter, first: $first) {
    edges { node {
      id name tagline description url website votesCount commentsCount createdAt
      topics(first: 5) { edges { node { name } } }
    } }
  }
}`

async function viaApi(ctx: FetchContext, token: string): Promise<Signal[]> {
  const postedAfter = new Date(ctx.now.getTime() - ctx.config.lookbackHours * 3600 * 1000).toISOString()
  const res = await getJson<PhResponse>(ctx, 'https://api.producthunt.com/v2/api/graphql', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { postedAfter, first: ctx.config.producthunt.limit } }),
  })
  if (res.errors?.length) throw new Error(`Product Hunt API: ${res.errors.map((e) => e.message).join('; ')}`)
  return (res.data?.posts.edges ?? []).map(({ node }) => {
    const topics = node.topics.edges.map((e) => e.node.name)
    const body = [node.tagline, htmlToText(node.description), topics.length ? `Topics: ${topics.join(', ')}` : '']
    return {
      id: `producthunt:${node.id}`,
      source: 'producthunt' as const,
      channel: topics[0] ?? 'launch',
      url: canonicalUrl(node.url),
      link: canonicalUrl(node.website ?? node.url),
      title: htmlToText(node.name),
      text: truncate(body.filter(Boolean).join('\n'), ctx.config.maxTextLength),
      score: node.votesCount,
      comments: node.commentsCount,
      createdAt: toIso(node.createdAt, ctx.now),
    }
  })
}

/**
 * Uses the GraphQL API when PRODUCTHUNT_TOKEN is set (it has votes and comment counts). Otherwise it
 * falls back to the public Atom feed, which has no engagement numbers.
 */
export const producthunt: Source = {
  name: 'producthunt',
  async fetch(ctx) {
    const token = ctx.env.PRODUCTHUNT_TOKEN
    if (token) return viaApi(ctx, token)
    const items = parseFeed(await getText(ctx, 'https://www.producthunt.com/feed'))
    return feedItemsToSignals(ctx, 'producthunt', 'feed', items).slice(0, ctx.config.producthunt.limit)
  },
}
