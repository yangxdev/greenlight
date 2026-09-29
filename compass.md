# Compass

Read by the Analyst, Critic and Architect before they do anything. Keep it short and true.
The agents treat every line here as a hard constraint unless it says "prefer".

## Who I am

- Solo developer, building evenings/weekends. Personal accounts only.
- <!-- TODO: one line about your background / what you know better than most people -->

## Interests (build things near these)

<!-- TODO: 3–8 bullets. Domains you care about or have insider knowledge of. -->
- …
- …

## Stack (fixed)

- TypeScript everywhere.
- Frontend: React + Vite + Redux Toolkit + Tailwind CSS.
- Server: Cloudflare Pages Functions (Workers runtime). No long-running servers, no containers.
- Data: MongoDB Atlas free tier (M0), official driver, one client per request. D1 is the fallback.
- Files: Cloudflare R2.
- Hosting/CI: Cloudflare Pages, GitHub Actions.
- Tests: Vitest + Testing Library. Lint: ESLint.

## Budget (hard limits)

- €0 beyond the Claude Pro plan. Free tiers only: GitHub, Cloudflare (Pages/Workers/R2/D1), MongoDB Atlas M0.
- No paid APIs, no API keys that bill per call, no paid domains (use `*.pages.dev`).
- The MVP must fit about one day of Factory work: at most 10 tasks and 3 screens.

## No-go list (never build)

<!-- TODO: extend. The Critic rejects anything touching these. -->
- Anything needing user accounts with passwords (magic links / no-auth only in v1).
- Payments, money movement, crypto/trading, gambling.
- Medical, legal or financial advice. Anything regulated.
- Scraping sites whose terms forbid it; storing other people's personal data.
- Adult content, surveillance, dark patterns.
- Products that only work at scale (marketplaces, social networks) or need a mobile app.
- Business areas to avoid. <!-- TODO: name them -->

## What "good" means

An idea is good when **all** of these hold:

1. **Real pain:** people describe the problem in their own words, repeatedly, in public (links, not vibes).
2. **Reachable users:** I can name a community of the first 100 users and post there for free.
3. **Weak competition:** alternatives are missing, overpriced, bloated, or ignore a niche.
4. **One-day MVP:** it fits the stack above, the free tiers, and 10 tasks.
5. **Measurable:** "success" can be observed with Cloudflare Web Analytics within 2 weeks (visits, a key action).

Prefer: single-purpose tools, calculators/converters/checkers, niche utilities for a professional community,
things that are useful with zero sign-up.

## Definition of shipped

Live on `*.pages.dev`, `/api/health` green, README explains the product in one paragraph, and the link was
posted in at least one community from "Reachable users".
