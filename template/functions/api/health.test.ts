import { describe, expect, it } from 'vitest'
import type { HealthResponse } from '../../shared/api.ts'
import { onRequestGet } from './health.ts'

describe('GET /api/health', () => {
  it('returns ok and reports missing bindings', async () => {
    const ctx = { env: {} } as Parameters<typeof onRequestGet>[0]

    const res = await onRequestGet(ctx)
    const body = (await res.json()) as HealthResponse

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ ok: true, storage: false, database: false })
  })
})
