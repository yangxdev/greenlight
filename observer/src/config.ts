import { readFile } from 'node:fs/promises'
import type { ObserverConfig } from './types.ts'

const HEX32 = /^[a-f0-9]{32}$/i

export function parseConfig(raw: unknown): ObserverConfig {
  if (typeof raw !== 'object' || raw === null) throw new Error('config must be an object')
  const c = raw as Record<string, unknown>
  const siteTags = c.siteTags ?? {}
  if (typeof siteTags !== 'object' || siteTags === null || Array.isArray(siteTags)) throw new Error('siteTags must be an object')
  for (const [host, tag] of Object.entries(siteTags)) {
    if (typeof tag !== 'string' || !HEX32.test(tag)) throw new Error(`siteTags["${host}"] must be a 32-character hex site tag`)
  }
  const positive = (key: string, fallback: number) => {
    const value = c[key] ?? fallback
    if (typeof value !== 'number' || !(value > 0)) throw new Error(`${key} must be a positive number`)
    return value
  }
  return {
    siteTags: siteTags as Record<string, string>,
    probeTimeoutMs: positive('probeTimeoutMs', 15_000),
    probeRetentionDays: positive('probeRetentionDays', 35),
  }
}

export async function loadConfig(path: string): Promise<ObserverConfig> {
  try {
    return parseConfig(JSON.parse(await readFile(path, 'utf8')))
  } catch (error) {
    throw new Error(`${path}: ${(error as Error).message}`, { cause: error })
  }
}
