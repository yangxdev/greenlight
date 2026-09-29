import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { dedupeById, fromDoc, readJsonl, toUpsertOps, writeJsonl } from '../src/store.ts'
import type { Signal } from '../src/types.ts'
import { NOW } from './helpers.ts'

const signal: Signal = {
  id: 'hn:1',
  source: 'hn',
  channel: 'ask_hn',
  url: 'https://news.ycombinator.com/item?id=1',
  link: 'https://news.ycombinator.com/item?id=1',
  title: 'Ask HN: anything?',
  text: 'body',
  score: 12,
  comments: 3,
  createdAt: '2026-09-29T06:00:00.000Z',
}

describe('toUpsertOps', () => {
  it('refreshes engagement every run and sets identity fields only on insert', () => {
    expect(toUpsertOps([signal], NOW)).toEqual([
      {
        updateOne: {
          filter: { _id: 'hn:1' },
          update: {
            $set: { title: 'Ask HN: anything?', text: 'body', score: 12, comments: 3, lastSeenAt: NOW },
            $setOnInsert: {
              source: 'hn',
              channel: 'ask_hn',
              url: signal.url,
              link: signal.link,
              createdAt: new Date('2026-09-29T06:00:00.000Z'),
              firstSeenAt: NOW,
            },
          },
          upsert: true,
        },
      },
    ])
  })
})

describe('fromDoc', () => {
  it('round-trips a stored document back to a Signal', () => {
    const doc = {
      _id: signal.id,
      source: signal.source,
      channel: signal.channel,
      url: signal.url,
      link: signal.link,
      title: signal.title,
      text: signal.text,
      score: signal.score,
      comments: signal.comments,
      createdAt: new Date(signal.createdAt),
      firstSeenAt: NOW,
      lastSeenAt: NOW,
    }
    expect(fromDoc(doc)).toEqual(signal)
  })
})

describe('dedupeById', () => {
  it('keeps the last occurrence', () => {
    expect(dedupeById([signal, { ...signal, score: 99 }])).toEqual([{ ...signal, score: 99 }])
  })
})

describe('jsonl', () => {
  let dir: string | undefined
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('writes and reads records, one per line', async () => {
    dir = await mkdtemp(join(tmpdir(), 'scout-'))
    const path = join(dir, 'signals.jsonl')
    await writeJsonl(path, [signal, { ...signal, id: 'hn:2' }])
    expect(await readJsonl<Signal>(path)).toEqual([signal, { ...signal, id: 'hn:2' }])
  })

  it('reports the line number of invalid JSON', async () => {
    dir = await mkdtemp(join(tmpdir(), 'scout-'))
    const path = join(dir, 'bad.jsonl')
    await writeFile(path, '{"a":1}\n{oops\n')
    await expect(readJsonl(path)).rejects.toThrow('bad.jsonl:2: invalid JSON')
  })
})
