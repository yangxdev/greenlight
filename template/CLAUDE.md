# CLAUDE.md: product conventions

This repo was scaffolded by **Greenlight** from its `template/` folder. `blueprint.md` is the spec.
If you are the Factory, the blueprint decides *what* to build and this file decides *how*.

## Stack (do not swap any of these)

| Concern      | Choice                                                                   |
| ------------ | ------------------------------------------------------------------------ |
| Language     | TypeScript, `strict` + `noUncheckedIndexedAccess`                        |
| UI           | React 19 + Vite                                                          |
| State        | Redux Toolkit (`createSlice`, `createAsyncThunk`, RTK Query if useful)   |
| Styling      | Tailwind CSS v4 via `@tailwindcss/vite`, with the house-style tokens in `src/index.css` (see Look & feel) |
| Fonts, icons | Geist + Geist Mono (`@fontsource-variable`), Lucide icons via `react-icons/lu` (controls only) |
| Server code  | A Cloudflare Worker in `worker/`, serving `/api/*` on the same origin as the app |
| Files        | Cloudflare R2 via the `BUCKET` binding                                   |
| Database     | MongoDB Atlas free tier (M0) via the official `mongodb` driver. D1 is the fallback, see below |
| Tests        | Vitest + Testing Library + jsdom                                         |
| Lint, format | ESLint flat config (`typescript-eslint`, `react-hooks`, `react-refresh`) + Prettier (`npm run format`) |
| Hosting      | Cloudflare Workers with static assets (`wrangler.jsonc`: `dist/` + `worker/`), on `*.workers.dev` |

Don't add a UI kit, CSS-in-JS, icon set, font, ORM or state library. Approved when the blueprint needs them:
`react-router` (more than one screen), RTK Query (`createApi`, for server data with caching), `zod` (validating API
input), `i18next` + `react-i18next` + language detector (more than one language), and PWA basics (a web manifest and
icons in `public/`, plus a hand-written service worker only if offline use matters). Fewer dependencies is better.

## Folder structure

```
src/
  main.tsx            # entry: Provider + App
  App.tsx             # top-level layout
  index.css           # Tailwind import + @theme tokens (the only global CSS)
  app/store.ts        # makeStore(), RootState, AppDispatch (register slices in combineSlices)
  app/hooks.ts        # useAppDispatch / useAppSelector (always use these)
  app/site.ts         # SITE_NAME, SITE_TAG, SITE_DESCRIPTION: identity, page title and link previews
  features/<name>/    # one folder per feature: <name>Slice.ts, components, <name>.test.ts(x)
  components/shell/   # page structure: SiteHeader, Hero (+ Accent), Section (numbered rail), SiteFooter
  components/ui/      # house-style primitives: Button, IconButton, Checkbox, Field, Segmented, RuledList/RuledItem,
                      #   CellGrid/Cell/Stat, DetailList, Note, EmptyState, Skeleton, Mark, ThemeToggle, and styles.ts
                      #   (buttonClass, optionClass, labelClass, indexClass, chipClass, linkClass, monoClass, ...)
  components/         # other shared presentational components (no Redux inside)
  lib/                # framework-free helpers: api.ts fetch wrapper, theme.ts, cn.ts, formatting, ...
  test/               # setup.ts + renderWithStore helper
shared/api.ts         # request/response types shared by src/ and worker/ (types only)
worker/
  index.ts            # the Worker entry + the `routes` table (register every API route here)
  router.ts           # tiny router: `:params`, JSON 404/405/500
  env.ts              # Env interface: bindings + secrets
  routes/<name>.ts    # one handler module per resource, e.g. routes/items.ts
wrangler.jsonc        # Worker name, assets, bindings (never secrets)
public/               # static assets copied as-is (favicon.svg: the product's initial on vermilion)
scripts/check-style.ts  # the house-style guard, run by `npm run lint`
README.md             # the repo's front page for visitors: you fill it in (see README below)
docs/screenshots/     # screenshots of the live site, taken by the Publisher (don't edit)
blueprint.md          # the spec (read-only for the Factory)
build-report.md       # written by the Factory at the end of a build
```

## Conventions

- Named exports everywhere except `App.tsx` and route components where a default export is required.
- Import local files with an explicit `.ts`/`.tsx` extension (`verbatimModuleSyntax` + bundler resolution).
- Use `import type` for type-only imports.
- Components: function components, props typed inline or with an `interface` next to them. No `any`.
- State: server data goes through thunks or RTK Query. Components never call `fetch` directly; use `src/lib/api.ts`.
- Styling: Tailwind utilities in `className`, built from the tokens and `components/ui`. Follow **Look & feel** below.
- Accessibility: semantic elements, labelled inputs, `role="status"`/`alert` for async feedback. Tests query by role/label.
- Never commit secrets. Server secrets live in Cloudflare (`npx wrangler secret put`) and locally in `.dev.vars` (gitignored).
  Nothing secret goes into `import.meta.env` because Vite inlines `VITE_*` values into the public bundle.

## Look & feel

Products are siblings of the owner's own site, yangxdev.com, which takes its structure from sakana.ai: a page reads
like a **ruled document** (the way Japanese corporate sites are laid out), not like a template. White first, hairlines, square corners, mono for every label,
one vermilion accent, numbered sections with a left rail. The tokens in `src/index.css` and the components in
`src/components/ui/` and `src/components/shell/` encode all of it; `App.tsx` in the scaffold shows the anatomy. Build
with them rather than around them. `npm run lint` runs a style guard (`scripts/check-style.ts`) that fails on the hard
rules below.

**Why products used to look generated, and what replaces it**

| The template look (don't)                                   | The house look (do)                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| A centred narrow column of rounded cards with soft shadows  | Full-width sections on one container, each with a numbered rail (`Section`) |
| Cards stacked with gaps                                     | Rows separated by hairlines (`RuledList`), cells sharing borders (`CellGrid`) |
| Sticky header with blur, product name in plain text         | Solid header: mark, lowercase name, mono tag, mono nav (`SiteHeader`)    |
| Accent-coloured pill buttons, rounded filter chips          | One square ink button; filters as mono words over a rule (`Segmented`)   |
| Small uppercase sans captions, `text-sm` everywhere          | Uppercase mono labels (`labelClass`), a real type scale (`text-display` … `text-label`) |
| Icons in circles, emoji, gradients, illustrations           | Words and numbers (`01`, `Stat`); the small vermilion `Mark` is the logo |
| Caveats in a banner                                         | Footnotes under the claim they qualify (`Note`)                          |
| The Vite favicon                                            | The product's initial on vermilion (`public/favicon.svg`)                |

**Anatomy of every product** (one screen or three, the same parts)

1. `SiteHeader`: the mark, `SITE_NAME`, `SITE_TAG` in mono, optional mono nav (in-page anchors or the other screens).
2. `Hero`: optional mono eyebrow, a `text-display` headline with at most one word in `Accent`, a one-sentence lede,
   one `primary` action (plus at most one `ghost`), notes under it. For a tool whose job starts immediately, keep the
   hero short and put the tool in the first section right under it, not behind a click.
3. `Section`s numbered `01`, `02`, … in page order, each with a one- or two-word rail `label`. The tool itself is
   section `01`. Alternate `tone="zone"` for a section that should stand apart, never two zones in a row.
4. `SiteFooter`: mark, name, tag, a few mono links (source, "Suggest a change"), and `Note`s about the whole product
   (what it stores, what it cannot do).

**Identity** (the blueprint's "Identity" section decides it; set it in the first UI task)

- `src/app/site.ts`: `SITE_NAME` (lowercase, it is the wordmark), `SITE_TAG` (2–4 lowercase words, like sakana.ai's
  "japan-vibes LLM") and `SITE_DESCRIPTION` (one plain sentence: what it does, for whom). The build turns them into the
  page title and the description and link-preview tags (`vite.config.ts`), so never hand-edit those in `index.html`.
  The scaffold already put the product's initial in `public/favicon.svg`.
- The `Mark` and the lowercase name are the logo. Never draw an icon, a gradient blob or an illustration instead, and
  never borrow yangxdev.com's personal branding (its kanji seal, Japanese glosses, vertical labels).

**Principles**

- **Light is the default** (even on a dark system); dark is one click away (`ThemeToggle`, remembered) and must look
  as good. Check every screen in both themes.
- **One accent, 朱色 (`brand`), rationed to about eight appearances per scroll**: section indices and their short rule,
  the `Mark`, the one `Accent` word, the selected option, the lit nav item, the focus outline. **Buttons are ink, not
  brand.** Never decoration, never a second accent. `danger` / `warning` / `success` are for status only.
- **Square corners everywhere.** Status dots are the only round element (`rounded-full`). There are no radius tokens:
  `rounded-md` produces nothing and the style guard rejects it.
- **No shadows.** Separate with hairlines (`border-line`) and tone (`canvas` → `zone`). Only a dialog or drawer gets
  `shadow-(--shadow-panel)`.
- **Geist for reading, Geist Mono for structure**: every label, index, nav item, tag, chip, date, count, code, path and
  price is mono (`labelClass`, `indexClass`, `chipClass`, `monoClass`). Headings and body are Geist. No serif, no
  decorative fonts.
- **Type scale**: `text-display` (hero, once), `text-h2` (section titles), `text-h3` (row and cell titles),
  `text-lede`, `text-body`, `text-small`, `text-note`, `text-label`. Generous line height; text never sits on a grey
  card.
- **Layout**: one container (`containerClass`, `max-w-measure` inside `px-gutter`) for header, hero, sections and
  footer, so their left edges line up. Content is left-aligned; nothing is centred except inside a control.
- **Never hardcode a colour, shadow or duration.** Use tokens: `bg-canvas`, `text-muted`, `border-line`,
  `duration-(--duration-hover)`, `ease-out-soft`. Tailwind's stock palette is removed (`bg-white`, `text-gray-500`,
  `bg-indigo-600` produce nothing). If a colour sits ON another colour it needs its own token (like `on-ink`); add it to
  `index.css` in all three theme blocks.
- **Motion**: only the three durations (120ms hover, 220ms panels, 320ms reveals) and the one curve. No bounce, no
  spinners. Everything collapses under `prefers-reduced-motion` (already global).
- **No emoji, no gradients, no blur, no stock illustrations, no icons as decoration.** Icons (Lucide via
  `react-icons/lu`) are for controls only.

**Components and interaction**

- **One `primary` Button per view** (solid ink); everything else `ghost`. Destructive actions use `danger` and confirm
  first. Anything that navigates is an `<a>` styled with `buttonClass()`, never a button with an onClick.
- Lists of things (items, results, settings, steps): `RuledList` + `RuledItem`, with an index, date or category in the
  mono `meta` column and one control in `aside`. Not cards.
- Features, facts, prices: `CellGrid` with `Cell` (indexed `01`, `02`) or `Stat` (a big mono figure and a caption).
- Label/value details: `DetailList` (ruled, the label column on the `zone` band; pass `onZone` inside a zone section).
- Filters and tabs: `Segmented` (or `optionClass` for links). Tags: `chipClass`. Checkboxes: `Checkbox`.
- Forms: `Field` (mono label above, hint below, error as `role="alert"`).
- Empty states: `EmptyState` (a dashed ruled box, a title, one line, one action). Loading: `Skeleton` shaped like the
  content.
- Caveats, sources, "not verified yet": `Note` right under the thing it qualifies.
- Icon-only controls use `IconButton` with a `label`, icons `aria-hidden`, `size-4`.
- Touch targets: 36px under a mouse, 44px under a finger, via `pointer-coarse:` (already in the primitives). Never
  make that decision with a width breakpoint.
- Category colours are allowed only when scanning by type is a real task: one family with the same lightness and
  chroma, evenly spaced hues, each ≥ 4.5:1 on `canvas`, never the danger hue. Define them as tokens in `index.css`.
- Mobile first: no horizontal scroll at 320px (the rail folds into one line above the content by itself). Tabular
  numbers (`<time>` or `.tnum`) for anything that lines up.

**Voice**: plain and specific, like sakana.ai's product pages. Sentence case, no exclamation marks, no marketing
superlatives ("powerful", "seamless", "effortless", "unlock"). Say what the thing does in one line, then the facts.
State limits plainly in notes.

## README

The repo is public, and `README.md` is its front page: the first thing a visitor from a shared link or a search sees.
The scaffold's README is a skeleton; fill in every bracketed line from `blueprint.md` and the finished product:

- **The one-line description** under the title: the same sentence as `SITE_DESCRIPTION`.
- **What it does**, **How to use it** (the real flow, with the labels the page uses), **Privacy** (exactly what is
  stored and where; no claims the code doesn't back), **Contributing** (issues; for a data file, which file and what a
  good entry looks like).
- Keep **Run it locally** and **Built with** accurate if the build changed them (an R2 bucket, a MongoDB secret).
- Keep the `<!-- greenlight:live -->` and `<!-- greenlight:screenshots -->` blocks empty and their markers intact: after
  every deploy the Publisher writes the live link and screenshots of the live site (light and dark, desktop and phone)
  into them, sets the repo's website and description, and commits the images to `docs/screenshots/`.
- Same voice as the product: plain, specific, no badges wall, no emoji, no marketing superlatives.

## Server code: the Worker

`wrangler.jsonc` sends every request under `/api/*` to `worker/index.ts` first; everything else is the built SPA
(unknown paths get `index.html`, so client routes survive a reload). A route is a `{ method, pattern, handler }` entry in
`routes` in `worker/index.ts`; the handler gets `{ request, env, ctx, url, params }` and returns a `Response`.

```ts
// worker/routes/items.ts
import type { Handler } from '../router.ts'
import { errorResponse } from '../router.ts'

export const getItem: Handler = async ({ params }) => {
  const item = await findItem(params.id) // your data access
  return item ? Response.json(item) : errorResponse(404, 'not found')
}
// worker/index.ts: { method: 'GET', pattern: '/api/items/:id', handler: getItem }
```

Validate every request body by hand (narrow `unknown` with type guards) or with `zod` if the blueprint has more than a couple of inputs.
Return `Response.json(data, { status })`. Errors come back as `{ error: string }` with a 4xx/5xx status (`errorResponse`).
Request/response types that the frontend also uses live in `shared/api.ts`.

Local full stack: `npm run build && npx wrangler dev` serves the built app and the Worker together (wrangler is not a
dependency on purpose; `npx` fetches it). `npm run dev` alone runs only the Vite app, with `/api` unavailable.

### R2 (files)

1. `npx wrangler r2 bucket create <product>-files`, then uncomment `r2_buckets` in `wrangler.jsonc`.
2. Upload through the Worker. Don't expose the bucket publicly unless the blueprint says files are public.

```ts
// worker/routes/files.ts   (routes: PUT and GET '/api/files/:key')
import { errorResponse, type Handler } from '../router.ts'

export const putFile: Handler = async ({ env, params, request }) => {
  if (!env.BUCKET) return errorResponse(503, 'storage not configured')
  await env.BUCKET.put(params.key as string, request.body, {
    httpMetadata: { contentType: request.headers.get('content-type') ?? 'application/octet-stream' },
  })
  return Response.json({ key: params.key }, { status: 201 })
}

export const getFile: Handler = async ({ env, params }) => {
  const obj = await env.BUCKET?.get(params.key as string)
  if (!obj) return errorResponse(404, 'not found')
  return new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType ?? 'application/octet-stream' } })
}
```

Free-tier limits: 10 GB storage, 1M writes and 10M reads per month. Keep uploads small (a request body is capped at 100 MB).

### MongoDB (data)

The official `mongodb` driver (**>= 6.15**) runs on Workers because `node:net`/`node:tls` are implemented and Node.js
compatibility is on (`"compatibility_flags": ["nodejs_compat"]`; dates >= 2026-08-04 enable it by default anyway). Rules:

- Only use it inside `worker/`, never in `src/`.
- **Create one client per request and close it.** Connections can't be reused across requests. Expect roughly 300 ms of
  connect overhead per request. That's fine for MVPs.
- Atlas M0 allows 500 connections. Keep `maxPoolSize: 1`.
- Atlas → Network Access must allow `0.0.0.0/0` because Cloudflare has no fixed egress IPs. Use a dedicated DB user with
  access to this product's database only.

```ts
// worker/db.ts
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
// in a handler: ({ env, ctx }) => withDb(env, (p) => ctx.waitUntil(p), (db) => db.collection('items').find().limit(50).toArray())
```

**Fallback: D1.** If the driver fails at runtime (connection errors that aren't credential problems, or bundle errors), or the
blueprint only needs simple relational data, use Cloudflare D1 (free: 5 GB, 5M rows read per day) through a `[[d1_databases]]`
binding (`d1_databases` in `wrangler.jsonc`), with plain SQL migrations in `migrations/`. Record the switch in `build-report.md`.

## Testing rules

- `npm test` must pass with **no network access**. Mock `fetch` with `vi.spyOn(globalThis, 'fetch')`. Never hit Atlas/R2 in tests.
- Every slice gets reducer/thunk tests. Every feature component gets at least one render + interaction test
  (`renderWithStore` from `src/test/render.tsx`, `@testing-library/user-event` for input).
- Every API route gets a test that calls `worker.fetch` (or the handler) with a fake `env` and `ctx`, like `worker/worker.test.ts`.
- Each acceptance criterion in `blueprint.md` should map to at least one test. Name the test after the criterion.
- No snapshot tests. No skipped (`.skip`/`.only`) tests committed.

## Definition of done

A task is done when all of these hold:

1. `npm run check` passes: ESLint (`--max-warnings 0`) + Prettier check + the style guard, `vitest run`,
   `tsc -b && vite build`.
   Run `npm run format` before committing.
2. The task's acceptance criteria from `blueprint.md` are covered by tests.
3. No `any`, no `// @ts-ignore`, no `eslint-disable` without a one-line reason. No hardcoded colours: tokens only.
   The style guard passes without new `style-guard-ignore` comments unless the reason is real and written down.
4. No new dependency that the blueprint or this file doesn't justify. `npm audit --audit-level=high` is clean.
5. No secrets, tokens or connection strings in the diff.
6. `GET /api/health` still returns `{ ok: true }` (the Publisher's smoke test depends on it).
7. Work is committed as one commit per task: `task <n>: <short title>`.

## How your work is checked

Every PR gets the **Inspector**. First it runs a secret scan, `npm ci`, lint, tests, build and `npm audit`, then an AI
review against `blueprint.md` and this file. On failure the findings are posted as a PR comment and the Factory runs
again in fix mode with them in `.greenlight-run/findings.md` (a scratch folder, never committed). After 3 failed rounds
a human takes over. A pass merges the PR, and the Publisher deploys the Worker (`wrangler deploy`) and smoke-tests `/api/health`.

## Files the Factory must not change

`blueprint.md`, `CLAUDE.md`, `.github/**`, and the `name` in `wrangler.jsonc`. If the blueprint looks wrong, stop and write why in
`build-report.md` under "Blockers". Don't work around it.
