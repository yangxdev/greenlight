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

## Look & feel

Every product looks like a sibling of my own apps, yangxdev.com and waypoint: warm neutrals, hairline separation,
light first (dark available and remembered), one vermilion accent (朱色) used sparingly, Geist type. The product
template already implements this (tokens in `src/index.css`, primitives in `src/components/ui`, rules in `CLAUDE.md`),
so blueprints should build with it, not restyle it.

- **Tools over pages.** Most products are tools people *use*, so follow waypoint: dense, calm, softly rounded cards.
  Only a single landing page may follow yangxdev.com: square corners, flat hairlines, a large tight headline.
- **Restraint is the brand.** No gradients, glassmorphism, emoji, stock illustrations, serif or decorative fonts.
  Distinction comes from type scale, spacing and one accent.
- **One primary action per screen.** If a screen needs two, it's two screens or the scope is wrong.
- **Scope for the design, too:** at most 3 screens, each with a real empty state and a loading state. Every screen
  must work at 320px wide and in both themes.
- **Voice:** plain and specific, sentence case, no exclamation marks, no superlatives. The headline says what the tool
  does in one line.
- **Colour means something.** The accent marks what's notable; status colours only mean status. Category colours
  only when people scan by type (like flights vs hotels in waypoint).
- **Don't copy yangxdev.com's personal branding** (Japanese layer, hanko seal, vertical rail labels) into products.

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
