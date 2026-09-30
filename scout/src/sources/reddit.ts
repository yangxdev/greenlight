import { getJson, request } from '../http.ts'
import { canonicalUrl, htmlToText, toIso, truncate } from '../text.ts'
import type { FetchContext, Signal, Source } from '../types.ts'

interface RedditPost {
  id: string
  title: string
  selftext: string
  permalink: string
  url: string
  score: number
  num_comments: number
  created_utc: number
  subreddit: string
  over_18: boolean
  stickied: boolean
  is_self: boolean
}

interface RedditListing {
  data: { children: { kind: string; data: RedditPost }[] }
}

/**
 * Application-only OAuth (client_credentials). Anonymous `.json` listings now return 403 everywhere, and new
 * credentials need Reddit's approval (see scout/README.md), so there is no anonymous fallback.
 */
async function appToken(ctx: FetchContext, id: string, secret: string): Promise<string> {
  const res = await request(ctx, 'https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const body = (await res.json()) as { access_token?: string }
  if (!body.access_token) throw new Error('Reddit token response had no access_token')
  return body.access_token
}

export const reddit: Source = {
  name: 'reddit',
  async fetch(ctx) {
    const { subreddits, limit, minScore } = ctx.config.reddit
    const id = ctx.env.REDDIT_CLIENT_ID
    const secret = ctx.env.REDDIT_CLIENT_SECRET
    if (!id || !secret) {
      // Skipped, not failed: waiting on Reddit's approval shouldn't flag every daily run.
      ctx.log('reddit: skipped, no REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET (API access needs approval, see scout/README.md)')
      return []
    }
    if (ctx.config.userAgent.includes('CHANGE_ME')) {
      throw new Error('set your Reddit username in config.json userAgent; Reddit requires "(by /u/<name>)"')
    }
    const token = await appToken(ctx, id, secret)
    const cutoff = ctx.now.getTime() - ctx.config.lookbackHours * 3600 * 1000
    const signals: Signal[] = []
    const failures: string[] = []

    for (const [i, sub] of subreddits.entries()) {
      if (i > 0) await ctx.sleep(1100) // stay well under Reddit's rate limits
      const params = new URLSearchParams({ t: 'day', limit: String(limit), raw_json: '1' })
      let listing: RedditListing
      try {
        listing = await getJson<RedditListing>(ctx, `https://oauth.reddit.com/r/${sub}/top?${params}`, {
          headers: { authorization: `bearer ${token}` },
        })
      } catch (error) {
        failures.push(`r/${sub}: ${(error as Error).message}`)
        continue
      }
      for (const { data: post } of listing.data.children) {
        if (post.stickied || post.over_18 || post.score < minScore) continue
        if (post.created_utc * 1000 < cutoff) continue
        const thread = `https://www.reddit.com${post.permalink}`
        signals.push({
          id: `reddit:${post.id}`,
          source: 'reddit',
          channel: post.subreddit,
          url: thread,
          link: post.is_self ? thread : canonicalUrl(post.url),
          title: htmlToText(post.title),
          text: truncate(htmlToText(post.selftext), ctx.config.maxTextLength),
          score: post.score,
          comments: post.num_comments,
          createdAt: toIso(post.created_utc, ctx.now),
        })
      }
    }

    if (failures.length > 0) {
      // One bad subreddit shouldn't sink the rest; all of them failing should.
      if (failures.length === subreddits.length) throw new Error(`all subreddits failed: ${failures.join('; ')}`)
      for (const failure of failures) ctx.log(`reddit: skipped ${failure}`)
    }
    return signals
  },
}
