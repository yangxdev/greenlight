import { appendFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { loadConfig } from './config.ts'
import { contextSignals, isDroppedNoise, rankSignals } from './rank.ts'
import { SOURCES } from './sources/index.ts'
import { dedupeById, openMongoStore, readJsonl, writeJsonl, type Store } from './store.ts'
import { SOURCE_NAMES, type FetchContext, type Signal, type SourceName } from './types.ts'

export interface Deps {
  fetch: typeof fetch
  env: Readonly<Record<string, string | undefined>>
  now: () => Date
  sleep: (ms: number) => Promise<void>
  log: (message: string) => void
  openStore: (uri: string, dbName: string, retentionDays: number) => Promise<Store>
}

const DEFAULT_CONFIG = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'config.json')

const USAGE = `Usage:
  node src/cli.ts fetch  [--sources hn,reddit,github,producthunt,stackexchange,rss] [--days N] [--out signals.jsonl] [--config config.json]
  node src/cli.ts export --out analyst-input.jsonl [--context-out competition.jsonl] [--days N] [--limit N] [--from signals.jsonl] [--config config.json]

fetch  stores signals in MongoDB (MONGODB_URI, MONGODB_DB), or in a JSONL file with --out.
       --days N looks back N days instead of lookbackHours, for a one-off backfill.
export ranks recent signals for the Analyst, from MongoDB or from a JSONL file with --from. Launches and new
       projects (export.contextSources) stay out of it; --context-out writes them to a separate competition file.`

class UsageError extends Error {}

function parseSources(value: string | undefined): SourceName[] | null {
  if (value === undefined) return null
  const names = value.split(',').map((s) => s.trim()).filter(Boolean)
  for (const name of names) {
    if (!(SOURCE_NAMES as readonly string[]).includes(name)) throw new UsageError(`unknown source "${name}"`)
  }
  return names as SourceName[]
}

function positiveInt(value: string | undefined, flag: string): number | undefined {
  if (value === undefined) return undefined
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) throw new UsageError(`${flag} must be a positive integer`)
  return n
}

async function stepSummary(deps: Deps, markdown: string): Promise<void> {
  if (deps.env.GITHUB_STEP_SUMMARY) await appendFile(deps.env.GITHUB_STEP_SUMMARY, `${markdown}\n`)
}

async function fetchCommand(args: string[], deps: Deps): Promise<number> {
  const { values } = parseArgs({
    args,
    options: { config: { type: 'string' }, sources: { type: 'string' }, out: { type: 'string' }, days: { type: 'string' } },
    strict: true,
  })
  const config = await loadConfig(values.config ?? DEFAULT_CONFIG)
  const requested = parseSources(values.sources)
  const uri = deps.env.MONGODB_URI
  if (!values.out && !uri) throw new UsageError('set MONGODB_URI or pass --out <file.jsonl>')
  // A one-off backfill. HN and Stack Exchange page back that far; Product Hunt stops at its limit, feeds only
  // carry recent items, and GitHub keeps its own createdWithinDays window.
  const days = positiveInt(values.days, '--days')
  if (days !== undefined) {
    deps.log(`looking back ${days} days instead of ${config.lookbackHours} hours`)
    config.lookbackHours = days * 24
  }

  const selected = SOURCE_NAMES.filter((name) => config[name].enabled && (!requested || requested.includes(name)))
  for (const name of requested ?? []) {
    if (!config[name].enabled) deps.log(`${name}: disabled in config, skipping`)
  }

  const now = deps.now()
  const ctx: FetchContext = { fetch: deps.fetch, now, config, env: deps.env, sleep: deps.sleep, log: deps.log }
  const results = await Promise.allSettled(selected.map((name) => SOURCES[name].fetch(ctx)))

  const rows: { name: SourceName; count: number; error: string | null }[] = []
  const all: Signal[] = []
  results.forEach((result, i) => {
    const name = selected[i] as SourceName
    if (result.status === 'fulfilled') {
      rows.push({ name, count: result.value.length, error: null })
      all.push(...result.value)
    } else {
      const message = result.reason instanceof Error ? result.reason.message : String(result.reason)
      rows.push({ name, count: 0, error: message })
      if (deps.env.GITHUB_ACTIONS) deps.log(`::warning title=Scout source ${name} failed::${message}`)
    }
  })
  for (const row of rows) deps.log(`${row.name}: ${row.error ? `FAILED (${row.error})` : `${row.count} signals`}`)

  const signals = dedupeById(all)
  let stored: string
  if (values.out) {
    await writeJsonl(values.out, signals)
    stored = `wrote ${signals.length} signals to ${values.out}`
  } else {
    const store = await deps.openStore(uri as string, deps.env.MONGODB_DB || 'greenlight', config.retentionDays)
    try {
      const { inserted, updated } = await store.upsert(signals, now)
      stored = `MongoDB: ${inserted} new, ${updated} updated (${signals.length} fetched)`
    } finally {
      await store.close()
    }
  }
  deps.log(stored)

  const table = rows.map((r) => `| ${r.name} | ${r.error ? '❌' : '✅'} | ${r.count} | ${r.error ?? ''} |`).join('\n')
  await stepSummary(deps, `### Scout fetch\n\n| Source | OK | Signals | Error |\n|---|---|---|---|\n${table}\n\n${stored}\n`)

  const failed = rows.filter((r) => r.error).length
  return selected.length > 0 && failed === selected.length ? 1 : 0
}

async function exportCommand(args: string[], deps: Deps): Promise<number> {
  const { values } = parseArgs({
    args,
    options: {
      config: { type: 'string' },
      out: { type: 'string' },
      from: { type: 'string' },
      days: { type: 'string' },
      limit: { type: 'string' },
      'context-out': { type: 'string' },
    },
    strict: true,
  })
  if (!values.out) throw new UsageError('export needs --out <file.jsonl>')
  const config = await loadConfig(values.config ?? DEFAULT_CONFIG)
  const days = positiveInt(values.days, '--days') ?? config.export.days
  const limit = positiveInt(values.limit, '--limit') ?? config.export.limit
  const since = new Date(deps.now().getTime() - days * 86_400_000)

  let signals: Signal[]
  if (values.from) {
    signals = (await readJsonl<Signal>(values.from)).filter((s) => new Date(s.createdAt) >= since)
  } else {
    const uri = deps.env.MONGODB_URI
    if (!uri) throw new UsageError('set MONGODB_URI or pass --from <file.jsonl>')
    const store = await deps.openStore(uri, deps.env.MONGODB_DB || 'greenlight', config.retentionDays)
    try {
      signals = await store.since(since)
    } finally {
      await store.close()
    }
  }

  const rankOptions = {
    limit,
    maxSharePerSource: config.export.maxSharePerSource,
    maxTextLength: config.export.maxTextLength,
    painPhrases: config.painPhrases,
    questionChannels: config.export.questionChannels,
    questionBoost: config.export.questionBoost,
    dropWithoutPain: config.export.dropWithoutPain,
  }
  const contextSources = config.export.contextSources
  const isContext = (s: Signal) => contextSources.includes(s.source)
  const problems = signals.filter((s) => !isContext(s))
  const ranked = rankSignals(problems, rankOptions)
  const noise = problems.filter((s) => isDroppedNoise(s, rankOptions)).length
  await writeJsonl(values.out, ranked)

  let contextNote = ''
  const contextOut = values['context-out']
  if (contextSources.length > 0) {
    const context = contextSignals(signals.filter(isContext), {
      limit: config.export.contextLimit,
      maxTextLength: config.export.maxTextLength,
    })
    if (contextOut) await writeJsonl(contextOut, context)
    contextNote = `; ${context.length} launches and new projects (${contextSources.join('/')}) kept out as competition context${contextOut ? ` in ${contextOut}` : ''}`
  }

  const bySource = SOURCE_NAMES.filter((name) => !contextSources.includes(name))
    .map((name) => `${name} ${ranked.filter((s) => s.source === name).length}`)
    .join(', ')
  const approxTokens = Math.round(ranked.reduce((n, s) => n + JSON.stringify(s).length, 0) / 4)
  const skipped = noise > 0 ? `; ${noise} skipped as ${config.export.dropWithoutPain.join('/')} without a pain phrase` : ''
  const summary = `exported ${ranked.length} of ${problems.length} signals from the last ${days} days (${bySource}${skipped}), about ${approxTokens} tokens, to ${values.out}${contextNote}`
  deps.log(summary)
  await stepSummary(deps, `### Scout export\n\n${summary}\n`)
  return 0
}

export async function main(argv: string[], deps: Deps): Promise<number> {
  const [command, ...rest] = argv
  try {
    if (command === 'fetch') return await fetchCommand(rest, deps)
    if (command === 'export') return await exportCommand(rest, deps)
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
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    log: (message) => console.error(message),
    openStore: openMongoStore,
  })
}
