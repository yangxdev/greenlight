import { parseFeed, type FeedItem } from '../feed.ts'
import { getText } from '../http.ts'
import { canonicalUrl, htmlToText, toIso, truncate } from '../text.ts'
import type { FetchContext, Signal, Source, SourceName } from '../types.ts'

/** Shared by the rss source and Product Hunt's feed fallback. */
export function feedItemsToSignals(ctx: FetchContext, source: SourceName, channel: string, items: FeedItem[]): Signal[] {
  const cutoff = ctx.now.getTime() - ctx.config.lookbackHours * 3600 * 1000
  const signals: Signal[] = []
  for (const item of items) {
    if (!item.title || !item.link) continue
    const createdAt = toIso(item.published, ctx.now)
    if (new Date(createdAt).getTime() < cutoff) continue
    const link = canonicalUrl(item.link)
    signals.push({
      id: `${source}:${canonicalUrl(item.id)}`,
      source,
      channel,
      url: item.commentsUrl ? canonicalUrl(item.commentsUrl) : link,
      link,
      title: htmlToText(item.title),
      text: truncate(htmlToText(item.body), ctx.config.maxTextLength),
      score: 0,
      comments: item.comments,
      createdAt,
    })
  }
  return signals
}

export const rss: Source = {
  name: 'rss',
  async fetch(ctx) {
    const { feeds } = ctx.config.rss
    const results = await Promise.allSettled(
      feeds.map(async (feed) => feedItemsToSignals(ctx, 'rss', feed.name, parseFeed(await getText(ctx, feed.url)))),
    )
    const signals: Signal[] = []
    const failures: string[] = []
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') signals.push(...result.value)
      else failures.push(`${feeds[i]?.name}: ${(result.reason as Error).message}`)
    })
    if (feeds.length > 0 && failures.length === feeds.length) throw new Error(`all feeds failed: ${failures.join('; ')}`)
    for (const failure of failures) ctx.log(`rss: skipped ${failure}`)
    return signals
  },
}
