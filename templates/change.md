<!--
  Change spec template. For a change to a live product the Architect writes changes/<issue>.md in the product repo
  with EXACTLY these "## " sections, in this order. The architect workflow checks for Change, Tasks, Acceptance
  criteria and Non-goals, and for 1–5 "### Task N: ..." headings. blueprint.md stays the product's spec; this file
  says what changes on top of it.
-->
# <Product name>: change #<issue>, <short title>

> Change: <owner/greenlight#issue> · Product: <owner/greenlight#parent> · Spec it changes: blueprint.md

## Change

What changes for the user, in 2–5 bullets, and what stays exactly as it is. Name the screens it touches.

## Identity

Only if the layout, tag, screens or headline change: the new values, in the same form as blueprint.md's Identity.
Otherwise the single line `No change.`

## Data model

New or changed types and storage, as TypeScript. Existing stored data must keep working: say how old records are
read. Otherwise `No change.`

## Tasks

Ordered, each finishable in under about an hour, each ending with `npm run check` green.

### Task 1: <title>

- **Do:** what to change, concretely: components, routes, copy.
- **Files:** the files it touches.
- **Satisfies:** CH1, CH2

## Acceptance criteria

Given/When/Then, numbered CH1, CH2, … Each one is a test in jsdom or against the Worker's `/api` handler. Include at
least one criterion that something the change must not break still works.

- **CH1:** Given …, when …, then …

## Non-goals

What this change does not touch.

## Setup notes

Anything a person must do (a secret, a bucket), or `None.`
