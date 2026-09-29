import type { HealthResponse } from '../../shared/api.ts'
import type { Env } from '../_lib/env.ts'

/** GET /api/health: used by the frontend and by the Publisher's smoke test. */
export const onRequestGet: PagesFunction<Env> = ({ env }) => {
  const body: HealthResponse = {
    ok: true,
    time: new Date().toISOString(),
    storage: Boolean(env.BUCKET),
    database: Boolean(env.MONGODB_URI),
  }
  return Response.json(body)
}
