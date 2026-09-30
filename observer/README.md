# Observer data scripts

The Observer's data scripts. They use no AI: they collect numbers, and Claude only writes the report
(`.github/workflows/observer.yml`).

```bash
cd observer && npm ci
GREENLIGHT_REPO=me/greenlight GITHUB_TOKEN=… MONGODB_URI=… node src/cli.ts probe
GREENLIGHT_REPO=me/greenlight GITHUB_TOKEN=… node src/cli.ts metrics --out metrics.json
npm run check   # typecheck + lint + tests (offline)
```

## `probe` (every 6 hours, `uptime.yml`)

Finds open greenlight issues labelled `live` and reads their comments:
- the product repo comes from the Architect's `<!-- greenlight:repo=owner/name -->` marker;
- the URL comes from the Publisher's `<!-- greenlight:url=https://….workers.dev -->` marker, or failing that a
  `*.workers.dev` (or older `*.pages.dev`) link in a Publisher comment.

A product is **up** when `/api/health` returns `{ "ok": true }` and `/` returns 200. Results go to the MongoDB `probes`
collection (TTL `probeRetentionDays`, 35). A product being down is data, not a failed run.

## `metrics` (weekly)

Writes `metrics.json` for the last complete ISO week:

| Field | Source | Without it |
|-------|--------|------------|
| `uptime` | share of ok probes in the week (`source: probes`) | `MONGODB_URI` unset: one check now (`source: point-check`) |
| `traffic` | Cloudflare Web Analytics (GraphQL `rumPageloadEventsAdaptiveGroups`), this week vs last | no Cloudflare secrets, or no Web Analytics site/beacon for the product: `null` |
| `successMetric` | the product's `blueprint.md` "Success metric" section | the token can't read the product repo: `null` |
| `board` | open issues per state label, stuck issues, ideas filed this week | none |

Every gap is written to `notes[]`, and the report must repeat them rather than guess.

Traffic needs a Cloudflare token with **Account › Account Analytics › Read**. Site tags are discovered through
`/accounts/{id}/rum/site_info/list`. If that call is not allowed, or doesn't list the host, put the site tag (32 hex
chars, from the Web Analytics dashboard URL) in `config.json` → `siteTags`. Web Analytics data is sampled, so small
numbers are approximate.
