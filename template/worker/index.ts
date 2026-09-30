import type { Env } from './env.ts'
import { createRouter, type Route } from './router.ts'
import { health } from './routes/health.ts'

/** Every API route. Add new ones here; handlers live in worker/routes/. */
export const routes: Route[] = [{ method: 'GET', pattern: '/api/health', handler: health }]

const api = createRouter(routes)

export default {
  fetch(request, env, ctx) {
    const { pathname } = new URL(request.url)
    // wrangler.jsonc only sends /api/* here first; anything else reaching the Worker is served from the assets.
    if (pathname === '/api' || pathname.startsWith('/api/')) return api(request, env, ctx)
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
