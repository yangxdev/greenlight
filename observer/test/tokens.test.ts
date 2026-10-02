import { describe, expect, it } from 'vitest'
import { checkTokens, parseGithubExpiry } from '../src/tokens.ts'
import { ACCOUNT, fakeFetch, json, makeCtx } from './helpers.ts'

// NOW is 2026-10-05T04:47Z.
const github = (expiration: string | null) => (url: URL) =>
  url.hostname === 'api.github.com' && url.pathname === '/rate_limit'
    ? json({}, 200, expiration ? { 'github-authentication-token-expiration': expiration } : {})
    : undefined

describe('parseGithubExpiry', () => {
  it("reads GitHub's header format, and nothing else", () => {
    expect(parseGithubExpiry('2027-09-29 12:00:00 UTC')?.toISOString()).toBe('2027-09-29T12:00:00.000Z')
    expect(parseGithubExpiry(null)).toBeNull()
    expect(parseGithubExpiry('soon')).toBeNull()
  })
})

describe('checkTokens', () => {
  it('lists a far-off PAT expiry without a note', async () => {
    const ctx = makeCtx(fakeFetch(github('2027-09-29 12:00:00 UTC')), { GITHUB_TOKEN: 'pat', TOKEN_IS_PAT: 'true' })
    const { tokens, notes } = await checkTokens(ctx)
    expect(tokens).toEqual([expect.objectContaining({ name: 'GREENLIGHT_TOKEN', expiresOn: '2027-09-29', daysLeft: 359 })])
    expect(notes).toEqual([])
  })

  it('warns 30 days ahead and after expiry, with what to do', async () => {
    const soon = await checkTokens(makeCtx(fakeFetch(github('2026-10-20 00:00:00 UTC')), { GITHUB_TOKEN: 'pat', TOKEN_IS_PAT: 'true' }))
    expect(soon.notes).toEqual([expect.stringMatching(/^GREENLIGHT_TOKEN expires on 2026-10-20 \(14 days\)\. Regenerate the fine-grained PAT/)])
    const gone = await checkTokens(makeCtx(fakeFetch(github('2026-10-01 00:00:00 UTC')), { GITHUB_TOKEN: 'pat', TOKEN_IS_PAT: 'true' }))
    expect(gone.notes).toEqual([expect.stringMatching(/^GREENLIGHT_TOKEN expired on 2026-10-01\./)])
  })

  it("doesn't ask about the workflow's own one-hour token", async () => {
    const fetch = fakeFetch(github('2026-10-05 05:47:00 UTC'))
    const { tokens, notes } = await checkTokens(makeCtx(fetch, { GITHUB_TOKEN: 'ghs_x' }))
    expect(fetch.calls).toHaveLength(0)
    expect(tokens).toEqual([])
    expect(notes).toEqual([])
  })

  it('reads the Cloudflare expiry, falling back to the account endpoint for account-owned tokens', async () => {
    const fetch = fakeFetch((url) =>
      url.pathname === `/client/v4/accounts/${ACCOUNT}/tokens/verify`
        ? json({ success: true, result: { id: 't', status: 'active', expires_on: '2026-10-25T00:00:00Z' } })
        : url.pathname === '/client/v4/user/tokens/verify'
          ? json({ success: false, errors: [{ code: 1000, message: 'Invalid API Token' }] }, 401)
          : undefined,
    )
    const { tokens, notes } = await checkTokens(makeCtx(fetch, { CLOUDFLARE_API_TOKEN: 'cf', CLOUDFLARE_ACCOUNT_ID: ACCOUNT }))
    expect(tokens).toEqual([expect.objectContaining({ name: 'CLOUDFLARE_API_TOKEN', expiresOn: '2026-10-25', daysLeft: 19 })])
    expect(notes).toEqual([expect.stringMatching(/^CLOUDFLARE_API_TOKEN expires on 2026-10-25 \(19 days\)/)])
  })

  it('flags a Cloudflare token that is not active or does not verify', async () => {
    const disabled = fakeFetch((url) =>
      url.pathname === '/client/v4/user/tokens/verify' ? json({ success: true, result: { id: 't', status: 'disabled' } }) : undefined,
    )
    expect((await checkTokens(makeCtx(disabled, { CLOUDFLARE_API_TOKEN: 'cf' }))).notes).toEqual([
      expect.stringMatching(/^CLOUDFLARE_API_TOKEN is disabled/),
    ])
    const invalid = fakeFetch(() => json({ success: false }, 401))
    expect((await checkTokens(makeCtx(invalid, { CLOUDFLARE_API_TOKEN: 'cf' }))).notes).toEqual([
      expect.stringMatching(/did not verify CLOUDFLARE_API_TOKEN/),
    ])
  })

  it("takes the Claude token's date from CLAUDE_TOKEN_EXPIRES, and says so when it's malformed", async () => {
    const ok = await checkTokens(makeCtx(fakeFetch(() => undefined), { CLAUDE_TOKEN_EXPIRES: '2026-10-30' }))
    expect(ok.tokens).toEqual([expect.objectContaining({ name: 'CLAUDE_CODE_OAUTH_TOKEN', daysLeft: 24 })])
    expect(ok.notes).toEqual([expect.stringMatching(/^CLAUDE_CODE_OAUTH_TOKEN expires on 2026-10-30 \(24 days\)\. Run `claude setup-token`/)])
    const bad = await checkTokens(makeCtx(fakeFetch(() => undefined), { CLAUDE_TOKEN_EXPIRES: 'next year' }))
    expect(bad.notes).toEqual(['The CLAUDE_TOKEN_EXPIRES variable must be a date like 2027-10-01, not "next year".'])
  })

  it('turns a failed lookup into a note, not a failure', async () => {
    const down = fakeFetch(() => {
      throw new Error('network down')
    })
    const { notes } = await checkTokens(makeCtx(down, { GITHUB_TOKEN: 'pat', TOKEN_IS_PAT: 'true', CLOUDFLARE_API_TOKEN: 'cf' }))
    expect(notes).toEqual([
      "Could not read GREENLIGHT_TOKEN's expiry (network down).",
      'Could not verify CLOUDFLARE_API_TOKEN (network down).',
    ])
  })
})
