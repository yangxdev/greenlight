import type { Env } from './env.ts';

export interface RouteContext {
  request: Request;
  env: Env;
  ctx: ExecutionContext;
  url: URL;
  /** Values of `:name` segments in the route pattern, URL-decoded. */
  params: Record<string, string>;
}

export type Handler = (context: RouteContext) => Response | Promise<Response>;

export interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** e.g. `/api/items/:id`. Segments starting with `:` capture one path segment. */
  pattern: string;
  handler: Handler;
}

/** `{ error }` with a status: the one error shape every route returns. */
export const errorResponse = (status: number, error: string, headers?: HeadersInit) =>
  Response.json({ error }, { status, headers });

function match(pattern: string, pathname: string): Record<string, string> | null {
  const want = pattern.split('/').filter(Boolean);
  const got = pathname.split('/').filter(Boolean);
  if (want.length !== got.length) return null;
  const params: Record<string, string> = {};
  for (const [i, segment] of want.entries()) {
    const actual = got[i] as string;
    if (segment.startsWith(':')) {
      try {
        params[segment.slice(1)] = decodeURIComponent(actual);
      } catch {
        return null;
      }
    } else if (segment !== actual) {
      return null;
    }
  }
  return params;
}

/**
 * A deliberately tiny router: exact segments plus `:params`, 404 for unknown paths, 405 (with `Allow`) for a known
 * path with the wrong method, and a JSON 500 instead of an HTML error page when a handler throws.
 */
export function createRouter(routes: Route[]) {
  return async (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
    const url = new URL(request.url);
    const allowed: string[] = [];
    for (const route of routes) {
      const params = match(route.pattern, url.pathname);
      if (!params) continue;
      if (
        route.method !== request.method &&
        !(route.method === 'GET' && request.method === 'HEAD')
      ) {
        allowed.push(route.method);
        continue;
      }
      try {
        return await route.handler({ request, env, ctx, url, params });
      } catch (error) {
        console.error(`${request.method} ${url.pathname} failed`, error);
        return errorResponse(500, 'internal error');
      }
    }
    if (allowed.length)
      return errorResponse(405, 'method not allowed', { allow: allowed.join(', ') });
    return errorResponse(404, 'not found');
  };
}
