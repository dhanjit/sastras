# Śāstras

A public, Sanskrit-first map of Indian philosophy and the classical sciences, live at https://sastras.dhanjit.me. It is an Astro 7 static site (`dist/`) served by a Cloudflare Worker. No server code.

Design: `docs/superpowers/specs/2026-10-12-sastras-site-design.md`. It was written before the review rounds; where it and the code differ, the code is right.

**Every content change follows [docs/writing-rules.md](docs/writing-rules.md)**: sourcing, the closed-source writing method, neutrality, and the privacy rule for fetching sources. The build can't check any of that.

## Commands
- `npm run dev`: local site. It doesn't reload `src/data/glossary.yaml` or `src/figures/`; restart it after editing either (it logs a warning).
- `npm run build`: builds `dist/`. Fails on any content error (`validate` in `src/lib/tree.ts`), glossary error, figure error or undrawable card title.
- `npm run check`: `astro check` (types).
- `npm test`: Vitest unit tests in `tests/unit/`.
- `npm run e2e`: Playwright in `tests/e2e/`, with a phone project (375 px) and a desktop one (1280 px).
  - It builds first, then previews on its own port, 4399, and never reuses a server. Set E2E_PORT to run e2e in a second worktree at the same time (Astro allows one preview per project directory, so a second run needs its own worktree anyway).
  - `ASTRO_PREVIEW_BACKGROUND=1` is set in `playwright.config.ts`: Astro 7's preview backgrounds itself under AI agents, which Playwright would read as a crash.
  - Don't run two e2e runs in one checkout at once: they share `dist/` and `test-results/`. Check `npx astro preview status` and for other Playwright processes first.
  - It sets `E2E_FIGURES=1`, which builds the figure test pages (`/figure-test/<id>`, one per figure); `figures.spec.ts` tests animation on them. A production build never has them.
  - `quality.spec.ts` runs axe (wcag2a/aa, 21, 22aa, best-practice) in light and dark on the home, every written block page (listed from the frontmatter in `src/content/blocks/`), every figure test page, About, Glossary and 404. It fails on serious or critical violations. It also checks for sideways scroll on both projects (375 px on the phone one) and for reflow at 320 px.
- `npm run preview`: serves an existing `dist/` on port 4321. Not used by the tests.

## Content
One block = one file, `src/content/blocks/<id>.md`. The file name is the id and the URL (`/<id>`). The schema is `src/content.config.ts` (strict: an unknown key fails); the vocabularies are in `src/lib/vocab.ts`.

**Frontmatter**
- `title` (IAST), `gloss` (English), optional `devanagari`, optional free-text `dates`.
- `kind`: `topic | school | subschool | person | text | concept`.
- `parent`: another block's id, or `map` for a top-level block. `order`: integer, sorts siblings.
- `layer`: `foundation | pramana | schools | corpus | vada`. Set on top-level blocks only.
- `status`: `stub | draft | reviewed`. Agents write `draft`; only the owner sets `reviewed` (convention, not checked).
- `sources`: `{ id, title, url }`. `read`: `{ title, kind: translation | etext | scan, url }`. URLs must be http(s).
- `related`: ids of other blocks.
- Schools only: `vedic_authority` (`accepts | rejects | n/a`), and optionally `pramanas` (a subset of the six) with `pramanas_per`.

**What the build enforces** (`validate` collects every content error before it fails)
- Ids are lower-case ASCII words joined by hyphens. Reserved: `map`, `index`, `404`, `og`, `about`, `glossary`, `home`. Source ids follow the same pattern and must be unique within a block.
- A top-level block (`parent: map`) needs a `layer`; no other block may set one. `parent` and `related` must exist, parent chains can't loop, and a block can't list itself as related.
- A school is a top-level block in the `schools` layer. It needs `vedic_authority`. `vedic_authority`, `pramanas` and `pramanas_per` are allowed only on schools, and `pramanas_per` needs `pramanas`. `pramanas_per` names the school whose list the map's chips show (Vedānta shows Advaita's).
- A `stub` shows on the map as "in preparation" and has no page and no preview card. A written block (`draft` or `reviewed`) needs at least one source and can't sit under a stub, since the map reaches pages through their parents. A stub under a stub is fine.
- Links in the body are `[text](/slug)`: root-relative, to a written block, `/about`, `/glossary` or `/`. Relative links, missing pages and stubs fail, in every link form.

**Citations and notes**
- `:cite[id]` after each sourced statement. The id must be one of the block's `sources`. It renders as a superscript number (the source's position in the list) linking to the source list. A cite straight after another starts with a comma, so two read ¹,³.
- `:note[...]` is a margin note on desktop and a tap-to-open block on a phone.
- Both must be inline: not on their own line, not inside a link or a heading. A note can't nest inside another note and needs text.
- By convention, a note goes at the end of its sentence, after the full stop and any cite. The build doesn't check this.
- Any other `:word[…]` fails as a typo. Ordinary colons such as `2:47` are fine.
- `::figure[caption]{#id}`, on its own line, draws `src/figures/<id>.svg`. See Figures.
- A new directive needs its name in `src/lib/directives.ts` (or the typo check rejects it), a plugin registered in `astro.config.mjs`, and handling in `src/lib/refs.ts`, `src/lib/tree.ts` (its checks) and `src/lib/describe.ts` (which drops notes, cites and figures from descriptions by name).

**Glossary** (`src/data/glossary.yaml`)
- Term → short meaning. Keys are lower-case NFC IAST; meanings are short, under ten words (a convention, not checked).
- The build fails on an empty meaning, a duplicate key (including a different case or Unicode form) and two keys with the same anchor. The anchor is `g-` plus the term with long vowels doubled and marks stripped (ā → aa), so `kāla` and `kala` stay distinct.
- Listed terms are linked automatically (first use in each paragraph, list item, quote, table cell, figure caption or note; never in headings or links) to a hover/tap pop-up and to `/glossary#anchor`. Don't mark them up by hand.
- Whether a page uses an unlisted Sanskrit term is not checked. See the writing rules.

## Link-preview cards
- `src/pages/og/[slug].png.ts` draws a 1200×630 PNG per written block, plus `/og/home.png`. `src/lib/card.ts` holds the helpers.
- A card's title and gloss must be drawable: precomposed IAST, no Devanagari, no combining marks left after NFC (ISO 15919 "r̥̄" fails). Otherwise the build fails and names the slug. The `devanagari` field isn't drawn.
- Each page's `og:image` URL carries `?v=<hash>` of the title, gloss, layer and `CARD_REV`. A content edit changes the hash by itself. **Bump `CARD_REV` in `src/lib/card.ts` when the card's design changes**, so crawlers that cached the old image refetch.

## Figures
Hand-drawn SVG diagrams on block pages. **Read [docs/figure-guide.md](docs/figure-guide.md) before drawing one**: the syntax, the rules the build checks, the class vocabulary, phone-first layout, animation and the writing rules. `src/figures/example-system.svg` is the worked example.
- One file per figure, `src/figures/<id>.svg`, placed with `::figure[caption]{#id}`. The caption is required and can cite.
- `validate` checks the directive (own line, id, caption, used once per page). The `figures` integration (`src/integrations/figures.ts`) checks each file with `checkFigure` and that every referenced file exists. Either failure fails `astro build` and `astro dev`.
- `src/lib/figure-svg.ts` parses each SVG once, as the page will. It then checks that tree against allowlists of elements and attributes (no `style` attributes, references only to `#ids` inside the figure) and against the `<style>` rules (every selector starts with `#fig-<id>`, keyframes are named `<id>-…`). The same tree is then rewritten for the page: inner ids become `fig-<id>--<inner>`.
- Colour comes only from the figure classes in `manuscript.css`, so figures follow dark mode. Animations are CSS `@keyframes` on `.anim` elements; a `<head>` script and `Base.astro` play them on view.
- `/figure-test/<id>` draws each figure the way a block page does, below a spacer. It is built only with `E2E_FIGURES=1` (e2e sets it), and a production build that contains it fails.

## Code map
- `src/lib/tree.ts`: `buildTree` and `validate`, all the build-time content checks. `src/lib/blocks.ts` (`loadBlocks`) runs them and throws.
- `src/lib/refs.ts`: reads a body for cites, notes, figures, stray directives and links, which is what `validate` checks. `describe.ts` shares its Markdown `parser`.
- `src/lib/remark-note.ts`, `remark-cite.ts`, `remark-figure.ts`, `remark-restore-directives.ts` (puts ordinary `:colons` back as text), `rehype-gloss.ts`, registered in `astro.config.mjs`.
- `src/lib/figures.ts` (`loadFigures`), `src/lib/figure-svg.ts` (`checkFigure`, `prepareFigure`, `figureElement`), `src/integrations/figures.ts`: figure loading, checks and rendering. The drawings are in `src/figures/`.
- `src/lib/describe.ts`: the meta description from the gloss and the opening of the body.
- `src/pages/`: `index.astro` (the map), `[slug].astro` (a block), `about`, `glossary`, `404`, and `figure-test/[id].astro` (e2e only).
- `src/styles/`: `tokens.css`, `base.css`, `manuscript.css`.

## CI
- `.github/workflows/ci.yml` runs on every pull request and on pushes to `main`: `npm ci`, `check`, `test`, then `e2e` with Chromium. On failure it uploads the Playwright report. Node comes from `.node-version`. Keep CI green before merging.
- `.github/workflows/links.yml` is the weekly (Monday, 03:23 UTC) and on-demand link check. It builds, then runs lychee over the external http(s) links in `dist/`. 200, 206, 403 and 429 count as alive, because some hosts answer bots with 403. It opens, updates or closes one issue labelled `links` ("Dead source links"). It never fails the run. A dead source is fixed in the block's `sources` or `read` with a page that supports the same claim.

## Deploy
`wrangler.jsonc` makes the Worker `sastras` serve `dist/` on the custom domain `sastras.dhanjit.me`. Its build command is `npm run build`, which `wrangler deploy` runs before it uploads. Preview URLs are off. `public/_headers` marks the hashed files under `/_astro/` immutable for a year.

Cloudflare Workers Builds deploys every push to `main`, with no Cloudflare token in GitHub; nothing to run.
- **Branch builds.** Non-production branch builds should be off in the dashboard (Workers & Pages → `sastras` → Settings → Build → Branch control).
- **A red check on a PR.** A red "Workers Builds: sastras" check on a PR means branch builds are on. It doesn't gate merges; `ci` does.
- **Links.** `gh workflow run links` runs the link check on demand, for example after adding many sources.

## Tracking
- Site-level tracker: dhanjit/brain#208.
- Slice issues live in this repo; #1 is the first slice.
