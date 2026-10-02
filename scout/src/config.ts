import { readFile } from 'node:fs/promises'
import { SOURCE_NAMES, type FeedConfig, type ForumConfig, type ScoutConfig, type SourceName } from './types.ts'

type Json = unknown

class ConfigError extends Error {}

function obj(value: Json, path: string): Record<string, Json> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new ConfigError(`${path} must be an object`)
  return value as Record<string, Json>
}

function num(value: Json, path: string, min = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) throw new ConfigError(`${path} must be a number >= ${min}`)
  return value
}

function bool(value: Json, path: string): boolean {
  if (typeof value !== 'boolean') throw new ConfigError(`${path} must be true or false`)
  return value
}

function str(value: Json, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new ConfigError(`${path} must be a non-empty string`)
  return value
}

function strings(value: Json, path: string): string[] {
  if (!Array.isArray(value)) throw new ConfigError(`${path} must be an array of strings`)
  return value.map((v, i) => str(v, `${path}[${i}]`))
}

/** `source` or `source:channel`, where source is a real source name. */
function channelPatterns(value: Json, path: string): string[] {
  return strings(value, path).map((pattern, i) => {
    const [source, channel, extra] = pattern.split(':')
    if (!(SOURCE_NAMES as readonly string[]).includes(source ?? '') || channel === '' || extra !== undefined) {
      throw new ConfigError(`${path}[${i}]: "${pattern}" must be "source" or "source:channel" (sources: ${SOURCE_NAMES.join(', ')})`)
    }
    return pattern
  })
}

function sourceNames(value: Json, path: string): SourceName[] {
  return strings(value, path).map((name, i) => {
    if (!(SOURCE_NAMES as readonly string[]).includes(name)) {
      throw new ConfigError(`${path}[${i}]: "${name}" is not a source (sources: ${SOURCE_NAMES.join(', ')})`)
    }
    return name as SourceName
  })
}

function feeds(value: Json, path: string): FeedConfig[] {
  if (!Array.isArray(value)) throw new ConfigError(`${path} must be an array`)
  return value.map((v, i) => {
    const feed = obj(v, `${path}[${i}]`)
    const url = str(feed.url, `${path}[${i}].url`)
    if (!/^https?:\/\//.test(url)) throw new ConfigError(`${path}[${i}].url must start with http(s)://`)
    return { name: str(feed.name, `${path}[${i}].name`), url }
  })
}

function forums(value: Json, path: string): ForumConfig[] {
  if (!Array.isArray(value)) throw new ConfigError(`${path} must be an array`)
  return value.map((v, i) => {
    const forum = obj(v, `${path}[${i}]`)
    // The name is a channel, so it can't hold the ":" that separates source and channel in export patterns.
    const name = str(forum.name, `${path}[${i}].name`)
    if (!/^[a-z0-9-]+$/.test(name)) throw new ConfigError(`${path}[${i}].name must be lowercase letters, digits and dashes`)
    const url = str(forum.url, `${path}[${i}].url`)
    if (!/^https:\/\/[^/?#]+$/.test(url)) throw new ConfigError(`${path}[${i}].url must be the forum's https:// root, with no path or trailing slash`)
    return { name, url }
  })
}

/** Validate parsed JSON into a ScoutConfig. Keys starting with "_" are comments and ignored. */
export function parseConfig(raw: Json): ScoutConfig {
  const c = obj(raw, 'config')
  const hn = obj(c.hn, 'hn')
  const hnComments = obj(hn.comments, 'hn.comments')
  const reddit = obj(c.reddit, 'reddit')
  const github = obj(c.github, 'github')
  const producthunt = obj(c.producthunt, 'producthunt')
  const stackexchange = obj(c.stackexchange, 'stackexchange')
  const discourse = obj(c.discourse, 'discourse')
  const rss = obj(c.rss, 'rss')
  const exp = obj(c.export, 'export')

  const subreddits = strings(reddit.subreddits, 'reddit.subreddits')
  for (const sub of subreddits) {
    if (!/^[A-Za-z0-9_]{2,21}$/.test(sub)) throw new ConfigError(`reddit.subreddits: "${sub}" is not a subreddit name (no "r/" prefix)`)
  }
  const sites = strings(stackexchange.sites, 'stackexchange.sites')
  for (const site of sites) {
    if (!/^[a-z0-9]+(\.[a-z0-9]+)*$/.test(site)) {
      throw new ConfigError(`stackexchange.sites: "${site}" is not an API site name (softwarerecs, not softwarerecs.stackexchange.com)`)
    }
  }
  const pageSize = num(stackexchange.pageSize, 'stackexchange.pageSize', 1)
  if (pageSize > 100) throw new ConfigError('stackexchange.pageSize must be at most 100')
  const maxShare = num(exp.maxSharePerSource, 'export.maxSharePerSource')
  if (maxShare > 1) throw new ConfigError('export.maxSharePerSource must be between 0 and 1')

  return {
    userAgent: str(c.userAgent, 'userAgent'),
    lookbackHours: num(c.lookbackHours, 'lookbackHours', 1),
    maxTextLength: num(c.maxTextLength, 'maxTextLength', 100),
    retentionDays: num(c.retentionDays, 'retentionDays', 1),
    hn: {
      enabled: bool(hn.enabled, 'hn.enabled'),
      minPoints: num(hn.minPoints, 'hn.minPoints'),
      askMinPoints: num(hn.askMinPoints, 'hn.askMinPoints'),
      hitsPerPage: num(hn.hitsPerPage, 'hn.hitsPerPage', 1),
      comments: {
        enabled: bool(hnComments.enabled, 'hn.comments.enabled'),
        threadDays: num(hnComments.threadDays, 'hn.comments.threadDays', 1),
        minComments: num(hnComments.minComments, 'hn.comments.minComments'),
        maxThreads: num(hnComments.maxThreads, 'hn.comments.maxThreads', 1),
        perThread: num(hnComments.perThread, 'hn.comments.perThread', 1),
        minLength: num(hnComments.minLength, 'hn.comments.minLength'),
      },
    },
    reddit: {
      enabled: bool(reddit.enabled, 'reddit.enabled'),
      subreddits,
      limit: num(reddit.limit, 'reddit.limit', 1),
      minScore: num(reddit.minScore, 'reddit.minScore'),
    },
    github: {
      enabled: bool(github.enabled, 'github.enabled'),
      minStars: num(github.minStars, 'github.minStars'),
      createdWithinDays: num(github.createdWithinDays, 'github.createdWithinDays', 1),
      perPage: num(github.perPage, 'github.perPage', 1),
    },
    producthunt: {
      enabled: bool(producthunt.enabled, 'producthunt.enabled'),
      limit: num(producthunt.limit, 'producthunt.limit', 1),
    },
    stackexchange: {
      enabled: bool(stackexchange.enabled, 'stackexchange.enabled'),
      sites,
      minScore: num(stackexchange.minScore, 'stackexchange.minScore'),
      pageSize,
    },
    discourse: {
      enabled: bool(discourse.enabled, 'discourse.enabled'),
      forums: forums(discourse.forums, 'discourse.forums'),
      maxTopics: num(discourse.maxTopics, 'discourse.maxTopics', 1),
    },
    rss: { enabled: bool(rss.enabled, 'rss.enabled'), feeds: feeds(rss.feeds, 'rss.feeds') },
    painPhrases: strings(c.painPhrases, 'painPhrases').map((p) => p.toLowerCase()),
    export: {
      days: num(exp.days, 'export.days', 1),
      limit: num(exp.limit, 'export.limit', 1),
      maxSharePerSource: maxShare,
      maxTextLength: num(exp.maxTextLength, 'export.maxTextLength', 50),
      questionChannels: channelPatterns(exp.questionChannels, 'export.questionChannels'),
      questionBoost: num(exp.questionBoost, 'export.questionBoost'),
      dropWithoutPain: channelPatterns(exp.dropWithoutPain, 'export.dropWithoutPain'),
      contextSources: sourceNames(exp.contextSources, 'export.contextSources'),
      contextLimit: num(exp.contextLimit, 'export.contextLimit', 1),
    },
  }
}

export async function loadConfig(path: string): Promise<ScoutConfig> {
  const text = await readFile(path, 'utf8')
  try {
    return parseConfig(JSON.parse(text))
  } catch (error) {
    if (error instanceof ConfigError || error instanceof SyntaxError) throw new Error(`${path}: ${error.message}`, { cause: error })
    throw error
  }
}
