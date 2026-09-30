import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseConfig } from '../src/config.ts'
import { shippedConfig } from './helpers.ts'

const raw = () => JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8')) as Record<string, Record<string, unknown>>

describe('config', () => {
  it('ships a valid config.json', () => {
    const config = shippedConfig()
    expect(config.reddit.subreddits.length).toBeGreaterThan(0)
    expect(config.painPhrases.every((p) => p === p.toLowerCase())).toBe(true)
    expect(config.export.limit).toBeLessThanOrEqual(300) // the Analyst's input is Claude usage
  })

  it('rejects subreddit names with an r/ prefix', () => {
    const c = raw()
    c.reddit = { ...c.reddit, subreddits: ['r/smallbusiness'] }
    expect(() => parseConfig(c)).toThrow('reddit.subreddits: "r/smallbusiness" is not a subreddit name')
  })

  it('rejects a maxSharePerSource above 1', () => {
    const c = raw()
    c.export = { ...c.export, maxSharePerSource: 2 }
    expect(() => parseConfig(c)).toThrow('export.maxSharePerSource must be between 0 and 1')
  })

  it('rejects Stack Exchange sites given as hostnames', () => {
    const c = raw()
    c.stackexchange = { ...c.stackexchange, sites: ['softwarerecs.stackexchange.com/questions'] }
    expect(() => parseConfig(c)).toThrow('stackexchange.sites: "softwarerecs.stackexchange.com/questions" is not an API site name')
  })

  it('rejects channel patterns with an unknown source', () => {
    const c = raw()
    c.export = { ...c.export, questionChannels: ['ask_hn'] }
    expect(() => parseConfig(c)).toThrow('export.questionChannels[0]: "ask_hn" must be "source" or "source:channel"')
  })

  it('names the missing section', () => {
    const c = raw()
    delete c.github
    expect(() => parseConfig(c)).toThrow('github must be an object')
  })

  it('rejects feeds without an http(s) URL', () => {
    const c = raw()
    c.rss = { ...c.rss, feeds: [{ name: 'x', url: 'file:///etc/passwd' }] }
    expect(() => parseConfig(c)).toThrow('rss.feeds[0].url must start with http(s)://')
  })
})
