import type { Ctx, TokenExpiry } from './types.ts'

const DAY = 86_400_000
/** Warn this many days ahead: one or two weekly reports before the token stops working. */
export const WARN_DAYS = 30

const RENEW = {
  GREENLIGHT_TOKEN:
    'Regenerate the fine-grained PAT (README → One-time setup → 2) and update the GREENLIGHT_TOKEN secret here and in every product repo.',
  CLOUDFLARE_API_TOKEN:
    'Roll or recreate the Cloudflare API token (README → One-time setup → 3) and update CLOUDFLARE_API_TOKEN here and in every product repo.',
  CLAUDE_CODE_OAUTH_TOKEN:
    'Run `claude setup-token`, update CLAUDE_CODE_OAUTH_TOKEN here and in every product repo, then the CLAUDE_TOKEN_EXPIRES variable.',
} as const

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

function expiry(name: keyof typeof RENEW, expiresAt: Date, now: Date): TokenExpiry {
  return {
    name,
    expiresOn: expiresAt.toISOString().slice(0, 10),
    daysLeft: Math.floor((expiresAt.getTime() - now.getTime()) / DAY),
    renew: RENEW[name],
  }
}

/** GitHub sends `github-authentication-token-expiration: 2027-09-29 12:00:00 UTC` for tokens that expire. */
export function parseGithubExpiry(header: string | null): Date | null {
  if (!header) return null
  const date = new Date(header.trim().replace(' UTC', 'Z').replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? null : date
}

async function githubToken(ctx: Ctx): Promise<TokenExpiry | null> {
  // /rate_limit costs nothing against the rate limit and carries the expiry header like any authenticated call.
  const res = await ctx.fetch('https://api.github.com/rate_limit', {
    headers: { authorization: `Bearer ${ctx.env.GITHUB_TOKEN}`, 'user-agent': 'greenlight-observer' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  const expiresAt = parseGithubExpiry(res.headers.get('github-authentication-token-expiration'))
  return expiresAt ? expiry('GREENLIGHT_TOKEN', expiresAt, ctx.now) : null
}

interface CfVerify {
  success: boolean
  result?: { status?: string; expires_on?: string }
}

/** A user token verifies at /user/tokens/verify, an account-owned one at /accounts/<id>/tokens/verify. */
async function cloudflareToken(ctx: Ctx): Promise<{ expiry: TokenExpiry | null; problem: string | null }> {
  const urls = ['https://api.cloudflare.com/client/v4/user/tokens/verify']
  if (ctx.env.CLOUDFLARE_ACCOUNT_ID) {
    urls.push(`https://api.cloudflare.com/client/v4/accounts/${ctx.env.CLOUDFLARE_ACCOUNT_ID}/tokens/verify`)
  }
  for (const url of urls) {
    const res = await ctx.fetch(url, {
      headers: { authorization: `Bearer ${ctx.env.CLOUDFLARE_API_TOKEN}` },
      signal: AbortSignal.timeout(20_000),
    })
    const body = (await res.json().catch(() => null)) as CfVerify | null
    if (!res.ok || !body?.success || !body.result) continue
    if (body.result.status && body.result.status !== 'active') {
      return { expiry: null, problem: `CLOUDFLARE_API_TOKEN is ${body.result.status}: deploys and traffic numbers will fail. ${RENEW.CLOUDFLARE_API_TOKEN}` }
    }
    const expiresAt = body.result.expires_on ? new Date(body.result.expires_on) : null
    return { expiry: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiry('CLOUDFLARE_API_TOKEN', expiresAt, ctx.now) : null, problem: null }
  }
  return { expiry: null, problem: 'Cloudflare did not verify CLOUDFLARE_API_TOKEN (invalid, revoked, or verify not allowed).' }
}

/**
 * When the pipeline's long-lived tokens expire, and notes for the ones that need action within WARN_DAYS. Every
 * check is best effort: a failed lookup becomes a note, never a failed report.
 */
export async function checkTokens(ctx: Ctx): Promise<{ tokens: TokenExpiry[]; notes: string[] }> {
  const tokens: TokenExpiry[] = []
  const notes: string[] = []

  // Only the PAT has a meaningful expiry; the workflow's own GITHUB_TOKEN lasts an hour.
  if (ctx.env.GITHUB_TOKEN && ctx.env.TOKEN_IS_PAT === 'true') {
    try {
      const t = await githubToken(ctx)
      if (t) tokens.push(t)
    } catch (error) {
      notes.push(`Could not read GREENLIGHT_TOKEN's expiry (${message(error)}).`)
    }
  }

  if (ctx.env.CLOUDFLARE_API_TOKEN) {
    try {
      const { expiry: t, problem } = await cloudflareToken(ctx)
      if (t) tokens.push(t)
      if (problem) notes.push(problem)
    } catch (error) {
      notes.push(`Could not verify CLOUDFLARE_API_TOKEN (${message(error)}).`)
    }
  }

  // Claude's OAuth token can't be asked; `claude setup-token` tokens last a year, so the owner records the date.
  const claude = ctx.env.CLAUDE_TOKEN_EXPIRES?.trim()
  if (claude) {
    const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(claude) ? new Date(`${claude}T00:00:00Z`) : null
    if (expiresAt && !Number.isNaN(expiresAt.getTime())) tokens.push(expiry('CLAUDE_CODE_OAUTH_TOKEN', expiresAt, ctx.now))
    else notes.push(`The CLAUDE_TOKEN_EXPIRES variable must be a date like 2027-10-01, not "${claude}".`)
  }

  for (const t of tokens) {
    if (t.daysLeft === null || t.daysLeft > WARN_DAYS) continue
    notes.push(
      t.daysLeft < 0
        ? `${t.name} expired on ${t.expiresOn}. ${t.renew}`
        : `${t.name} expires on ${t.expiresOn} (${t.daysLeft} days). ${t.renew}`,
    )
  }
  return { tokens, notes }
}
