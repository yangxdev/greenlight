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
| `hn` | Algolia `search_by_date`: stories ≥ `minPoints`, Ask HN ≥ `askMinPoints` | none | Ask HN gets a lower bar because that's where problems get described |
| `reddit` | `/r/<sub>/top?t=day` for each subreddit in `config.json` | `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` (app-only OAuth), else anonymous `.json` | Anonymous requests from GitHub Actions are often blocked. One failing subreddit is skipped |
| `github` | Search API: repos created in the last `createdWithinDays` with ≥ `minStars` | `GITHUB_TOKEN` (the workflow's own) | Stands in for "trending", which has no API |
| `producthunt` | GraphQL API (votes, comments) | `PRODUCTHUNT_TOKEN` (developer token) | Falls back to the public Atom feed (no engagement numbers) |
| `rss` | Any RSS 2.0 / RSS 1.0 / Atom feed in `config.json` | none | One failing feed is skipped |

A source that fails is logged as a warning and the run continues. The run only fails when every source fails.

## Data

Each signal:
`{ id, source, channel, url, link, title, text, score, comments, createdAt }`.
- `url` is the discussion (HN item, Reddit thread, and so on).
- `link` is the canonicalised external target, and equals `url` for self posts.

In MongoDB, `_id` is `<source>:<native id>`. Re-fetching refreshes `score`, `comments`, `text` and `lastSeenAt`, and never
duplicates. A TTL index deletes signals `retentionDays` (30) after they were first seen, which keeps the collection far under
Atlas M0's 512 MB.

## Export for the Analyst

`export` takes the last `export.days` (7) of signals and ranks them:
- 60% engagement percentile within the signal's own source (comments count double),
- 40% `painPhrases` found in title and text (capped at 3),
- +0.1 when the same `link` shows up on several sources (they're merged, see `alsoSeenIn`).

It keeps at most `export.limit` (150) signals, with no source taking more than `maxSharePerSource` (40%), and cuts
text to `export.maxTextLength` (600) characters. The log line reports the approximate token count, which is what
the Analyst run will cost.

## Configuration

Edit `config.json`: subreddits (without `r/`), feeds, thresholds and pain phrases. Set `userAgent` to include your
Reddit username (`by /u/<name>`), as Reddit's API rules ask. `npm test` validates the file.
