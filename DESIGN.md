# Design language

The house style shared by **yangxdev.com**, **waypoint**, **greenlight**'s products and its future dashboard, and every
image or mascot made for them. This file is the authority. Where a repo's own rules go further (`template/CLAUDE.md`
"Look & feel", waypoint's `CLAUDE.md`), they refine this and never contradict it. Tokens are defined in each repo's
`index.css` / `theme.css`; the values below are the reference.

## The idea

**A page is a ruled document, not a stack of cards.** The structure comes from sakana.ai and Japanese corporate sites:
white first, hairlines instead of boxes, numbered sections with a left rail, mono for every label, one vermilion
accent (朱色, the colour of a torii gate and of hanko ink). Distinction comes from type scale, spacing and restraint,
never from decoration.

## Non-negotiables (everywhere, every medium)

1. **One accent: 朱色.** Rationed to about eight appearances per screen or image. It marks what is notable: a section
   index, the logo mark, one highlighted word, the selected option, the focus ring, the step that needs a human.
   Never decoration, never a second accent colour.
2. **No gradients, glows, blur, glassmorphism, 3D, bevels or emoji.** Flat colour only.
3. **No shadows**, except one soft shadow under a dialog or drawer.
4. **Hairlines separate things.** 1px lines and a slightly darker band (`zone`) do the work cards and shadows do elsewhere.
5. **Grotesque type only: Geist for reading, Geist Mono for structure.** No serif and no decorative fonts, ever.
6. **Light first, dark equal.** Light is the default; dark is one click away and must look as good.
7. **Left-aligned.** Nothing is centred except inside a control.
8. **Words and numbers over pictures** in the interface. `01`, `02` instead of icons; icons only on controls.

## Colour

Status colours mean status only. Category colours exist only where scanning by type is a real task (waypoint's
flights vs hotels): one family, same lightness and chroma, evenly spaced hues, never the danger hue.

| Role | Light | Dark | Use |
|------|-------|------|-----|
| `canvas` | `#FFFFFF` | `#0F100F` | the page |
| `zone` | `#F7F7F5` | `#151614` | an alternate band, the label column of a table |
| `surface` | `#FBFBFA` | `#1A1B19` | inputs, wells |
| `line` | `#E6E5E2` | `#272825` | the hairline |
| `line-strong` | `#CFCDC8` | `#3A3B37` | input borders, table heads |
| `ink` | `#14161A` | `#F7F6F3` | headings, primary text, the primary button's fill |
| `ink-soft` | `#3D4147` | `#CDCBC5` | long body copy |
| `muted` | `#6B7078` | `#8E8D87` | secondary text |
| `subtle` | `#9A9EA5` | `#63625D` | decorative only, never text a reader needs |
| **`brand` 朱色** | `#C63A00` · `oklch(0.55 0.19 43)` | `#FF9B50` · `oklch(0.78 0.15 55)` | the accent |
| `success` | `#177C52` | `#47BE8B` | status: live, passed |
| `warning` | `#AD7300` | `oklch(0.78 0.13 80)` | status: attention |
| `danger` | `#BA022F` | `oklch(0.68 0.17 22)` | status: failed, destructive (a cooler crimson, so it never reads as the accent) |

yangxdev.com names the same values differently (`band` = `zone`, `hairline` = `line`, `shu` = `brand`). Same colours.

## Type

| Step | Size | Use |
|------|------|-----|
| display | 72 / 0.98, −0.035em | the one hero headline |
| h2 | 36 / 1.15, −0.02em | section titles |
| h3 | 20–24 | row and cell titles |
| lede | 19 / 1.75 | the paragraph under a headline |
| body | 17 / 1.7 | text |
| small · note | 14 · 12 | secondary text · footnotes |
| label | 11, uppercase mono, +0.12em | the most repeated element: labels, indices, tags, dates, counts, paths |

Mono also carries anything a reader transcribes or compares: codes, prices, versions, IDs. Use tabular figures
wherever numbers line up.

## Layout and components

- **One container** (80rem, 5rem gutter) for header, hero, sections and footer, so every left edge lines up.
- **Anatomy:** header (mark, lowercase name, mono tag, mono nav) → hero (optional mono eyebrow, display headline with at
  most one accent word, one-sentence lede, one action) → numbered sections `01`, `02`… each with a rail label →
  footer (mark, name, a few mono links, notes about what the product stores and can't do).
- **Lists are ruled rows**, not cards: meta (index, date, kind) in mono on the left, content, one control on the right.
- **Facts are cells sharing borders** (`01` + title + line), or a big mono figure with a caption.
- **One primary button per view: solid ink, square.** Everything else is a ghost. Buttons are never 朱色.
- **Filters are mono words over a rule**, not pills. **Caveats are footnotes** under what they qualify, not banners.
- **Empty states** are a dashed ruled box with a title, one line and one action. **Loading** is a skeleton shaped like
  the content. No spinners, no bounce.
- **Motion:** 120ms hover, 220ms panels, 320ms reveals, one ease-out curve. Everything stops under reduced motion.
- **Touch:** 36px targets under a mouse, 44px under a finger. No horizontal scroll at 320px.

## Registers

The non-negotiables hold in all three. The registers differ only where noted.

| | **Document** (default) | **Tool** | **Personal** |
|-|------------------------|----------|--------------|
| Where | greenlight products and dashboard, READMEs, diagrams | waypoint and any app that is a long list of same-kind objects used on the go | yangxdev.com only |
| Corners | square everywhere; status dots are the only circles | 6px on cards, inputs and buttons, 4px on chips | square everywhere |
| Depth | hairlines only | hairline plus a whisper of shadow on cards, a little more on hover | hairlines only |
| Labels | 11px uppercase mono | 12px uppercase sans; mono only for data you transcribe | 11px uppercase mono, with a Japanese gloss |
| Extra | | category colours carried by a kind badge | the hanko seal (暘), kanji glosses, vertical rail labels (縦書き) |

**The personal layer never leaves yangxdev.com.** No seal, kanji or vertical labels on products, the dashboard or
greenlight's images.

## Greenlight dashboard (planned)

Document register. The pipeline seen from above: one row of ten numbered cells (`01` Scout … `10` Observer), each with
the actor's name, its last run and a status dot, and every cell a link to that step's runs, issues or files. Ideas
are ruled rows with their state label in mono. **The accent marks where a human is needed**: the two gates
(`approved`, `blueprint-ok`) and anything `stuck`. Status dots use status colours only.

## Voice

Plain and specific, sentence case, no exclamation marks, no superlatives ("powerful", "seamless", "effortless",
"unlock"). The headline says what the thing does in one line, then the facts. Limits go in footnotes, stated plainly.

## Images: diagrams and illustrations

For image generators, and for anyone drawing by hand. **Paste the block below as the style section of the prompt.**

```text
Flat vector illustration in a strict editorial, Swiss–Japanese corporate style.
Background: plain white #FFFFFF (dark variant: near-black #0F100F). Optional bands in #F7F7F5 (dark #151614).
Lines: thin uniform hairlines, 1–1.5px, colour #14161A (dark: #F7F6F3); secondary lines #CFCDC8.
Shapes: rectangles and straight lines with square corners; the only circles are small status dots.
Exactly one accent colour, vermilion #C63A00 (dark: #FF9B50), used on 1–3 small elements only
(a number, one node, one marker). Status green #177C52 only when something means "live" or "passed".
Typography: neutral grotesque sans-serif (like Geist) for words; monospace uppercase small labels
with wide letter-spacing for indices like 01, 02, 03. Left-aligned, generous whitespace, grid-aligned.
No gradients, no shadows, no glow, no 3D, no isometric perspective, no textures, no glossy or
neon effects, no emoji, no stock people, no robots, no clip-art icons, no rounded bubbly shapes,
no serif fonts. Calm, precise, quiet; it should look like a page from a well-designed annual report.
```

Rules for diagrams that replace README graphs:

- **Generate structure, set text yourself.** Generators misspell labels and break arrows. Generate the layout or
  illustration without text, then set every label in the actual fonts (Figma or SVG), or draw the diagram as SVG
  from these tokens outright. A diagram with a wrong word is worse than the ASCII it replaces.
- **Read left to right, numbered.** Steps carry `01`, `02`… in mono; arrows are plain hairlines with a small
  open arrowhead. Human gates are the accent; everything else is ink.
- **Two files per image, light and dark**, linked with GitHub's `#gh-light-mode-only` / `#gh-dark-mode-only`.
  Export at 2× (a 1280px-wide README image is 2560px). Social previews: 1280×640.
- **Alt text says what the diagram says**, not "diagram".

## Mascot brief

For greenlight. One character, used on the README, the dashboard's empty states and social previews. Never inside a
product's interface.

- **Concept: the signal lamp.** A small upright rectangular housing in ink, square corners, hairline outline, with a
  single round lens: the system's one permitted circle, like the status dots. The lens is **vermilion** while it waits
  for a human (the gates) and **green** when something ships. It is the pipeline's personality: patient, precise, it
  waits for your go.
- **Built from the system:** rectangles, straight lines, one circle. Flat fills from the palette above, no gradients
  or shading. A face is optional and minimal (two small dots, no mouth, or none at all).
- **Must work at 16px** (as a favicon, it reduces to the housing and the lens) and as a single-colour line drawing.
- **Poses, not expressions:** waiting (vermilion lens), building (lens off, a small mono `…`), live (green lens),
  stuck (danger lens, tilted slightly). One pose per image.
- **Never:** cute-sticker proportions, big eyes, gloss, outlines in a second accent, a robot, a traffic light with
  three lamps, or anything from yangxdev.com's personal layer (seal, kanji).

---

Change this file first when the language changes, then the tokens in each repo. A repo whose `index.css` disagrees
with the tables above is out of date, not a new rule.
