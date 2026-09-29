import { describe, expect, it, vi } from 'vitest'
import { makeStore } from '../../app/store.ts'
import { checkHealth, selectHealth } from './healthSlice.ts'

describe('healthSlice', () => {
  it('stores the timestamp when the API answers', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ ok: true, time: '2026-01-01T00:00:00.000Z', storage: false, database: false }),
    )
    const store = makeStore()

    await store.dispatch(checkHealth())

    expect(selectHealth(store.getState())).toEqual({ status: 'ok', checkedAt: '2026-01-01T00:00:00.000Z', error: null })
  })

  it('records an error when the API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 500 }))
    const store = makeStore()

    await store.dispatch(checkHealth())

    expect(selectHealth(store.getState()).status).toBe('error')
    expect(selectHealth(store.getState()).error).toContain('500')
  })
})
