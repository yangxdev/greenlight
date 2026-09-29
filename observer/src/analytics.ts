import type { Ctx, WeekTraffic } from './types.ts'
import { ymd, type ReportWindow } from './week.ts'

const CF = 'https://api.cloudflare.com/client/v4'
const HEX32 = /^[a-f0-9]{32}$/i

interface SiteInfo {
  site_tag: string
  host?: string | null
  ruleset?: { zone_name?: string | null } | null
}

function auth(ctx: Ctx): { account: string; headers: Record<string, string> } {
  const token = ctx.env.CLOUDFLARE_API_TOKEN
  const account = ctx.env.CLOUDFLARE_ACCOUNT_ID
  if (!token || !account) throw new Error('CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID not set')
  return { account, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } }
}

/** host -> site tag for every Web Analytics site in the account. */
export async function listSiteTags(ctx: Ctx): Promise<Map<string, string>> {
  const { account, headers } = auth(ctx)
  const res = await ctx.fetch(`${CF}/accounts/${account}/rum/site_info/list?per_page=100`, {
    headers,
    signal: AbortSignal.timeout(20_000),
  })
  const body = (await res.json().catch(() => null)) as { success?: boolean; result?: SiteInfo[]; errors?: { message: string }[] } | null
  if (!res.ok || !body?.success) {
    throw new Error(`Web Analytics site list failed (HTTP ${res.status}${body?.errors?.[0] ? `: ${body.errors[0].message}` : ''})`)
  }
  const tags = new Map<string, string>()
  for (const site of body.result ?? []) {
    for (const host of [site.host, site.ruleset?.zone_name]) {
      if (host) tags.set(host.toLowerCase(), site.site_tag)
    }
  }
  return tags
}

interface RumGroup {
  count: number
  sum: { visits: number }
  dimensions: { date: string }
}

interface GraphqlResponse {
  data?: { viewer?: { accounts?: { rumPageloadEventsAdaptiveGroups?: RumGroup[] }[] } } | null
  errors?: { message: string }[] | null
}

/**
 * Page views and visits for the report week and the week before, from the Web Analytics (RUM) dataset.
 * Values are inlined after validation instead of passed as variables, which sidesteps scalar-type naming
 * differences in Cloudflare's schema. Cloudflare samples this data, so numbers are approximate.
 */
export async function weeklyTraffic(
  ctx: Ctx,
  siteTag: string,
  window: ReportWindow,
): Promise<{ thisWeek: WeekTraffic; lastWeek: WeekTraffic }> {
  const { account, headers } = auth(ctx)
  if (!HEX32.test(account)) throw new Error('CLOUDFLARE_ACCOUNT_ID is not a 32-character hex id')
  if (!HEX32.test(siteTag)) throw new Error(`site tag "${siteTag}" is not a 32-character hex id`)
  const lastDay = ymd(new Date(window.end.getTime() - 86_400_000))
  const query = `{
  viewer {
    accounts(filter: { accountTag: "${account}" }) {
      rumPageloadEventsAdaptiveGroups(
        filter: { siteTag: "${siteTag}", date_geq: "${ymd(window.prevStart)}", date_leq: "${lastDay}" }
        limit: 100
        orderBy: [date_ASC]
      ) { count sum { visits } dimensions { date } }
    }
  }
}`
  const res = await ctx.fetch(`${CF}/graphql`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(20_000),
  })
  const body = (await res.json().catch(() => null)) as GraphqlResponse | null
  // GraphQL errors arrive as HTTP 200 with an errors array.
  if (!res.ok || !body || body.errors?.length) {
    throw new Error(`Web Analytics query failed (HTTP ${res.status}${body?.errors?.[0] ? `: ${body.errors[0].message}` : ''})`)
  }
  const groups = body.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups ?? []
  const thisWeek: WeekTraffic = { visits: 0, pageViews: 0 }
  const lastWeek: WeekTraffic = { visits: 0, pageViews: 0 }
  const startDay = ymd(window.start)
  for (const group of groups) {
    const bucket = group.dimensions.date >= startDay ? thisWeek : lastWeek
    bucket.visits += group.sum.visits
    bucket.pageViews += group.count
  }
  return { thisWeek, lastWeek }
}
