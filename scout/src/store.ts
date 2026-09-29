import { readFile, writeFile } from 'node:fs/promises'
import { MongoClient, MongoServerError, type AnyBulkWriteOperation, type Db } from 'mongodb'
import type { Signal } from './types.ts'

export const COLLECTION = 'signals'
const TTL_INDEX = 'ttl_firstSeenAt'

/** MongoDB shape: `_id` is the signal id; dates are real Dates so TTL and range queries work. */
export interface SignalDoc extends Omit<Signal, 'id' | 'createdAt'> {
  _id: string
  createdAt: Date
  firstSeenAt: Date
  lastSeenAt: Date
}

/**
 * Upsert operations. Engagement and text refresh on every run; identity fields and `firstSeenAt`
 * are only written on insert, so re-fetching the same thread never creates a duplicate.
 */
export function toUpsertOps(signals: Signal[], now: Date): AnyBulkWriteOperation<SignalDoc>[] {
  return signals.map((s) => ({
    updateOne: {
      filter: { _id: s.id },
      update: {
        $set: { title: s.title, text: s.text, score: s.score, comments: s.comments, lastSeenAt: now },
        $setOnInsert: {
          source: s.source,
          channel: s.channel,
          url: s.url,
          link: s.link,
          createdAt: new Date(s.createdAt),
          firstSeenAt: now,
        },
      },
      upsert: true,
    },
  }))
}

export function fromDoc(doc: SignalDoc): Signal {
  return {
    id: doc._id,
    source: doc.source,
    channel: doc.channel,
    url: doc.url,
    link: doc.link,
    title: doc.title,
    text: doc.text,
    score: doc.score,
    comments: doc.comments,
    createdAt: doc.createdAt.toISOString(),
  }
}

/** Keep only the last occurrence of each id (later fetches carry fresher engagement). */
export function dedupeById(signals: Signal[]): Signal[] {
  return [...new Map(signals.map((s) => [s.id, s])).values()]
}

async function ensureIndexes(db: Db, retentionDays: number): Promise<void> {
  const col = db.collection<SignalDoc>(COLLECTION)
  const expireAfterSeconds = Math.round(retentionDays * 86_400)
  try {
    await col.createIndex({ firstSeenAt: 1 }, { name: TTL_INDEX, expireAfterSeconds })
  } catch (error) {
    // IndexOptionsConflict: retentionDays changed since the index was created.
    if (!(error instanceof MongoServerError) || error.code !== 85) throw error
    await db.command({ collMod: COLLECTION, index: { name: TTL_INDEX, expireAfterSeconds } })
  }
  await col.createIndex({ createdAt: -1 })
  await col.createIndex({ source: 1, createdAt: -1 })
}

export interface Store {
  upsert(signals: Signal[], now: Date): Promise<{ inserted: number; updated: number }>
  since(date: Date): Promise<Signal[]>
  close(): Promise<void>
}

export async function openMongoStore(uri: string, dbName: string, retentionDays: number): Promise<Store> {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000, appName: 'greenlight-scout' })
  await client.connect()
  const db = client.db(dbName)
  await ensureIndexes(db, retentionDays)
  const col = db.collection<SignalDoc>(COLLECTION)
  return {
    async upsert(signals, now) {
      if (signals.length === 0) return { inserted: 0, updated: 0 }
      const res = await col.bulkWrite(toUpsertOps(dedupeById(signals), now), { ordered: false })
      return { inserted: res.upsertedCount, updated: res.modifiedCount }
    },
    async since(date) {
      const docs = await col.find({ createdAt: { $gte: date } }).toArray()
      return docs.map((doc) => fromDoc(doc as SignalDoc))
    },
    close: () => client.close(),
  }
}

export async function writeJsonl(path: string, records: readonly object[]): Promise<void> {
  await writeFile(path, records.map((r) => JSON.stringify(r)).join('\n') + (records.length ? '\n' : ''), 'utf8')
}

export async function readJsonl<T>(path: string): Promise<T[]> {
  const text = await readFile(path, 'utf8')
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line, i) => {
      try {
        return JSON.parse(line) as T
      } catch {
        throw new Error(`${path}:${i + 1}: invalid JSON`)
      }
    })
}
