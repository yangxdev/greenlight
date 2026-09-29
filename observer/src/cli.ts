import { appendFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { loadConfig } from './config.ts'
import { buildMetrics } from './metrics.ts'
import { probe } from './probe.ts'
import { discoverProducts } from './products.ts'
import { openProbeStore, type ProbeStore } from './store.ts'
import type { Ctx } from './types.ts'

export interface Deps {
  fetch: typeof fetch
  env: Readonly<Record<string, string | undefined>>
  now: () => Date
  log: (message: string) => void
  openStore: (uri: string, dbName: string, retentionDays: number) => Promise<ProbeStore>
}

const DEFAULT_CONFIG = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'config.json')

const USAGE = `Usage:
  node src/cli.ts probe                       check every live product, store results in MongoDB (MONGODB_URI)
  node src/cli.ts metrics --out metrics.json  weekly numbers for the Observer's report

Env: GREENLIGHT_REPO (owner/name), GITHUB_TOKEN, MONGODB_URI, MONGODB_DB,
     CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (traffic, optional)`

class UsageError extends Error {}

function greenlightRepo(deps: Deps): string {
  const repo = deps.env.GREENLIGHT_REPO ?? deps.env.GITHUB_REPOSITORY
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new UsageError('set GREENLIGHT_REPO=owner/name')
  return repo
}

async function withStore<T>(deps: Deps, retentionDays: number, fn: (store: ProbeStore | null) => Promise<T>): Promise<T> {
  if (!deps.env.MONGODB_URI) return fn(null)
  const store = await deps.openStore(deps.env.MONGODB_URI, deps.env.MONGODB_DB || 'greenlight', retentionDays)
  try {
    return await fn(store)
  } finally {
    await store.close()
  }
}

async function probeCommand(args: string[], deps: Deps): Promise<number> {
  const { values } = parseArgs({ args, options: { config: { type: 'string' } }, strict: true })
  const config = await loadConfig(values.config ?? DEFAULT_CONFIG)
  const ctx: Ctx = { fetch: deps.fetch, env: deps.env, now: deps.now(), log: deps.log }
  const products = (await discoverProducts(ctx, greenlightRepo(deps))).filter((p) => p.url)
  const results = await Promise.all(
    products.map(async (p) => ({ ...(await probe(ctx, p.url as string, config.probeTimeoutMs)), issue: p.issue })),
  )
  for (const r of results) deps.log(`#${r.issue} ${r.url}: ${r.ok ? 'up' : 'DOWN'}${r.latencyMs !== null ? ` ${r.latencyMs}ms` : ''}${r.error ? ` (${r.error})` : ''}`)
  if (results.length === 0) deps.log('No live products with a URL.')
  await withStore(deps, config.probeRetentionDays, async (store) => {
    if (store) await store.insert(results)
    else deps.log('MONGODB_URI not set: results were not stored.')
  })
  // A product being down is data, not a failed run.
  return 0
}

async function metricsCommand(args: string[], deps: Deps): Promise<number> {
  const { values } = parseArgs({ args, options: { config: { type: 'string' }, out: { type: 'string' } }, strict: true })
  if (!values.out) throw new UsageError('metrics needs --out <file.json>')
  const config = await loadConfig(values.config ?? DEFAULT_CONFIG)
  const ctx: Ctx = { fetch: deps.fetch, env: deps.env, now: deps.now(), log: deps.log }
  const repo = greenlightRepo(deps)
  const metrics = await withStore(deps, config.probeRetentionDays, (store) =>
    buildMetrics({ ctx, config, greenlightRepo: repo, store }),
  )
  await writeFile(values.out, `${JSON.stringify(metrics, null, 2)}\n`)
  const summary = `${metrics.week}: ${metrics.products.length} live product(s), ${metrics.board.ideasFiledThisWeek} idea(s) filed, ${metrics.board.stuck.length} stuck, ${metrics.notes.length} data note(s)`
  deps.log(summary)
  for (const note of metrics.notes) deps.log(`note: ${note}`)
  if (deps.env.GITHUB_STEP_SUMMARY) await appendFile(deps.env.GITHUB_STEP_SUMMARY, `### Observer metrics\n\n${summary}\n`)
  return 0
}

export async function main(argv: string[], deps: Deps): Promise<number> {
  const [command, ...rest] = argv
  try {
    if (command === 'probe') return await probeCommand(rest, deps)
    if (command === 'metrics') return await metricsCommand(rest, deps)
    deps.log(USAGE)
    return command === undefined || command === '--help' || command === 'help' ? 0 : 2
  } catch (error) {
    const isArgError = error instanceof Error && 'code' in error && String(error.code).startsWith('ERR_PARSE_ARGS')
    if (error instanceof UsageError || isArgError) {
      deps.log(`error: ${(error as Error).message}\n\n${USAGE}`)
      return 2
    }
    throw error
  }
}

const entry = process.argv[1]
if (entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href) {
  process.exitCode = await main(process.argv.slice(2), {
    fetch: globalThis.fetch,
    env: process.env,
    now: () => new Date(),
    log: (message) => console.error(message),
    openStore: openProbeStore,
  })
}
