# Greenlight

A personal pipeline that turns internet signals into small shipped web products, mostly run by AI agents,
on €0 beyond a Claude Pro plan. Everything runs on personal accounts using only free tiers: GitHub
(Issues, Projects, Actions), Cloudflare Pages/Workers/R2, and MongoDB Atlas M0.

```
 Scout ──► Analyst ──► Critic ──► Board ──► Architect ──► Factory ──► Inspector ──► Publisher ──► Observer
 (scripts)   (AI)       (AI)     (issues)     (AI)          (AI)      (AI+checks)    (no AI)        (AI)
                                    ▲    human gates:  approved      blueprint-ok                    │
                                    └────────────────────── weekly-report.md ◄────────────────────────┘
```

Stages hand off through **markdown files and labels, not chat**: idea cards (`templates/idea.md`), blueprints
(`templates/blueprint.md`), build reports (`template/.github/build-report.md`) and weekly reports
(`templates/weekly-report.md`). `compass.md` holds interests, stack, no-go list and the meaning of "good".
The Analyst, Critic and Architect read it.

## Status

| Phase | Actors | Status |
|-------|--------|--------|
| 1 | Board, Architect, Factory, product template | **built** |
| 2 | Inspector, Factory fix loop, Publisher | **built** |
| 3 | Scout | **built** (daily fetch + ranked export) |
| 3 | Analyst, Critic | **built** (weekly `ideas.yml`) |
| 4 | Observer | **built** (6-hourly uptime probes + weekly `observer.yml`) |

## Label state machine

Each idea issue carries exactly one state label. Two transitions are human gates (🧑).

```
idea ──🧑──► approved ──Architect──► blueprint-ready ──🧑──► blueprint-ok ──dispatch──► building
                                                                                          │
      Factory PR ──► Inspector ──pass──► merge ──► Publisher (deploy + smoke test) ──► live
                        │  ▲
                   fail │  │ fix push (max 3 rounds)
                        ▼  │
                      Factory fix ── rounds exhausted / any automated step fails ──► stuck
any state ──🧑──► archived
```

| Label | Set by | Meaning / what happens next |
|-------|--------|-----------------------------|
| `idea` | issue template (you) · Critic (`ideas.yml`, weekly) | Idea card waiting for review |
| `approved` | **you** | `architect.yml` creates the product repo, writes `blueprint.md`, comments the link |
| `blueprint-ready` | Architect | Review/edit `blueprint.md` in the product repo |
| `blueprint-ok` | **you** | `factory-dispatch.yml` checks nothing else is `building`, then triggers the product's Factory |
| `building` | factory-dispatch | The Factory is implementing the blueprint. **Only one issue at a time.** |
| `live` | Publisher | Deployed to `*.pages.dev` and `/api/health` answered `{ ok: true }` |
| `stuck` | any workflow | Automation gave up. The issue comment links the failed run or PR |
| `archived` | you · Observer suggestion | Dropped or retired. Close the issue too |

Retry anything by removing and re-adding the gate label (`approved` or `blueprint-ok`). A stuck PR can be fixed by
hand: push to its `factory/*` branch and the Inspector re-runs. If it passes, it merges and the Publisher clears `stuck`.
To regenerate a blueprint, comment your feedback on the issue (your comments are passed to the Architect) and re-apply `approved`.

## Repo layout

```
compass.md                  your interests, stack, no-go list, definition of "good"
templates/                  idea.md, blueprint.md, weekly-report.md (handoff formats)
.claude/agents/             analyst.md, critic.md, architect.md, observer.md (role prompts)
.github/ISSUE_TEMPLATE/     idea.yml (hand-write ideas)
.github/workflows/
  setup-labels.yml          run once: creates the state labels
  architect.yml             on label "approved"
  factory-dispatch.yml      on label "blueprint-ok"
  template-ci.yml           keeps template/ lint/test/build green
  scout.yml                 daily: pull signals into MongoDB (or a JSONL artifact without it)
  uptime.yml                every 6h: probe live products, store history in MongoDB
  observer.yml              weekly: metrics -> Observer report + per-product verdicts
  scripts-ci.yml            keeps scout/ and observer/ typechecked, linted, tested
  ideas.yml                 weekly: Analyst + Critic -> analysis/<date>*.md, at most 3 `idea` issues
analysis/                   weekly idea cards and Critic verdicts, committed by ideas.yml
observer/                   Observer data scripts: uptime probes, Web Analytics, weekly metrics.json (see observer/README.md)
reports/                    weekly reports (<week>.md) and verdicts (<week>.json), committed by observer.yml
scout/                      Scout: HN, Reddit, GitHub, Product Hunt, RSS fetchers + ranked export (see scout/README.md)
  config.json               subreddits, feeds, thresholds, pain phrases
template/                   product skeleton copied into every new product repo
  CLAUDE.md                 stack conventions, R2/Mongo usage, testing rules, definition of done
  src/ functions/ shared/   Vite + React + RTK + Tailwind + TS app, Pages Functions, shared types
  .github/workflows/
    factory.yml             build from blueprint / fix from Inspector findings
    inspector.yml           checks + AI review on every PR, merge or send back
    deploy.yml              Publisher: Cloudflare Pages deploy, smoke test, "live"
  .github/build-report.md
```

**Why `template/` is a folder, not a GitHub template repo:** the Architect already checks out greenlight, so copying a
folder costs nothing, and template changes land in the same PR as workflow changes that depend on them.
`template-ci.yml` keeps it green. A template repo would only add the "Use this template" button, which nothing here uses.
In both setups, existing products don't receive later template changes. That's intended, because each product is a
snapshot.

## How it works

0. **Scout** (`scout.yml`, daily, no AI) stores signals. **Ideas** (`ideas.yml`, Mondays):
   - `export` (no AI) takes the ranked Scout export (about 150 signals) and the existing idea titles;
   - the **Analyst** (AI, about 20 turns) writes idea cards to `analysis/<date>.md`;
   - the **Critic** (AI, fresh context, about 15 turns) checks the cards' evidence against the signals and scores them
     on the compass rubric. It writes `analysis/<date>-critic.md` and returns a JSON verdict;
   - `publish` (no AI) commits `analysis/` and files at most `CRITIC_MAX_IDEAS` (3) issues scoring at least
     `CRITIC_MIN_SCORE` (14/20), skipping titles that already exist and defusing @mentions.
   It never adds `approved`, and bot-filed issues trigger nothing.
1. **You** review the `idea` issues, or write your own with the *Idea* form, and add `approved` to the ones you want.
2. **Architect** (`architect.yml`, about 20 turns max), in three jobs:
   - `scaffold` (no AI) creates `<you>/<slugified-title>` (private by default) from `template/`, replacing the
     `greenlight-product` placeholder with the repo name. It copies `CLAUDE_CODE_OAUTH_TOKEN`, `GREENLIGHT_TOKEN` and,
     if present, the Cloudflare secrets into the product repo, and sets the variables `GREENLIGHT_REPO`/`GREENLIGHT_ISSUE`;
   - `blueprint` (AI): Claude reads `compass.md`, the issue (plus your comments) and `templates/blueprint.md`, and
     writes only `blueprint.md`, which leaves the job as an artifact;
   - `publish` (no AI) checks the blueprint (required sections, 1–10 tasks), commits it, comments the link with a
     `<!-- greenlight:repo=owner/name -->` marker, and sets the label to `blueprint-ready`.
3. **You** review `blueprint.md` in the product repo (edit it freely) and add `blueprint-ok`.
4. **Factory dispatch** (`factory-dispatch.yml`, no AI) refuses if another issue is `building`, otherwise sends
   `repository_dispatch: greenlight-build` to the product repo and sets the label to `building`.
5. **Factory** (`factory.yml` in the product repo, about 80 turns max). Claude implements the tasks in order, runs
   `npm run check` after each, commits `task N: …`, and writes `build-report.md`. The commits leave the AI job as a
   git bundle. A fresh `verify` job re-runs lint/test/build/audit. `publish` blocks edits to `.github/`, `blueprint.md`
   and `CLAUDE.md`, pushes `factory/build-N`, and opens a PR (a draft if incomplete) with the build report as its body.
6. **Inspector** (`inspector.yml`, on every PR):
   - `checks` (no AI): gitleaks secret scan, `npm ci`, lint, test, build, `npm audit --audit-level=high`;
   - `review` (AI, about 25 turns, only if all checks pass): Claude compares the diff with the blueprint's tasks and
     acceptance criteria and CLAUDE.md's definition of done. It returns a JSON verdict (`--json-schema`) with read-only tools;
   - `decide` (no AI) posts the verdict as a PR comment. On **pass** it merges (squash); set `AUTO_MERGE=false` to merge
     yourself. On **fail** it dispatches `greenlight-fix`, and the Factory reads the findings comment, fixes, and pushes
     to the same branch, which re-triggers the Inspector. After `INSPECTOR_MAX_ROUNDS` (3) failed fix rounds, or if
     the AI review can't finish (e.g. usage limit), the issue becomes `stuck`.
7. **Publisher** (`deploy.yml`, on push to `main`, no AI): builds, creates the Pages project on first deploy, runs
   `wrangler pages deploy`, smoke-tests `https://<project>.pages.dev/api/health` and `/`, comments the live URL, and
   sets `live`. Pushes before the product is built (scaffold, blueprint) are skipped, and so is everything if the
   Cloudflare secrets are missing.
8. **Observer**:
   - `uptime.yml` (every 6 hours, no AI) probes each `live` product's `/api/health` and `/` and stores the result in
     MongoDB, kept 35 days;
   - `observer.yml` (Mondays, before Ideas) collects the week's uptime, Cloudflare Web Analytics visits (this week vs
     last), each blueprint's success metric and the board state;
   - Claude writes `reports/<week>.md` with a keep, improve or archive verdict per product;
   - a shell job commits it and comments the summary on the **Greenlight weekly reports** issue. It comments on a
     product's issue only when its verdict changes, and never touches labels;
   - the next Analyst run reads the report's "Signals for the Analyst". With nothing live, the AI step is skipped and a
     board-only report is written instead.

Things the Factory can't do for you are listed under "Manual setup required" in the PR's build report: creating an R2
bucket, `wrangler pages secret put MONGODB_URI`, and Atlas network access.

### Usage limits

The Pro plan's usage limits are the real budget:

- **One build at a time.** factory-dispatch checks the `building` label.
- **Every agent has `--max-turns`:** `ARCHITECT_MAX_TURNS` (20), `FACTORY_MAX_TURNS` (80), `FIX_MAX_TURNS` (40),
  `INSPECTOR_MAX_TURNS` (25). At most `INSPECTOR_MAX_ROUNDS` (3) fix rounds per PR. Every job also has a `timeout-minutes`.
  Worst case per product is about 1 Architect + 1 build + 4 reviews + 3 fixes.
- **Weekly idea generation is two short runs:** the Analyst (about 20 turns over about 30k tokens of signals) and the
  Critic (about 15 turns). With no Scout signals, both are skipped.
- **The weekly Observer is one short run** (about 12 turns over a small `metrics.json`), and it's skipped while nothing is live.
  `uptime.yml` exits in seconds when MongoDB isn't set or nothing is live. Otherwise it costs about 4 × 1 billed minute a day.
- **The AI review only runs when deterministic checks pass.** A red check goes back to the Factory with the log, without
  spending a review.
- **No AI in deterministic steps.** Repo creation, secrets, validation, checks, pushes, PRs and labels are all shell.
- **GitHub Actions minutes:** private repos get 2,000 free minutes a month and public repos are unlimited. A Factory run
  can take up to 90 minutes. If minutes get tight, set `PRODUCT_VISIBILITY=public` (secrets stay secret either way).

### Security model

Every workflow that runs Claude is split into jobs, so **no AI job and no job that runs repository code ever shares
a runner with `GREENLIGHT_TOKEN` or the Cloudflare token.** Within one job, code can poison later steps (for example
through `$GITHUB_ENV`), so jobs are the security boundary here, not steps.

| Workflow | AI / repo-code jobs (no PAT) | Credentialed jobs (no AI, no repo code) |
|----------|------------------------------|-----------------------------------------|
| Ideas | `analyst`, `critic` (artifacts + JSON verdict out) | `export` (MongoDB), `publish` (`GITHUB_TOKEN` only) |
| Observer | `report` (report + JSON verdicts out) | `metrics` (PAT read, Cloudflare, MongoDB), `publish` (`GITHUB_TOKEN` only) |
| Architect | `blueprint` (artifact out: blueprint.md) | `scaffold`, `publish` |
| Factory | `agent` (git bundle out), `verify` | `prepare`, `publish` |
| Inspector | `checks`, `review` (JSON verdict out) | `decide` |
| Publisher | `build` (dist/ out) | `gate`, `deploy` (`npm ci --ignore-scripts`, wrangler installed outside the repo), `report` |

- Claude gets the job's short-lived, read-only `GITHUB_TOKEN`. Pushes use the PAT with `core.hooksPath=/dev/null`.
- Gate labels only trigger when you apply them (`github.actor == github.repository_owner`).
- Remaining exposure: the Factory's `agent` job runs code Claude writes (`npm run …`), and that job holds
  `CLAUDE_CODE_OAUTH_TOKEN`. The worst case is someone using your Claude quota. Rotate it with `claude setup-token`
  if you ever suspect that, and keep ideas from the open internet (phase 3) behind your `approved` gate.

## One-time setup

### 1. Claude OAuth token (Pro plan)

On your machine, logged in to your **personal** Claude account:

```bash
claude setup-token        # prints a long-lived OAuth token for your Pro subscription
```

### 2. GitHub fine-grained PAT (`GREENLIGHT_TOKEN`)

GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
Use your **personal** account.

- **Resource owner:** your personal account
- **Expiration:** up to 1 year (set a calendar reminder)
- **Repository access:** *All repositories*. This is required because product repos are created later.
- **Repository permissions:**

  | Permission | Access | Used for |
  |------------|--------|----------|
  | Administration | Read and write | creating product repos |
  | Contents | Read and write | pushing scaffold/blueprint/branches; `repository_dispatch` |
  | Workflows | Read and write | pushing `.github/workflows/*` into product repos |
  | Secrets | Read and write | copying secrets into product repos |
  | Variables | Read and write | setting `GREENLIGHT_REPO`/`GREENLIGHT_ISSUE` on product repos |
  | Issues | Read and write | Factory commenting/labelling greenlight issues |
  | Pull requests | Read and write | Factory opening PRs, Inspector merging them |
  | Metadata | Read-only | (mandatory) |

The default `GITHUB_TOKEN` can't create repos or act across repos, so this token is required.

### 3. Repository secrets on `greenlight`

Settings → Secrets and variables → Actions → **New repository secret**:

| Secret | Value | Phase |
|--------|-------|-------|
| `CLAUDE_CODE_OAUTH_TOKEN` | output of `claude setup-token` | 1 |
| `GREENLIGHT_TOKEN` | the fine-grained PAT | 1 |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → custom token with **Account › Cloudflare Pages › Edit** and **Account › Account Analytics › Read** (for the Observer) | 2, 4 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account ID | 2 |

The Architect copies all four into each product repo it creates. Product repos created before you add a secret need it
set by hand, or you can re-apply `approved` (the Architect reuses the existing repo and re-copies secrets).

Scout secrets (all optional; the Scout runs without them):

| Secret | Value | Without it |
|--------|-------|------------|
| `MONGODB_URI` | Atlas connection string (see below) | signals go to a JSONL artifact on each run instead of MongoDB |
| `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` | reddit.com/prefs/apps → create a **script** app | anonymous requests, which Reddit often blocks from GitHub Actions |
| `PRODUCTHUNT_TOKEN` | producthunt.com/v2/oauth/applications → developer token | public feed only, with no vote or comment counts |

**MongoDB Atlas (free M0):** create an M0 cluster, add a database user limited to read/write on the `greenlight` database,
and under Network Access allow `0.0.0.0/0` (GitHub Actions has no fixed IPs). Copy the `mongodb+srv://…` string into
`MONGODB_URI`. The Scout creates its indexes itself, including a 30-day TTL, so the collection stays well under M0's
512 MB.

Optional **variables** (same page, *Variables* tab): `PRODUCT_VISIBILITY` (`private`|`public`, default `private`),
`PRODUCT_PREFIX` (e.g. `gl-`), `ARCHITECT_MAX_TURNS` (20), `FACTORY_MAX_TURNS` (80), `FIX_MAX_TURNS` (40),
`INSPECTOR_MAX_TURNS` (25), `INSPECTOR_MAX_ROUNDS` (3), `AUTO_MERGE` (`true`), `ANALYST_MAX_TURNS` (20),
`CRITIC_MAX_TURNS` (15), `CRITIC_MIN_SCORE` (14), `CRITIC_MAX_IDEAS` (3), `OBSERVER_MAX_TURNS` (12), and `CLAUDE_MODEL` (passed as `--model`;
empty uses Claude Code's default for your plan). The Architect copies these into each new product repo, and you can
override them there per product.

### 4. Create the labels

Actions → **Setup labels** → *Run workflow*. It's safe to re-run.

### 5. Create the Project board

GitHub → your profile → Projects → **New project** → *Board*, named "Greenlight".
- Settings → **Manage access / Linked repositories**: link `greenlight`.
- Project menu → **Workflows**: turn on *Auto-add to project* with the filter `is:issue` for the `greenlight`
  repo, and *Item closed* → set Status to the last column.
- Rename the **Status** field's options to the states: `idea`, `approved`, `blueprint-ready`, `blueprint-ok`,
  `building`, `live`, `stuck`, `archived`.
- Add a second view as a **Table** that shows the *Labels* column. Filter it with `label:stuck` or `label:building`
  for the "what needs me" view.

Labels are the source of truth because the workflows read and write them. Board columns are only a view. In phase 1 you
drag cards when you change a label. Syncing Status from labels automatically needs a token with Projects access,
so it's left out on purpose.

### 6. Fill in `compass.md`

Replace the `TODO`s: interests, background and the no-go list. Then edit `scout/config.json`: set your Reddit
username in `userAgent` and pick subreddits and feeds where your target users talk.

### 7. First runs

1. Actions → **Scout** → *Run workflow*. Without `MONGODB_URI` it uploads a `signals` artifact. Check that every
   source returned something (the run summary has a table).
2. Actions → **Ideas** → *Run workflow*. It works without MongoDB too, using a fresh fetch. Expect 0–3 new `idea`
   issues and an `analysis/<date>.md` commit. An empty week is normal while `compass.md` is still generic.
3. Add `approved` to an idea you like to start the Architect.
4. Once something is `live`: in Cloudflare, open Workers & Pages → the project → **Metrics** → enable **Web Analytics**
   (free, no code change). Then run Actions → **Observer** by hand once and pin the **Greenlight weekly reports** issue
   it creates. If the report notes "no Web Analytics site for …", copy the site tag from the Web Analytics dashboard
   URL into `observer/config.json` → `siteTags`.

## Roadmap

All nine actors exist. The next steps depend on running them for real:
- Tune `compass.md`, `scout/config.json` (subreddits, feeds, pain phrases) and the Critic threshold based on the first
  few weeks of `analysis/` output.
- Key-action tracking: the Observer reports "no data" for each product's key action until products emit a counted event
  (for example a tiny `/api/event` Function writing to MongoDB).
- Optional: sync Project board Status from labels (needs a token with Projects access).

## Local development of the template

```bash
cd template
npm ci
npm run check   # lint + test + build
npm run dev
```
