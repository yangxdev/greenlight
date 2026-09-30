<!--
  Template for build-report.md. The Factory copies this to the repo root at the end of a build,
  fills every section, and the workflow uses it as the pull request body.
-->
# Build report

- **Blueprint:** blueprint.md @ <commit sha>
- **Greenlight issue:** <owner/greenlight#n>
- **Run:** <link to the Actions run>
- **Result:** ✅ complete | ⚠️ partial | ❌ blocked

## Tasks

| # | Task | Status | Commit | Notes |
|---|------|--------|--------|-------|
| 1 | … | done / partial / skipped | abc1234 | … |

## Acceptance criteria

| Criterion | Covered by test | Status |
|-----------|-----------------|--------|
| … | `src/features/…/….test.tsx` › "…" | pass / fail / untested |

## Checks (last run of `npm run check`)

- lint: pass/fail
- test: pass/fail (<n> tests)
- build: pass/fail (bundle size: … kB gzip)

## Deviations from the blueprint

Anything built differently from blueprint.md, and why. "None" if none.

## New dependencies

Package, version, and why it was needed. "None" if none.

## Manual setup required before deploy

For example: `wrangler r2 bucket create …`, `npx wrangler secret put MONGODB_URI`, Atlas network access. "None" if none.

## Blockers / open questions

What stopped the build or needs a human decision. "None" if none.
