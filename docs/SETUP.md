# Setting up your own Greenlight

About an hour, most of it creating accounts and tokens. You need a GitHub account, a Claude Pro plan and the
`claude` CLI. Everything else is optional or free.

## Checklist

| Step | What you do | Time | Needed for |
|------|-------------|------|------------|
| [0](#0-your-copy) | Fork the repo and enable Actions | 2 min | everything |
| [1](#1-claude-oauth-token-pro-plan) | `claude setup-token` | 2 min | every AI step |
| [2](#2-github-fine-grained-pat-greenlight_token) | A fine-grained GitHub token | 5 min | creating and building product repos |
| [3](#3-repository-secrets-on-greenlight) | Add the secrets: Claude, GitHub, Cloudflare; optionally MongoDB and source keys | 20 min | deploys (Cloudflare), stored signals and uptime (MongoDB) |
| [4](#4-create-the-labels) | Run **Setup labels** | 1 min | everything |
| [5](#5-create-the-project-board) | A Project board, plus a classic token if you want cards to move by themselves | 15 min | optional: the board view |
| [6](#6-fill-in-compassmd) | Write `compass.md` and pick the Scout's sources | 10 min | good ideas |
| [7](#7-first-runs) | Run the Scout, then Ideas, then approve something | 5 min + waiting | your first product |

The minimum to see an idea issue: steps 0 and 1, the `CLAUDE_CODE_OAUTH_TOKEN` secret from step 3, steps 4 and 6,
then steps 7.1–7.2. To build and deploy a product you also need step 2 and the rest of step 3. How each stage works is in [HOW-IT-WORKS.md](HOW-IT-WORKS.md).

## 0. Your copy

Fork the repo, or push a copy to a new repository of your own. On a fork, open the **Actions** tab and enable
workflows: GitHub turns them off on forks, and scheduled runs stay off until you do. Delete `analysis/` (the original's
weekly idea cards and watchlist; the Critic starts a new watchlist); `compass.md` and `scout/config.json` get your own values in step 6.

## 1. Claude OAuth token (Pro plan)

On your machine, logged in to your **personal** Claude account:

```bash
claude setup-token        # prints a long-lived OAuth token for your Pro subscription
```

It lasts a year. Set the repository variable `CLAUDE_TOKEN_EXPIRES` to that date (`YYYY-MM-DD`) so the Observer can
warn you a month ahead. It reads the PAT's and the Cloudflare token's expiry by itself.

## 2. GitHub fine-grained PAT (`GREENLIGHT_TOKEN`)

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

## 3. Repository secrets on `greenlight`

Settings → Secrets and variables → Actions → **New repository secret**:

| Secret | Value | Phase |
|--------|-------|-------|
| `CLAUDE_CODE_OAUTH_TOKEN` | output of `claude setup-token` | 1 |
| `GREENLIGHT_TOKEN` | the fine-grained PAT | 1 |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → **Create Token** → template **Edit Cloudflare Workers**, then add **Account › Account Analytics › Read** (for the Observer) | 2, 4 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → Account ID. That page also shows your `*.workers.dev` subdomain, which must exist | 2 |

The Architect copies all four into each product repo it creates. Product repos created before you add a secret need it
set by hand, or you can re-apply `approved` (the Architect reuses the existing repo and re-copies secrets).

Scout secrets (all optional; the Scout runs without them):

| Secret | Value | Without it |
|--------|-------|------------|
| `MONGODB_URI` | Atlas connection string (see below) | signals go to a JSONL artifact on each run instead of MongoDB |
| `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` | a **script** app at reddit.com/prefs/apps, which needs Reddit's approval first. Greenlight's request was denied on 2026-10-01 ([details](../scout/README.md#reddit-access)) | Reddit is skipped; the other sources still run |
| `PRODUCTHUNT_TOKEN` | producthunt.com/v2/oauth/applications → developer token | public feed only, with no vote or comment counts |
| `STACKEXCHANGE_KEY` | stackapps.com/apps/oauth/register → the app's **Key** (not a secret, but kept with the others) | 300 requests a day per IP, shared on GitHub's runners; the Scout needs about 20 a day for its 18 sites, so a key is recommended |

**MongoDB Atlas (free M0):** create an M0 cluster, add a database user limited to read/write on the `greenlight` database,
and under Network Access allow `0.0.0.0/0` (GitHub Actions has no fixed IPs). Copy the `mongodb+srv://…` string into
`MONGODB_URI`. The Scout creates its indexes itself, including a 30-day TTL, so the collection stays well under M0's
512 MB.

Optional **variables** (same page, *Variables* tab): `PRODUCT_VISIBILITY` (`public`|`private`, default `public`),
`PRODUCT_PREFIX` (e.g. `gl-`), `ARCHITECT_MAX_TURNS` (20), `REVIEWER_MAX_TURNS` (20), `FACTORY_MAX_TURNS` (80), `FIX_MAX_TURNS` (40),
`INSPECTOR_MAX_TURNS` (25), `INSPECTOR_MAX_ROUNDS` (3), `AUTO_MERGE` (`true`), `ANALYST_MAX_TURNS` (20),
`CRITIC_MAX_TURNS` (25), `CRITIC_MIN_SCORE` (14), `CRITIC_MAX_IDEAS` (3), `OBSERVER_MAX_TURNS` (12), `CLAUDE_TOKEN_EXPIRES`
(`YYYY-MM-DD`, for the Observer's expiry warning), and `CLAUDE_MODEL` (passed as `--model`;
empty uses Claude Code's default for your plan). The Architect copies these into each new product repo, and you can
override them there per product.

## 4. Create the labels

Actions → **Setup labels** → *Run workflow*. It's safe to re-run.

## 5. Create the Project board

1. GitHub → your profile → **Projects** → **New project** → *Board*, named "Greenlight". A new board starts with three
   Status options: *Todo*, *In progress* and *Done*.
2. Set the Status options before anything else, because the workflows below refer to them. Open the ⋯ menu on a
   column header (or the **Status** field in the project settings) and rename *Todo*, *In progress* and *Done* to
   `idea`, `approved` and `blueprint-ready`. Then add `blueprint-ok`, `building`, `live`, `stuck` and `archived`, in
   that order.
3. Link the repo from the repo's side: the `greenlight` repo → **Projects** tab → **Link a project** → *Greenlight*.
   The board then shows up in the repo's Projects tab. (The project's own **Manage access** page is for people, not
   repos.)
4. ⋯ → **Workflows**:
   - *Auto-add to project*: the `greenlight` repo, filter `is:issue`. Turn it on.
   - *Item closed*: set Status to `archived`. Turn it on.
   - The other built-in workflows were set up for *Todo* and *Done*, so after the rename they point at `idea` and
     `blueprint-ready`. Open each one that is on: point it at `idea` (an item added or reopened) or `archived`
     (a pull request merged), or turn it off.
5. Add a second view: **+ New view** → *Table*, and show the *Labels* column. Filter it with `label:stuck` or
   `label:building` for the "what needs me" view.
6. Let `board-sync.yml` move the cards. Labels are the source of truth because the workflows read and write them;
   the board's Status only mirrors them, and nothing in GitHub does that on its own.
   - GitHub → Settings → Developer settings → Personal access tokens → **Tokens (classic)** → Generate new token,
     with the **project** scope, plus **repo** if your greenlight repo is private (without it the token can't read
     the issues on the board). A classic token is needed because fine-grained tokens can't reach a project owned by a
     personal account. Save it as the repository secret `PROJECT_TOKEN`.
   - Set the repository variable `GREENLIGHT_PROJECT` to the board's number (the `N` in
     `github.com/users/<you>/projects/N`).
   - Actions → **Board sync** → *Run workflow* once. After that it runs on every label change and after Ideas, the
     Architect and Factory dispatch. Each run sets every idea issue's Status from its state label (an issue that is
     both `live` and `stuck` shows as `stuck`, a closed one as `archived`) and adds idea issues the board is missing.
     Issues without a state label, like the weekly reports, are left alone.

   Without the token or the variable it does nothing, and you drag cards by hand when a label changes.

## 6. Fill in `compass.md`

Replace the `TODO`s: interests, background and the no-go list. Then edit `scout/config.json`: set your Reddit
username in `userAgent` and pick subreddits and feeds where your target users talk.

## 7. First runs

1. Actions → **Scout** → *Run workflow*. Without `MONGODB_URI` it uploads a `signals` artifact. Check that every
   source returned something (the run summary has a table).
2. Actions → **Ideas** → *Run workflow*. It works without MongoDB too, using a fresh fetch. Expect 0–3 new `idea`
   issues and an `analysis/<date>.md` commit. An empty week is normal while `compass.md` is still generic.
3. Add `approved` to an idea you like to start the Architect.
4. Once something is `live`, add traffic numbers (free, cookie-less):
   - Cloudflare → **Web Analytics** → *Add a site* → the product's hostname (`<name>.<you>.workers.dev`) → copy the
     **token** from the JS snippet it shows.
   - In the product repo, set the Actions **variable** `CF_BEACON_TOKEN` to that token, then re-run its **Publisher**
     workflow. The build adds the beacon script; without the variable, nothing is injected.
   - Run Actions → **Observer** by hand once and pin the **Greenlight weekly reports** issue it creates. If the report
     notes "no Web Analytics site for …", copy the site tag from the Web Analytics dashboard URL into
     `observer/config.json` → `siteTags`.

## Developing the product template

```bash
cd template
npm ci
npm run check   # lint + test + build
npm run dev
```
