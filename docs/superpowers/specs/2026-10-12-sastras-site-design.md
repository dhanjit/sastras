# Śāstras site — design

- **Date:** 2026-10-12
- **Status:** approved in brainstorming; awaiting spec review
- **Tracking issue:** dhanjit/brain#208 (moves to this repo)
- **Seed:** dhanjit/reading `library/sastras/study-map.{html,md}`, the annotated map with a 134-term glossary

## Goal

A public website that maps the Indian śāstras: the traditions of philosophy and the classical
sciences. Readers explore it by clicking. The home page is the map. Every block on the map
opens its own page, and from there a reader can go deeper, school → sub-school → teacher →
key texts → concepts, down to the depth of well-known texts and no further.

Success means it gets shared and is taken seriously on Reddit (r/IndianPhilosophy,
r/sanskrit, r/hinduism, r/Buddhism, r/philosophy). Concretely:

- the first screen is striking enough to stop a scroll;
- every page is credible to sceptical readers: sourced, even-handed, open to correction;
- it is fast and comfortable on a phone, where most Reddit traffic is;
- any page can be linked and shows a good preview when shared.

## Decisions

| Topic | Decision |
|---|---|
| Navigation | Map home page, plus one page per block. Breadcrumbs and a "where am I" strip show where a page sits on the map. Not a zoomable canvas. |
| Language | Sanskrit first. Titles, categories and technical terms are in romanized Sanskrit (IAST). English is the gloss: a line under the title, a hover/tap meaning on terms, and notes in the margin. Explanations are English sentences that keep the Sanskrit terms rather than translating them away. |
| Devices | One content source, one HTML page per block. CSS alone decides the layout for phone vs desktop. There is no separate mobile version. |
| Look | Palm-leaf manuscript (tāḍapatra), muted. A light "leaf" theme and a dark "lamp-lit" theme that follow the device setting. |
| Stack | Astro, building static pages. TypeScript. Served as Workers static assets on Cloudflare. |
| Content | One Markdown file per block, checked against a schema at build time. Drafted by Claude from public sources; Dhanjit reviews in pull requests. |
| Repo | Public: `dhanjit/sastras`. Code MIT, content CC BY-SA 4.0. |
| Domain | `sastras.dhanjit.me`. This is a working name, and the first deploy fixes it. Renaming afterwards costs a redirect. |

## Architecture

```
src/content/blocks/*.md ─┐
src/content/glossary.yaml ┴─► astro build ──► dist/  (one HTML page + one preview PNG per block)
                              │                 │
                              │ fails on:       └─► Cloudflare Worker, static assets
                              │ schema errors,      sastras.dhanjit.me
                              │ missing sources,
                              │ broken links, orphans
```

There is no server code: the Worker only serves `dist/`. Cloudflare's Git integration
(Workers Builds) builds and deploys on every push to `main`, so no Cloudflare token is
stored in GitHub.

### Repo layout

```
src/
  content.config.ts         schema for blocks and glossary (Astro content collections, zod)
  content/blocks/<slug>.md  one file per block
  content/glossary.yaml     term → meaning; seeded from the annotated map's 134 terms
  lib/tree.ts               parent/child tree, breadcrumbs, map layers, and the build-time checks
  lib/remark-note.ts        :note[...] → margin note
  lib/rehype-gloss.ts       wraps glossary terms for hover/tap
  components/               Map, MapRow, Breadcrumb, LayerStrip, Term, Note, SourceList, StatusPill
  pages/index.astro         the map
  pages/[slug].astro        a block page
  pages/about.astro         method, credit, how to correct
  pages/og/[slug].png.ts    link-preview image per block
  styles/                   tokens.css, base.css, manuscript.css
tests/                      Playwright smoke and accessibility tests
docs/superpowers/specs/     this file
wrangler.jsonc
```

## Content model

A block is one Markdown file. Its filename is the slug, which is also the URL (`/advaita-vedanta`).
URLs are flat and ASCII, and they don't encode the tree, so moving a block never breaks a link.

```markdown
---
title: Advaita Vedānta              # IAST, shown as the heading
devanagari: अद्वैत वेदान्त           # optional, shown small beside the gloss
gloss: non-dualism · “not two”      # English, one line, always visible under the title
kind: subschool                     # layer | school | subschool | person | text | concept
parent: vedanta                     # slug of the parent block; the root layers use `map`
order: 1                            # position among siblings
dates: c. 8th century CE onward     # optional, free text, sourced in the body
status: draft                       # draft | reviewed — only Dhanjit sets reviewed
sources:                            # at least one
  - { id: sep, title: "Stanford Encyclopedia of Philosophy — Śaṅkara", url: "https://plato.stanford.edu/..." }
read:                               # optional: free texts to read (translations, Sanskrit e-texts)
  - { title: "Brahmasūtra-bhāṣya, tr. G. Thibaut", kind: translation, url: "https://..." }
related: [mimamsa, atman]           # optional sideways links
# school-level blocks only:
pramanas: [pratyaksa, anumana, sabda, upamana, arthapatti, anupalabdhi]
vedic_authority: accepts            # accepts | rejects | n/a — places it on the āstika/nāstika side
---
For Advaita, ātman is brahman:note[The witness behind your own thinking is the same as
ultimate reality — not the ego or personality.]. Śaṅkara systematised it in his bhāṣya on the
Brahmasūtra[^sep].
```

- **Citations:** `[^id]` refers to an entry in `sources`, and renders as a numbered footnote that links to the source list.
- **Deeper notes:** `:note[...]` renders as a red-ochre `*`. On wide screens the note sits in the margin beside its line, the way marginal glosses (ṭippaṇī) were written in manuscripts. On narrow screens tapping `*` opens it inline. This needs no JavaScript (the sidenote pattern: a label plus a checkbox).
- **Glossary:** `glossary.yaml` maps a term to a short English meaning. At build time, the first occurrence of each glossary term in a paragraph is wrapped so that it shows its meaning on hover (desktop) or tap (phone). Headings, titles and existing links are skipped. Without JavaScript the term links to its entry on a glossary page.
- **The tree:** `parent` and `order` produce the map, breadcrumbs, "go deeper" lists and the layer strip. Map positions are never typed in by hand.

## Pages

**Home: the map.** It's laid out in study order, as five layers:
1. Foundation: Saṃskṛta, Vyākaraṇa, Pramāṇa Śāstra, Navya-Nyāya.
2. The pramāṇa ruler: which ways of knowing each school accepts.
3. The nine schools, split into the side that rejects the Veda's authority and the side that accepts it.
4. The Veda and the applied śāstras.
5. Vāda: the debates.

Every block shows its IAST name and its English gloss. Blocks without a page yet appear
as "in preparation" and are not links. On a phone the layers stack and the nine schools
become a list. From about 1000px wide they form the full grid of the original map.

**Block page:**
1. Breadcrumb, then the layer strip (five segments, current one lit).
2. IAST title, then the gloss and Devanagari, then `dates · status`.
3. The body, with margin notes and term glosses.
4. "Go deeper": the child blocks, showing their titles and glosses.
5. Related blocks, then "Read the text", then the numbered sources.
6. "Suggest a correction": a link that opens a pre-filled GitHub issue for this page.

**About:** how the content is written and sourced, what `draft` and `reviewed` mean, how to
correct something, and credit to the original map and its walkthrough video
(https://youtu.be/hj6yzj_HlvA).

**Link previews:** every block gets a 1200×630 PNG, generated at build time with satori
and resvg. It shows the title, the gloss, the site name and the layer strip with this block
lit. Each page also gets `og:` and `twitter:` meta tags.

## Visual design: palm-leaf

Starting values for the tokens. The accessibility contrast test in CI has the final say,
and any token that fails it gets darkened.

| Token | Leaf (light) | Lamp-lit (dark) | Use |
|---|---|---|---|
| `--leaf` | `#e4dcc4` | `#1c1914` | page |
| `--leaf-2` | `#ddd3b6` | `#26221b` | notes, cards |
| `--line` | `#c9bd9c` | `#3a3428` | row dividers |
| `--rule` | `#9c8f6e` | `#6b6150` | double margin rules, string-hole mark |
| `--ink` | `#2a2620` | `#ddd3b8` | text |
| `--ink-muted` | `#6e6552` | `#9a8f76` | glosses, metadata |
| `--rubric` | `#8e3b2c` | `#d0806a` | IAST subtitles, `*`, ॥, section labels: the scribe's red |
| `--sourced` / `--draft` | `#4f5838` / `#7a4f1c` | `#a9b58a` / `#d9a85f` | status pills |

- **Type.** All fonts are self-hosted through fontsource and subset to the scripts used.
  - Gentium Book Plus for headings and body, chosen for its complete IAST coverage.
  - Tiro Devanagari Sanskrit for Devanagari, a face designed for Sanskrit.
  - A small system sans for breadcrumbs and labels.
- **Motifs, used sparingly.** A thin double rule under each page header. A string-hole circle in the header margin. ॥ as the divider between sections. Red-ochre for subtitles, notes and section labels, as manuscripts used it.
- **No textures or images in the background.** Text has to stay sharp, and pages have to stay light on mobile data.
- **Accessibility.** Every interactive element shows a visible focus state, animation is turned off for readers who ask for reduced motion, and body text is at least 17px on a phone.

## Writing and sourcing rules

- **Grounded.** Every factual claim traces to a listed source: SEP, IEP, Wikipedia, Britannica, or a published translation's introduction. Each block has at least one source.
- **Own words.** No source text is copied beyond a short quotation with attribution. Verbatim quotes from primary texts give the translator.
- **Even-handed.** Each school is described in its own terms ("for Advaita, …"). The site never declares a school right. Contested matters, such as dates, authorship and interpretations, say they are contested and cite both sides.
- **No romanticizing, no dismissing.** No "ancient India discovered quantum physics" claims, and no "it's all superstition" framing. This is the stance of the source video.
- **Status is honest.** Everything starts as `draft`, and only Dhanjit flips a block to `reviewed`. Pages show their status.
- **Read-the-text links** go only to legal free sources: sacred-texts.com (public-domain translations), Wisdom Library, GRETIL, SARIT, archive.org scans.

## Quality gates

**The build fails on:**
- schema errors;
- a block with no `sources`;
- a `[^id]` with no matching source;
- a `parent` that doesn't exist, or a cycle in the tree;
- a block that can't be reached from the map;
- an internal link to a missing slug;
- a glossary term with an empty meaning.

**CI on every pull request (GitHub Actions):**
- `astro check` (types) and the build, which runs the checks above;
- Playwright tests at 375×812 and 1280×800: the home page renders every layer; a block page renders its title, gloss, "go deeper" list and sources; tapping a term shows its meaning; a `*` note opens; nothing scrolls sideways;
- axe accessibility checks on the same pages, with no serious or critical violations.

**Weekly (scheduled action):**
- a check of every external link (lychee), which opens or updates one issue listing dead links;
- it never blocks a merge.

## First slice (about 13 pages)

| Area | Blocks |
|---|---|
| Map | home, all layers drawn, unwritten blocks marked "in preparation" |
| Foundation | `samskrta`, `vyakarana`, `pramana-sastra`, `navya-nyaya` |
| Deep path | `vedanta` → `advaita-vedanta` → `sankara`; texts `upanisads`, `brahmasutra`, `bhagavad-gita`; concepts `atman`, `brahman`, `maya` |
| Pages | `about`, glossary |

**Done when:**
- the slice is live at `sastras.dhanjit.me`;
- CI is green;
- the link preview renders on a real share (posting a link in a private subreddit or Discord is enough);
- every page in the slice has at least one source and every text block has at least one "read" link.

The other eight schools follow, one pull request per school.

## Out of scope for now

- search (Pagefind, once there are more than ~50 pages);
- accounts and comments (corrections go through GitHub issues);
- analytics beyond Cloudflare's built-in counts;
- Devanagari-only mode;
- translations of the site into other languages;
- an interactive pan/zoom map.

## Open

- **Final name and subdomain:** `sastras` is the working choice; settle it before the first deploy. The trade-off: people searching without diacritics type "shastras", while "sastras" matches the IAST spelling.
