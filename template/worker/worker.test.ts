// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { HealthResponse } from '../shared/api.ts';
import type { Env } from './env.ts';
import worker from './index.ts';
import { createRouter } from './router.ts';

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
  props: {},
} as unknown as ExecutionContext;
const assets = {
  fetch: vi.fn(
    async () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }),
  ),
};
const env = { ASSETS: assets } as unknown as Env;
type IncomingRequest = Parameters<typeof worker.fetch>[0];
const call = (path: string, init?: RequestInit) =>
  worker.fetch(new Request(`https://app.example${path}`, init) as IncomingRequest, env, ctx);

describe('worker', () => {
  it('GET /api/health returns ok and reports missing bindings', async () => {
    const res = await call('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = (await res.json()) as HealthResponse;
    expect(body).toMatchObject({ ok: true, storage: false, database: false });
  });

  it('answers unknown API paths with JSON 404, never the SPA shell', async () => {
    const res = await call('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not found' });
  });

  it('hands everything outside /api to the static assets', async () => {
    const res = await call('/some/client/route');
    expect(await res.text()).toBe('<!doctype html>');
    expect(assets.fetch).toHaveBeenCalledOnce();
  });
});

describe('createRouter', () => {
  it('captures :params, rejects wrong methods with 405 + Allow, and turns throws into JSON 500', async () => {
    const api = createRouter([
      {
        method: 'GET',
        pattern: '/api/items/:id',
        handler: ({ params }) => Response.json({ id: params.id }),
      },
      {
        method: 'DELETE',
        pattern: '/api/items/:id',
        handler: () => {
          throw new Error('boom');
        },
      },
    ]);
    const req = (method: string, path: string) =>
      new Request(`https://app.example${path}`, { method });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(await (await api(req('GET', '/api/items/a%20b'), env, ctx)).json()).toEqual({
      id: 'a b',
    });
    expect((await api(req('HEAD', '/api/items/1'), env, ctx)).status).toBe(200);

    const wrong = await api(req('POST', '/api/items/1'), env, ctx);
    expect(wrong.status).toBe(405);
    expect(wrong.headers.get('allow')).toBe('GET, DELETE');

    const failed = await api(req('DELETE', '/api/items/1'), env, ctx);
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: 'internal error' });

    expect((await api(req('GET', '/api/items/1/extra'), env, ctx)).status).toBe(404);
  });
});
