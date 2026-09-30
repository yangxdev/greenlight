import type { HealthResponse } from '../../shared/api.ts';
import type { Handler } from '../router.ts';

/** GET /api/health: used by the frontend, the Publisher's smoke test and the Observer's uptime probes. Keep it. */
export const health: Handler = ({ env }) => {
  const body: HealthResponse = {
    ok: true,
    time: new Date().toISOString(),
    storage: Boolean(env.BUCKET),
    database: Boolean(env.MONGODB_URI),
  };
  return Response.json(body, { headers: { 'cache-control': 'no-store' } });
};
