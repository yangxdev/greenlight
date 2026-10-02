# Scout

Plain scripts with no AI. The Scout pulls free sources into a MongoDB `signals` collection once a day
(`.github/workflows/scout.yml`) and exports a ranked, size-capped file for the Analyst.

```bash
cd scout && npm ci
node src/cli.ts fetch --out signals.jsonl            # all enabled sources into a file (no DB needed)
node src/cli.ts fetch --sources hn,github            # into MongoDB (needs MONGODB_URI)
node src/cli.ts export --out analyst-input.jsonl     # ranked export from MongoDB
node src/cli.ts export --from signals.jsonl --out analyst-input.jsonl --limit 50
npm run check                                        # typecheck + lint + tests (offline, fixture-based)
```

Node 22.18+ runs the TypeScript directly, so there is no build step.

## Sources

| Source | Endpoint | Auth | Notes |
|--------|----------|------|-------|
| `hn` | Algolia `search_by_date`: stories ≥ `minPoints`, Ask HN ≥ `askMinPoints`; then `items/<id>` for the `comments.maxThreads` (10) most discussed Ask HN threads of the last `comments.threadDays` (3) | none | Ask HN gets a lower bar because that's where problems get described. Each thread's `comments.perThread` (8) most-replied top-level comments become signals of their own (channel `ask_hn_comment`, title "Ask HN reply", the thread's title in `context`), skipping comments under `minLength` (80) characters. A comment failure never drops the stories |
| `reddit` | `oauth.reddit.com/r/<sub>/top?t=day` for each subreddit in `config.json` | `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` (app-only OAuth), which need Reddit's approval (see below) | Skipped, not failed, without credentials. One failing subreddit is skipped |
| `github` | Search API: repos created in the last `createdWithinDays` with ≥ `minStars` | `GITHUB_TOKEN` (the workflow's own) | Stands in for "trending", which has no API |
| `producthunt` | GraphQL API (votes, comments) | `PRODUCTHUNT_TOKEN` (developer token) | Falls back to the public Atom feed (no engagement numbers) |
| `stackexchange` | API `/questions` (newest, with body) for each site in `config.json`: `softwarerecs`, `webapps`, `superuser`, `askubuntu`, `apple`, `android` | none; optional `STACKEXCHANGE_KEY` | Software Recommendations and Web Applications are people asking whether a tool exists; the support sites only reach the Analyst with a pain phrase. Closed and downvoted questions are dropped; `comments` counts answers. Without a key the quota is 300 requests a day per IP, shared with everyone on the same GitHub runner IP. One failing site is skipped |
| `rss` | Any RSS 2.0 / RSS 1.0 / Atom feed in `config.json` | none | One failing feed is skipped |

A source that fails is logged as a warning and the run continues. The run only fails when every source fails.

## Reddit access

Reddit closed self-service API keys in November 2025, and anonymous `.json` requests now return 403, so the Scout only
reads Reddit with approved credentials. Until then the source logs `reddit: skipped` and the other sources carry on.

1. Request access: <https://support.reddithelp.com/hc/en-us/requests/new?ticket_form_id=14868593862164> (open it in a
   logged-in browser), role **Developer**. Devvit doesn't fit because the Scout runs off Reddit and only reads.
2. Once approved: <https://www.reddit.com/prefs/apps> → *create another app* → type **script**, redirect URI
   `http://localhost:8080`. The 14-character string under the name is `REDDIT_CLIENT_ID`; `secret` is
   `REDDIT_CLIENT_SECRET`.
3. In `config.json`, set `reddit.enabled` back to `true` and keep your username in `userAgent`. The source refuses to
   run while it says `CHANGE_ME`.

The request (submitted 2026-09-30) declared the 10 subreddits now in `config.json`. **Reddit denied it on 2026-10-01**
("not in compliance with the Responsible Builder Policy and/or lacks necessary details"). The policy
forbids submitting multiple requests for the same use case, and reading Reddit any other way after a refusal would be
circumventing it, so the source stays disabled. The code is kept in case Reddit's policy changes.

What the Scout does with Reddit, for the request and to stay inside it: once a day, one token request plus one
`GET /r/<sub>/top?t=day&limit=50` per subreddit in `config.json`; no posting, voting or messaging. It stores no
usernames. Post text lives in MongoDB for 30 days (TTL), and the idea cards in the repo keep only links and short quotes.
Reddit data must never be used to train a model, which also means keeping model training off for the Claude account
the agents run on.

## Backfill (one-off, wider window)

To look further back than a day: Actions → **Scout** → *Run workflow* with `days` (1–30), then Actions → **Ideas** →
*Run workflow* with the same `days` (and optionally a higher `limit`, up to 300). Only HN and Stack Exchange really
search back in time; Product Hunt still returns at most `producthunt.limit` launches, and Reddit, RSS and GitHub
keep their usual windows. HN and Stack Exchange page
through results (up to 1,000 per query) instead of stopping at the first page. Scheduled runs are unaffected.

## Data

Each signal:
`{ id, source, channel, url, link, title, text, score, comments, createdAt, context? }`.
- `url` is the discussion (HN item, Reddit thread, and so on).
- `context` is only set on replies: the title of the thread they answer. The Analyst reads it; ranking ignores it, so
  a reply only counts as a complaint for its own words.
- `link` is the canonicalised external target, and equals `url` for self posts.

In MongoDB, `_id` is `<source>:<native id>`. Re-fetching refreshes `score`, `comments`, `text` and `lastSeenAt`, and never
duplicates. A TTL index deletes signals `retentionDays` (30) after they were first seen, which keeps the collection far under
Atlas M0's 512 MB.

## Export for the Analyst

`export` takes the last `export.days` (7) of signals and sets aside `contextSources` (Product Hunt launches and new
GitHub projects): they show what people build, not what they struggle with, so they don't take the Analyst's slots.
With `--context-out` they go to a separate competition file (at most `contextLimit`, 300, most engaged first) that the
Analyst and Critic search rather than read. Of the rest, it leaves out `dropWithoutPain` channels (plain HN news
`hn:story`, Ask HN replies `hn:ask_hn_comment`, and the Stack Exchange support sites) that contain no pain phrase,
and ranks what remains:
- 60% engagement percentile within the signal's own source (comments count double),
- 40% `painPhrases` found in title and text (capped at 3),
- +`questionBoost` (0.25, about two pain phrases) for `questionChannels`, where people ask for tools or describe
  problems: Ask HN questions and replies, Stack Exchange, r/SomebodyMakeThis, r/AppIdeas,
- +0.1 when the same `link` shows up on several sources (they're merged, see `alsoSeenIn`).

It keeps at most `export.limit` (150) signals, with no source taking more than `maxSharePerSource` (40%), and cuts
text to `export.maxTextLength` (600) characters. The log line reports the approximate token count, which is what
the Analyst run will cost.

## Configuration

Edit `config.json`: subreddits (without `r/`), feeds, thresholds and pain phrases. Set `userAgent` to include your
Reddit username (`by /u/<name>`), as Reddit's API rules ask. `npm test` validates the file.
