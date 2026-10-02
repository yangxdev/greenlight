<!--
  The Factory fills in this README from blueprint.md (see CLAUDE.md → "README"). Replace every line in brackets;
  keep the section order. The greenlight:live and greenlight:screenshots blocks are written by the Publisher after
  each deploy (live link, screenshots of the live site): keep their markers and leave their contents alone.
-->

# greenlight-product

[One sentence: what it does, for whom. The same as SITE_DESCRIPTION in src/app/site.ts.]

<!-- greenlight:live -->
<!-- /greenlight:live -->

<!-- greenlight:screenshots -->
<!-- /greenlight:screenshots -->

## What it does

- [3 to 5 bullets from the visitor's side: what they can do with it, not how it is built.]

## How to use it

1. [The core flow in 2 to 4 numbered steps, in the words the page itself uses.]

## Privacy

[What it stores and where, plainly: "Nothing leaves your browser; your ticks live in localStorage", or which data the
server keeps and for how long. No accounts, no tracking cookies; page views are counted by Cloudflare Web Analytics,
which sets no cookies.]

## Contributing

[How a visitor can help: open an issue for a mistake or an idea, and, if the product has a data file people can
extend, which file to edit in a pull request and what a good entry looks like.]

## Run it locally

Needs Node.js 22.18 or later.

```bash
npm ci
npm run dev     # the app at http://localhost:5173 (the /api Worker is not running)
npm run check   # lint, tests and a production build
```

`npm run build && npx wrangler dev` serves the built app together with the `/api` Worker.

## Built with

React 19, Vite, Redux Toolkit and Tailwind CSS v4, served by a Cloudflare Worker.

---

Made by [greenlight-owner](https://github.com/greenlight-owner).
