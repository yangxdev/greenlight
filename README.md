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
| 1 | Board, Architect, Factory, product template | **built** (this commit) |
| 2 | Inspector, Publisher | roadmap |
| 3 | Scout, Analyst, Critic | roadmap (role prompts exist in `.claude/agents/`) |
| 4 | Observer | roadmap (role prompt exists in `.claude/agents/`) |

## Label state machine

Each idea issue carries exactly one state label. Two transitions are human gates (🧑).

```
idea ──🧑──► approved ──Architect──► blueprint-ready ──🧑──► blueprint-ok ──dispatch──► building ──► live
                │                                                                           │
                └──────────────── (any automated step fails) ──────────────────► stuck ◄────┘
any state ──🧑──► archived
```

| Label | Set by | Meaning / what happens next |
|-------|--------|-----------------------------|
| `idea` | issue template (you) · Critic (phase 3) | Idea card waiting for review |
| `approved` | **you** | `architect.yml` creates the product repo, writes `blueprint.md`, comments the link |
| `blueprint-ready` | Architect | Review/edit `blueprint.md` in the product repo |
| `blueprint-ok` | **you** | `factory-dispatch.yml` checks nothing else is `building`, then triggers the product's Factory |
| `building` | factory-dispatch | The Factory is implementing the blueprint. **Only one issue at a time.** |
| `live` | you (phase 1) · Publisher (phase 2) | Deployed and smoke-tested |
| `stuck` | any workflow | Automation gave up. The issue comment links the failed run |
| `archived` | you · Observer suggestion | Dropped or retired. Close the issue too |

Retry anything by removing and re-adding the gate label (`approved` or `blueprint-ok`).
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
template/                   product skeleton copied into every new product repo
  CLAUDE.md                 stack conventions, R2/Mongo usage, testing rules, definition of done
  src/ functions/ shared/   Vite + React + RTK + Tailwind + TS app, Pages Functions, shared types
  .github/workflows/factory.yml
  .github/build-report.md
```

**Why `template/` is a folder, not a GitHub template repo:** the Architect already checks out greenlight, so copying a
folder costs nothing, and template changes land in the same PR as workflow changes that depend on them.
`template-ci.yml` keeps it green. A template repo would only add the "Use this template" button, which nothing here uses.
In both setups, existing products don't receive later template changes. That's intended, because each product is a
snapshot.

## How phase 1 works

1. **You** open an issue with the *Idea* form (label `idea`) and later add `approved`.
2. **Architect** (`architect.yml`, about 20 turns max):
   - a shell step creates `<you>/<slugified-title>` (private by default) from `template/`, replacing the
     `greenlight-product` placeholder with the repo name;
   - it copies `CLAUDE_CODE_OAUTH_TOKEN`, `GREENLIGHT_TOKEN` and, if present, the Cloudflare secrets into the product
     repo, and sets the variables `GREENLIGHT_REPO`/`GREENLIGHT_ISSUE`;
   - Claude reads `compass.md`, the issue (plus your comments) and `templates/blueprint.md`, and writes only
     `blueprint.md`. It has only Read/Write/Edit/Glob/Grep and the short-lived `GITHUB_TOKEN`;
   - shell steps check the blueprint (required sections, 1–10 tasks, no other files touched), commit it, comment
     the link with a `<!-- greenlight:repo=owner/name -->` marker, and set the label to `blueprint-ready`.
3. **You** review `blueprint.md` in the product repo (edit it freely) and add `blueprint-ok`.
4. **Factory dispatch** (`factory-dispatch.yml`, no AI) refuses if another issue is `building`, otherwise sends
   `repository_dispatch: greenlight-build` to the product repo and sets the label to `building`.
5. **Factory** (`template/.github/workflows/factory.yml` in the product repo, about 80 turns max):
   - Claude implements the tasks in order, runs `npm run check` after each, commits `task N: …`, and writes
     `build-report.md`. It can't push, and its tools are limited to file edits, `npm`/`npx` checks and local `git`;
   - shell steps block edits to `.github/`, `blueprint.md` and `CLAUDE.md`, re-run lint/test/build/audit themselves,
     push `factory/build-N` with hooks disabled, open a PR (a draft if anything failed) whose body is the build
     report, and comment on the greenlight issue. On failure the label becomes `stuck`.
6. **You** review and merge the PR, deploy by hand if you want it live now (see phase 2), and set `live`.

### Usage limits

The Pro plan's usage limits are the real budget:

- **One build at a time.** factory-dispatch checks the `building` label.
- **Every agent has `--max-turns`.** Architect uses `ARCHITECT_MAX_TURNS` (default 20) and Factory uses
  `FACTORY_MAX_TURNS` (default 80). Every job also has a `timeout-minutes`.
- **No AI in deterministic steps.** Repo creation, secrets, validation, checks, pushes, PRs and labels are all shell.
- **GitHub Actions minutes:** private repos get 2,000 free minutes a month and public repos are unlimited. A Factory run
  can take up to 90 minutes. If minutes get tight, set `PRODUCT_VISIBILITY=public` (secrets stay secret either way).

### Security model

- `GREENLIGHT_TOKEN` (a fine-grained PAT) is only given to shell steps. Claude steps get the job's `GITHUB_TOKEN`
  (read-only in the Factory), so text in an idea or blueprint can't be used to steal the PAT or push directly.
- Pushes that use the PAT run with `core.hooksPath=/dev/null`, so nothing written during a build runs with the token.
- Gate labels only trigger when you apply them (`github.actor == github.repository_owner`).
- In phase 3, idea text comes from the open internet, which is why the Claude steps never hold cross-repo credentials.

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
  | Pull requests | Read and write | Factory opening PRs |
  | Metadata | Read-only | (mandatory) |

The default `GITHUB_TOKEN` can't create repos or act across repos, so this token is required.

### 3. Repository secrets on `greenlight`

Settings → Secrets and variables → Actions → **New repository secret**:

| Secret | Value | Phase |
|--------|-------|-------|
| `CLAUDE_CODE_OAUTH_TOKEN` | output of `claude setup-token` | 1 |
| `GREENLIGHT_TOKEN` | the fine-grained PAT | 1 |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → custom token with **Account › Cloudflare Pages › Edit** | 2 (optional now) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account ID | 2 (optional now) |

If the Cloudflare secrets exist when the Architect runs, they're copied into the product repo for phase 2.
Product repos created before you add them need them set by hand (or re-apply `approved`; the Architect reuses the repo).

Optional **variables** (same page, *Variables* tab): `PRODUCT_VISIBILITY` (`private`|`public`, default `private`),
`PRODUCT_PREFIX` (e.g. `gl-`), `ARCHITECT_MAX_TURNS` (default 20), `FACTORY_MAX_TURNS` (default 80),
`CLAUDE_MODEL` (passed as `--model`; empty uses Claude Code's default for your plan).

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

Replace the `TODO`s: interests, background and the no-go list.

## Roadmap

### Phase 2: Inspector + Publisher

- `template/.github/workflows/inspector.yml` (on `pull_request`): deterministic job (`npm ci`, lint, test, build,
  `npm audit --audit-level=high`, secret scan with gitleaks), then a Claude review step that checks the diff against
  `blueprint.md`'s acceptance criteria and `build-report.md`. On failure it dispatches `greenlight-fix` back to the Factory
  with the findings as a markdown file. After 3 rounds (a counter in the PR labels) it labels the greenlight issue `stuck`.
- Factory: add a `greenlight-fix` mode that checks out the PR branch and addresses the Inspector's findings file.
- `template/.github/workflows/deploy.yml` (on push to `main`, no AI): `npm ci && npm run build`,
  `npx wrangler pages project create <name> --production-branch main` (first time only), then
  `cloudflare/wrangler-action@v4` with `command: pages deploy dist --project-name=<name> --branch=main`,
  a `curl` smoke test of `https://<name>.pages.dev/api/health`, a comment with the live URL on the greenlight issue,
  and the `live` label.
- Until then you can deploy by hand from a product repo: `npm run build && npx wrangler pages deploy dist --project-name <repo>`.

### Phase 3: Scout + Analyst + Critic

- `scout/`: plain TypeScript scripts, no AI, on a daily `schedule`. They pull the HN Algolia API, Reddit `.json`
  listings, GitHub trending, the Product Hunt feed and RSS into a MongoDB Atlas `signals` collection, deduplicated by URL.
- Weekly `analyst.yml`: exports recent signals to JSONL, runs Claude with `.claude/agents/analyst.md`, and commits
  `analysis/<date>.md`.
- `critic.yml` runs after that with `.claude/agents/critic.md`. A shell step files at most 3 issues with label `idea`
  from `analysis/<date>-critic.md`.

### Phase 4: Observer

- Weekly `observer.yml`: shell steps collect uptime (curl of every `live` product's `/api/health`) and Cloudflare
  Web Analytics numbers (GraphQL API; token needs **Account Analytics: Read**) into `observer/metrics.json`. Claude
  with `.claude/agents/observer.md` writes `reports/<YYYY>-W<ww>.md`, which feeds the next Analyst run. A shell step
  posts the summary as a pinned issue comment on the board.

## Local development of the template

```bash
cd template
npm ci
npm run check   # lint + test + build
npm run dev
```
