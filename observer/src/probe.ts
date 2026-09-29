import type { Ctx, ProbeResult } from './types.ts'

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** One uptime check: /api/health must answer { ok: true } and / must answer 200. */
export async function probe(ctx: Ctx, url: string, timeoutMs: number): Promise<ProbeResult> {
  const base = url.replace(/\/+$/, '')
  const errors: string[] = []
  let healthOk = false
  let latencyMs: number | null = null
  let homeStatus: number | null = null

  const started = performance.now()
  try {
    const res = await ctx.fetch(`${base}/api/health`, { signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' })
    latencyMs = Math.round(performance.now() - started)
    const body = (await res.json().catch(() => null)) as { ok?: unknown } | null
    healthOk = res.ok && body?.ok === true
    if (!healthOk) errors.push(`/api/health: HTTP ${res.status}${body ? '' : ', not JSON'}`)
  } catch (error) {
    errors.push(`/api/health: ${message(error)}`)
  }

  try {
    const res = await ctx.fetch(`${base}/`, { signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' })
    homeStatus = res.status
    await res.arrayBuffer().catch(() => undefined)
    if (res.status !== 200) errors.push(`/: HTTP ${res.status}`)
  } catch (error) {
    errors.push(`/: ${message(error)}`)
  }

  return {
    url: base,
    at: ctx.now.toISOString(),
    ok: healthOk && homeStatus === 200,
    healthOk,
    homeStatus,
    latencyMs,
    error: errors.length ? errors.join('; ') : null,
  }
}
