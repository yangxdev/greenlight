import { MongoClient, MongoServerError, type Db } from 'mongodb'
import type { ProbeResult } from './types.ts'

const COLLECTION = 'probes'
const TTL_INDEX = 'ttl_at'

interface ProbeDoc extends Omit<ProbeResult, 'at'> {
  issue: number
  at: Date
}

export interface ProbeStore {
  insert(results: (ProbeResult & { issue: number })[]): Promise<void>
  uptime(url: string, start: Date, end: Date): Promise<{ checks: number; ok: number }>
  close(): Promise<void>
}

export function toProbeDocs(results: (ProbeResult & { issue: number })[]): ProbeDoc[] {
  return results.map((r) => ({ ...r, at: new Date(r.at) }))
}

async function ensureIndexes(db: Db, retentionDays: number): Promise<void> {
  const col = db.collection<ProbeDoc>(COLLECTION)
  const expireAfterSeconds = Math.round(retentionDays * 86_400)
  try {
    await col.createIndex({ at: 1 }, { name: TTL_INDEX, expireAfterSeconds })
  } catch (error) {
    if (!(error instanceof MongoServerError) || error.code !== 85) throw error
    await db.command({ collMod: COLLECTION, index: { name: TTL_INDEX, expireAfterSeconds } })
  }
  await col.createIndex({ url: 1, at: -1 })
}

export async function openProbeStore(uri: string, dbName: string, retentionDays: number): Promise<ProbeStore> {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000, appName: 'greenlight-observer' })
  await client.connect()
  const db = client.db(dbName)
  await ensureIndexes(db, retentionDays)
  const col = db.collection<ProbeDoc>(COLLECTION)
  return {
    async insert(results) {
      if (results.length) await col.insertMany(toProbeDocs(results))
    },
    async uptime(url, start, end) {
      const range = { url, at: { $gte: start, $lt: end } }
      const [checks, ok] = await Promise.all([col.countDocuments(range), col.countDocuments({ ...range, ok: true })])
      return { checks, ok }
    },
    close: () => client.close(),
  }
}
