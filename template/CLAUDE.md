# CLAUDE.md: product conventions

This repo was scaffolded by **Greenlight** from its `template/` folder. `blueprint.md` is the spec.
If you are the Factory, the blueprint decides *what* to build and this file decides *how*.

## Stack (do not swap any of these)

| Concern      | Choice                                                                   |
| ------------ | ------------------------------------------------------------------------ |
| Language     | TypeScript, `strict` + `noUncheckedIndexedAccess`                        |
| UI           | React 19 + Vite                                                          |
| State        | Redux Toolkit (`createSlice`, `createAsyncThunk`, RTK Query if useful)   |
| Styling      | Tailwind CSS v4 via `@tailwindcss/vite` (utility classes, no CSS files per component) |
| Server code  | Cloudflare Pages Functions in `functions/` (same origin, under `/api`)   |
| Files        | Cloudflare R2 via the `BUCKET` binding                                   |
| Database     | MongoDB Atlas free tier (M0) via the official `mongodb` driver. D1 is the fallback, see below |
| Tests        | Vitest + Testing Library + jsdom                                         |
| Lint         | ESLint flat config (`typescript-eslint`, `react-hooks`, `react-refresh`) |
| Hosting      | Cloudflare Pages (static `dist/` + `functions/`)                         |

Don't add a router, UI kit, CSS-in-JS, ORM or state library unless `blueprint.md` names it.
If you need routing, `react-router` is the approved choice. Fewer dependencies is better.

## Folder structure

```
src/
  main.tsx            # entry: Provider + App
  App.tsx             # top-level layout
  index.css           # Tailwind import + @theme tokens (the only global CSS)
  app/store.ts        # makeStore(), RootState, AppDispatch (register slices in combineSlices)
  app/hooks.ts        # useAppDispatch / useAppSelector (always use these)
  features/<name>/    # one folder per feature: <name>Slice.ts, components, <name>.test.ts(x)
  components/         # shared presentational components (no Redux inside)
  lib/                # framework-free helpers (api.ts fetch wrapper, formatting, ...)
  test/               # setup.ts + renderWithStore helper
shared/api.ts         # request/response types shared by src/ and functions/ (types only)
functions/
  _lib/env.ts         # Env interface: bindings + secrets
  api/<route>.ts      # Pages Function per route: /api/<route> (export onRequestGet/Post/...)
public/               # static assets copied as-is
blueprint.md          # the spec (read-only for the Factory)
build-report.md       # written by the Factory at the end of a build
```

## Conventions

- Named exports everywhere except `App.tsx` and route components where a default export is required.
- Import local files with an explicit `.ts`/`.tsx` extension (`verbatimModuleSyntax` + bundler resolution).
- Use `import type` for type-only imports.
- Components: function components, props typed inline or with an `interface` next to them. No `any`.
- State: server data goes through thunks or RTK Query. Components never call `fetch` directly; use `src/lib/api.ts`.
- Styling: Tailwind utilities in `className`. Put design tokens in `@theme` in `index.css`. It must be mobile-first and have readable contrast.
- Accessibility: semantic elements, labelled inputs, `role="status"`/`alert` for async feedback. Tests query by role/label.
- Never commit secrets. Server secrets live in Cloudflare (`wrangler pages secret put`) and locally in `.dev.vars` (gitignored).
  Nothing secret goes into `import.meta.env` because Vite inlines `VITE_*` values into the public bundle.

## Server code: Pages Functions

A file `functions/api/items.ts` serves `/api/items`. Export `onRequestGet`, `onRequestPost`, etc. typed as `PagesFunction<Env>`.
Validate every request body by hand (narrow `unknown` with type guards) or with `zod` if the blueprint has more than a couple of inputs.
Return `Response.json(data, { status })`. Errors come back as `{ error: string }` with a 4xx/5xx status.

Local full-stack dev: `npm run build && npx wrangler pages dev dist` (wrangler is intentionally not a dependency; `npx` fetches it).

### R2 (files)

1. `npx wrangler r2 bucket create <product>-files`, then uncomment the `[[r2_buckets]]` block in `wrangler.toml`.
2. Upload through a Function. Don't expose the bucket publicly unless the blueprint says files are public.

```ts
// functions/api/files/[key].ts
import type { Env } from '../../_lib/env.ts'

export const onRequestPut: PagesFunction<Env, 'key'> = async ({ env, params, request }) => {
  if (!env.BUCKET) return Response.json({ error: 'storage not configured' }, { status: 503 })
  const key = String(params.key)
  await env.BUCKET.put(key, request.body, {
    httpMetadata: { contentType: request.headers.get('content-type') ?? 'application/octet-stream' },
  })
  return Response.json({ key }, { status: 201 })
}

export const onRequestGet: PagesFunction<Env, 'key'> = async ({ env, params }) => {
  const obj = await env.BUCKET?.get(String(params.key))
  if (!obj) return Response.json({ error: 'not found' }, { status: 404 })
  return new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType ?? 'application/octet-stream' } })
}
```

Free-tier limits: 10 GB storage, 1M writes and 10M reads per month. Keep uploads small (a request body is capped at 100 MB).

### MongoDB (data)

The official `mongodb` driver (**>= 6.15**) runs on Workers/Pages Functions because `node:net`/`node:tls` are
implemented and Node.js compatibility is on (`compatibility_flags = ["nodejs_compat"]`; dates >= 2026-08-04
enable it by default anyway). Rules:

- Only use it inside `functions/`, never in `src/`.
- **Create one client per request and close it.** Connections can't be reused across requests. Expect roughly 300 ms of
  connect overhead per request. That's fine for MVPs.
- Atlas M0 allows 500 connections. Keep `maxPoolSize: 1`.
- Atlas → Network Access must allow `0.0.0.0/0` because Cloudflare has no fixed egress IPs. Use a dedicated DB user with
  access to this product's database only.

```ts
// functions/_lib/db.ts
import { MongoClient, type Db } from 'mongodb'
import type { Env } from './env.ts'

export async function withDb<T>(env: Env, waitUntil: (p: Promise<unknown>) => void, fn: (db: Db) => Promise<T>): Promise<T> {
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI is not set')
  const client = new MongoClient(env.MONGODB_URI, { maxPoolSize: 1, serverSelectionTimeoutMS: 5000 })
  try {
    return await fn(client.db(env.MONGODB_DB))
  } finally {
    waitUntil(client.close())
  }
}
// usage in a Function: ({ env, waitUntil }) => withDb(env, waitUntil, (db) => db.collection('items').find().limit(50).toArray())
```

**Fallback: D1.** If the driver fails at runtime (connection errors that aren't credential problems, or bundle errors), or the
blueprint only needs simple relational data, use Cloudflare D1 (free: 5 GB, 5M rows read per day) through a `[[d1_databases]]`
binding in `wrangler.toml`, with plain SQL migrations in `migrations/`. Record the switch in `build-report.md`.

## Testing rules

- `npm test` must pass with **no network access**. Mock `fetch` with `vi.spyOn(globalThis, 'fetch')`. Never hit Atlas/R2 in tests.
- Every slice gets reducer/thunk tests. Every feature component gets at least one render + interaction test
  (`renderWithStore` from `src/test/render.tsx`, `@testing-library/user-event` for input).
- Every Function in `functions/api/` gets a test that calls the exported handler with a fake context (see `health.test.ts`).
- Each acceptance criterion in `blueprint.md` should map to at least one test. Name the test after the criterion.
- No snapshot tests. No skipped (`.skip`/`.only`) tests committed.

## Definition of done

A task is done when all of these hold:

1. `npm run check` passes: `eslint --max-warnings 0`, `vitest run`, `tsc -b && vite build`.
2. The task's acceptance criteria from `blueprint.md` are covered by tests.
3. No `any`, no `// @ts-ignore`, no `eslint-disable` without a one-line reason.
4. No new dependency that the blueprint or this file doesn't justify. `npm audit --audit-level=high` is clean.
5. No secrets, tokens or connection strings in the diff.
6. `GET /api/health` still returns `{ ok: true }` (the Publisher's smoke test depends on it).
7. Work is committed as one commit per task: `task <n>: <short title>`.

## Files the Factory must not change

`blueprint.md`, `CLAUDE.md`, `.github/**`, `wrangler.toml`'s `name`. If the blueprint looks wrong, stop and write why in
`build-report.md` under "Blockers". Don't work around it.
