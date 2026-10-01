<!--
  Blueprint template. The Architect writes blueprint.md in the product repo with EXACTLY these
  "## " sections, in this order. The architect workflow checks for the sections below and for
  1–10 "### Task N: ..." headings.
-->
# <Product name>: blueprint

> Idea: <owner/greenlight#n> · One-line pitch: <what it does, for whom>

## Scope

What v1 does, in 3–6 bullets, from the user's point of view. Screens (max 3) and the core flow.

## Identity

How the product looks and introduces itself (see the template's CLAUDE.md → "Look & feel").
- **Tag:** 2–4 lowercase words shown in mono next to the name, e.g. `privacy switch log`.
- **Headline:** the hero's h1, real copy, with at most one word marked as the accent, e.g. `Switches worth *checking* again.`
- **Sections:** the numbered sections in page order, each a one- or two-word rail label and what it holds, e.g.
  `01 Checklist: the switches, filterable by platform`. The tool itself is `01`.

## Data model

TypeScript interfaces for everything persisted, plus where it lives:
- **Storage:** none | MongoDB collection `<name>` | R2 bucket prefix `<prefix>/` | browser `localStorage`
- Indexes, size limits, retention.

```ts
export interface Example {
  id: string
  createdAt: string // ISO 8601
}
```

## Routes

| Kind | Path | Purpose | Request | Response |
|------|------|---------|---------|----------|
| page | `/` | … | – | – |
| api  | `GET /api/health` | smoke test (keep) | – | `HealthResponse` |

## Tasks

Ordered, each finishable in under about an hour by the Factory, each ending with `npm run check` green.
Max 10. Every task lists the acceptance criteria it satisfies.

### Task 1: <title>

- **Do:** …
- **Files:** `src/features/…`, `worker/routes/…`
- **Satisfies:** AC1, AC2

### Task 2: <title>

- **Do:** …
- **Files:** …
- **Satisfies:** …

## Acceptance criteria

Numbered, observable and testable. Each one maps to at least one automated test.

- **AC1:** Given …, when …, then …
- **AC2:** …

## Non-goals

What v1 explicitly will NOT do (auth, payments, i18n, admin UI, …).

## Setup notes

Manual one-time steps the owner must do before deploy (R2 bucket, `MONGODB_URI` secret, Atlas network access).
"None" if the product needs no storage.

## Success metric

What to watch in Cloudflare Web Analytics after launch, and the number that means "keep going".
