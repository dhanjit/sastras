# Śāstras first slice: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first slice of the site live at `sastras.dhanjit.me`: the map home page, the four Foundation blocks, and the Vedānta → Advaita path with its texts and concepts. Every page is sourced, Sanskrit first, and works on phones. Tracked in dhanjit/sastras#1.

**Architecture:** Astro 7 builds static HTML from one Markdown file per block. A pure TypeScript tree module (unit-tested) checks the content and derives the map, breadcrumbs and child lists; any content error fails the build. Three Markdown plugins add margin notes (`:note[...]`), citations (`:cite[id]`) and the tap-for-meaning glossary. A Cloudflare Worker serves `dist/` as static assets.

**Tech stack:** Astro 7.3.5 with `@astrojs/markdown-remark` 7.3.2 (the `unified` processor), remark-directive, satori + resvg for link-preview images, fontsource (Gentium Book Plus, Tiro Devanagari Sanskrit), Vitest 5, Playwright 1.64 + axe, Wrangler 4, GitHub Actions. TypeScript is pinned to 6.0.3, because `@astrojs/check` does not support TypeScript 7.

**Spec:** [docs/superpowers/specs/2026-10-12-sastras-site-design.md](../specs/2026-10-12-sastras-site-design.md)

---

## Ground rules for whoever executes this

- **Branch:** all work happens on `1-first-slice`. Task 3 opens a draft PR with `Closes #1`, so CI runs on every push. Commit after every task.
- **Verified on Astro 7:** a throwaway build checked the APIs used below. Markdown plugins go through `markdown.processor: unified({...})`, not `markdown.remarkPlugins`. Remark plugins can read frontmatter through `file.data.astro.frontmatter`. Satori needs the latin and latin-ext font files registered under **different** family names, or IAST letters (ā, ṣ, ṇ…) render as boxes. `astro preview` serves `/slug` from `slug.html`.
- **No Devanagari in preview images:** satori cannot shape conjuncts.
- **Glossary seed:** Task 9 reads `~/Code/reading/library/sastras/study-map.html` (dhanjit/reading). Clone that repo first if it is missing.
- **Content:** Tasks 15–18 are writing tasks, not code. Every URL used as a source must be fetched and read before it is cited. Never cite a page that hasn't been opened.

## File map

```
.node-version                     Node 24, read by CI and by Cloudflare Workers Builds
package.json / package-lock.json
astro.config.mjs                  site URL, file-format output, Markdown processor and plugins
tsconfig.json                     strict Astro config
wrangler.jsonc                    Worker "sastras", custom domain, static assets from dist/
vitest.config.ts                  unit tests in tests/unit
playwright.config.ts              phone (375×812, touch) and desktop (1280×800) projects
src/content.config.ts             the blocks collection schema
src/content/blocks/*.md           one file per block (stubs plus 13 written blocks)
src/data/glossary.yaml            term → short meaning
src/lib/vocab.ts                  LAYERS, PRAMANAS, SIDES and their labels (pure)
src/lib/tree.ts                   buildTree(), validate() (pure, unit-tested)
src/lib/links.ts                  SITE, REPO, correctionUrl() (pure, unit-tested)
src/lib/glossary.ts               loadGlossary(), termAnchor() (unit-tested)
src/lib/blocks.ts                 loadBlocks(): collection + validate + tree, cached (Astro-only)
src/lib/remark-note.ts            :note[...] → margin note
src/lib/remark-cite.ts            :cite[id] → numbered source link
src/lib/rehype-gloss.ts           wraps glossary terms
src/layouts/Base.astro            HTML shell, meta/OG tags, fonts, glossary pop-up script
src/components/Breadcrumb.astro
src/components/LayerStrip.astro
src/components/BlockList.astro    rows for "go deeper", related, and the map
src/components/SourceList.astro
src/components/StatusPill.astro
src/pages/index.astro             the map
src/pages/[slug].astro            a block page
src/pages/about.astro
src/pages/glossary.astro
src/pages/404.astro
src/pages/og/[slug].png.ts        link-preview PNGs
src/styles/tokens.css             palm-leaf colours (light and dark), fonts, measures
src/styles/base.css               page frame and typography
src/styles/manuscript.css         components: notes, terms, rows, map, motifs
public/favicon.svg
tests/unit/*.test.ts
tests/e2e/*.spec.ts
.github/workflows/ci.yml
.github/workflows/links.yml
CLAUDE.md
```

---

### Task 1: Scaffold a building Astro project

**Files:**
- Create: `.node-version`, `.gitignore`, `package.json`, `astro.config.mjs`, `tsconfig.json`, `wrangler.jsonc`, `src/pages/index.astro`, `public/favicon.svg`

- [ ] **Step 1: Create the branch**

```bash
cd ~/Code/sastras && git switch -c 1-first-slice
```

- [ ] **Step 2: Write the project files**

`.node-version`:
```
24
```

`.gitignore`:
```
node_modules/
dist/
.astro/
test-results/
playwright-report/
.wrangler/
.DS_Store
.env*
.dev.vars*
```

`package.json`:
```json
{
  "name": "sastras",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview --port 4321",
    "check": "astro check",
    "test": "vitest run --passWithNoTests",
    "e2e": "playwright test"
  }
}
```

`astro.config.mjs`:
```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://sastras.dhanjit.me',
  trailingSlash: 'never',
  build: { format: 'file' },
});
```

`tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

`wrangler.jsonc`:
```jsonc
{
  "name": "sastras",
  "compatibility_date": "2026-10-01",
  "account_id": "939a7fa8a072b9ac7f9c41885fe71380",
  "workers_dev": false,
  "routes": [{ "pattern": "sastras.dhanjit.me", "custom_domain": true }],
  "assets": { "directory": "./dist", "not_found_handling": "404-page", "html_handling": "drop-trailing-slash" }
}
```

`src/pages/index.astro`:
```astro
<html lang="en"><head><meta charset="utf-8" /><title>Śāstras</title></head>
<body><h1>Śāstras</h1></body></html>
```

`public/favicon.svg` (a palm leaf with its string hole):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="2" y="9" width="28" height="14" rx="3" fill="#c9b98f"/><circle cx="9" cy="16" r="2" fill="#5a4a2e"/><path d="M14 13h12M14 16h12M14 19h9" stroke="#5a4a2e" stroke-width="1.2"/></svg>
```

- [ ] **Step 3: Install pinned dependencies**

```bash
npm i -E astro@7.3.5 @astrojs/markdown-remark@7.3.2 remark-directive@4.0.0 unist-util-visit@5.1.0 yaml@2.9.1 satori@0.47.1 @resvg/resvg-js@2.6.2 @fontsource/gentium-book-plus@5.3.0 @fontsource/tiro-devanagari-sanskrit@5.3.0
npm i -DE @astrojs/check@0.9.10 typescript@6.0.3 vitest@5.0.3 @playwright/test@1.64.0 @axe-core/playwright@4.13.0 wrangler@4.149.0 unified remark-parse remark-rehype rehype-stringify @types/mdast @types/hast @types/node@24
```

- [ ] **Step 4: Build and confirm the output**

Run: `npm run build && ls dist`
Expected: the build ends with `Complete!`, and `dist` contains `index.html` and `favicon.svg`.

Run: `npm run check`
Expected: `0 errors`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold Astro 7 site"
```

---

### Task 2: One block page rendered from content

**Files:**
- Create: `src/lib/vocab.ts`, `src/content.config.ts`, `src/content/blocks/advaita-vedanta.md`, `src/pages/[slug].astro`, `playwright.config.ts`, `tests/e2e/pages.spec.ts`

- [ ] **Step 1: Write the failing end-to-end test**

`playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:4321' },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'phone',
      use: { browserName: 'chromium', viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
    },
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } },
  ],
});
```

`tests/e2e/pages.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('a block page shows its Sanskrit title and English gloss', async ({ page }) => {
  await page.goto('/advaita-vedanta');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Advaita Vedānta');
  await expect(page.locator('p.gloss')).toContainText('non-dualism');
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx playwright install chromium
npm run e2e
```
Expected: FAIL on both projects. `/advaita-vedanta` returns a 404 page, so there is no heading.

- [ ] **Step 3: Write the vocabulary, schema, first block and page**

`src/lib/vocab.ts`:
```ts
export const LAYERS = ['foundation', 'pramana', 'schools', 'corpus', 'vada'] as const;
export type Layer = (typeof LAYERS)[number];

export const LAYER_LABEL: Record<Layer, { title: string; gloss: string }> = {
  foundation: { title: 'Ādhāra', gloss: 'the foundation: language, grammar and logic' },
  pramana: { title: 'Pramāṇa', gloss: 'the ways of knowing each school accepts' },
  schools: { title: 'Darśana', gloss: 'the schools, and what each says exists' },
  corpus: { title: 'Śruti and Śāstra', gloss: 'the Veda and the applied sciences' },
  vada: { title: 'Vāda', gloss: 'the debates between the schools' },
};

export const PRAMANAS = ['pratyaksa', 'anumana', 'sabda', 'upamana', 'arthapatti', 'anupalabdhi'] as const;
export type Pramana = (typeof PRAMANAS)[number];

export const PRAMANA_LABEL: Record<Pramana, { title: string; gloss: string }> = {
  pratyaksa: { title: 'Pratyakṣa', gloss: 'perception' },
  anumana: { title: 'Anumāna', gloss: 'inference' },
  sabda: { title: 'Śabda', gloss: 'testimony' },
  upamana: { title: 'Upamāna', gloss: 'comparison' },
  arthapatti: { title: 'Arthāpatti', gloss: 'postulation' },
  anupalabdhi: { title: 'Anupalabdhi', gloss: 'non-perception' },
};

export const SIDES = ['rejects', 'accepts', 'n/a'] as const;
export type Side = (typeof SIDES)[number];

export const SIDE_LABEL: Record<Side, { title: string; gloss: string }> = {
  rejects: { title: 'nāstika', gloss: 'reject the Veda’s authority' },
  accepts: { title: 'āstika', gloss: 'accept the Veda’s authority' },
  'n/a': { title: 'śāstra', gloss: 'sciences, not schools of philosophy' },
};
```

`src/content.config.ts`:
```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { LAYERS, PRAMANAS, SIDES } from './lib/vocab';

const source = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  url: z.url(),
});

const readLink = z.object({
  title: z.string().min(1),
  kind: z.enum(['translation', 'etext', 'scan']),
  url: z.url(),
});

const blocks = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/blocks' }),
  schema: z.object({
    title: z.string().min(1),
    devanagari: z.string().optional(),
    gloss: z.string().min(1),
    kind: z.enum(['topic', 'school', 'subschool', 'person', 'text', 'concept']),
    parent: z.string().min(1),
    layer: z.enum(LAYERS).optional(),
    order: z.number().int(),
    dates: z.string().optional(),
    status: z.enum(['stub', 'draft', 'reviewed']),
    sources: z.array(source).default([]),
    read: z.array(readLink).default([]),
    related: z.array(z.string()).default([]),
    pramanas: z.array(z.enum(PRAMANAS)).optional(),
    vedic_authority: z.enum(SIDES).optional(),
  }),
});

export const collections = { blocks };
```

`src/content/blocks/advaita-vedanta.md`:
```markdown
---
title: Advaita Vedānta
devanagari: अद्वैत वेदान्त
gloss: non-dualism · “not two”
kind: subschool
parent: vedanta
order: 1
status: draft
sources:
  - { id: wiki, title: "Wikipedia — Advaita Vedanta", url: "https://en.wikipedia.org/wiki/Advaita_Vedanta" }
---
For Advaita, the self (ātman) and ultimate reality (brahman) are one.
```

`src/pages/[slug].astro` (minimal for now; Task 7 replaces it):
```astro
---
import { getCollection, render } from 'astro:content';

export async function getStaticPaths() {
  const blocks = await getCollection('blocks', (b) => b.data.status !== 'stub');
  return blocks.map((b) => ({ params: { slug: b.id }, props: { b } }));
}
const { b } = Astro.props;
const { Content } = await render(b);
---
<html lang="en"><head><meta charset="utf-8" /><title>{b.data.title}</title></head>
<body><h1>{b.data.title}</h1><p class="gloss">{b.data.gloss}</p><Content /></body></html>
```

The block's `parent: vedanta` doesn't resolve yet. Nothing checks that until Task 5, and Task 7 adds the `vedanta` block.

- [ ] **Step 4: Run the test and watch it pass**

Run: `npm run e2e`
Expected: PASS, 2 tests (phone and desktop).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: render a block page from the content collection"
```

---

### Task 3: CI on every push, and a draft PR

**Files:**
- Create: `vitest.config.ts`, `.github/workflows/ci.yml`

- [ ] **Step 1: Write the Vitest config**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['tests/unit/**/*.test.ts'] } });
```

- [ ] **Step 2: Write the workflow**

`.github/workflows/ci.yml`:
```yaml
name: ci
on:
  push: { branches: [main] }
  pull_request: {}
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .node-version, cache: npm }
      - run: npm ci
      - run: npm run check
      - run: npm test
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e
      - if: failure()
        uses: actions/upload-artifact@v4
        with: { name: playwright-report, path: playwright-report, retention-days: 7 }
```

- [ ] **Step 3: Confirm it passes locally**

Run: `npm run check && npm test && npm run e2e`
Expected: `0 errors`; Vitest reports no test files and exits 0; Playwright passes 2.

- [ ] **Step 4: Commit, push, and open the draft PR**

```bash
git add -A && git commit -m "ci: type check, unit and browser tests"
git push -u origin 1-first-slice
gh pr create --draft --title "First slice: map home, Foundation, and the Advaita path" --body "Closes #1

Plan: docs/superpowers/plans/2026-10-12-first-slice.md"
```
Expected: the PR exists and its `ci` check runs and passes (`gh pr checks --watch`).

---

### Task 4: Put the skeleton live

**Files:** none changed.

- [ ] **Step 1: Confirm the name with Dhanjit**

**Stop and ask:** "The first deploy creates `sastras.dhanjit.me`. Keep that name, or change it before it goes live?" If it changes, update `name` and `routes[0].pattern` in `wrangler.jsonc`, `site` in `astro.config.mjs`, and `SITE` in Task 7's `src/lib/links.ts`. Commit the change before going on.

- [ ] **Step 2: Check Wrangler is logged in**

Run: `npx wrangler whoami`
Expected: shows the account `939a7fa8a072b9ac7f9c41885fe71380`. If it isn't logged in, Dhanjit runs `npx wrangler login` (a browser OAuth step).

- [ ] **Step 3: Deploy**

```bash
npm run build && npx wrangler deploy
```
Expected: output lists `sastras.dhanjit.me (custom domain)`.

- [ ] **Step 4: Verify it is live**

Run: `curl -s -o /dev/null -w '%{http_code}\n' https://sastras.dhanjit.me/advaita-vedanta`
Expected: `200` (DNS can take a minute or two; retry a few times).

- [ ] **Step 5: Connect automatic deploys (Dhanjit, in the dashboard)**

Ask Dhanjit to do this; it grants Cloudflare access to the GitHub repo, so it is his click:
Cloudflare dashboard → Workers & Pages → `sastras` → Settings → Builds → Connect → `dhanjit/sastras`, production branch `main`, build command `npm run build`, deploy command `npx wrangler deploy`.

From then on every merge to `main` deploys. Nothing to commit.

---

### Task 5: The content tree and build-time checks

**Files:**
- Create: `src/lib/tree.ts`, `src/lib/blocks.ts`, `tests/unit/tree.test.ts`
- Modify: `src/pages/[slug].astro` (load through `loadBlocks`)

- [ ] **Step 1: Write the failing unit tests**

`tests/unit/tree.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildTree, validate, type Block } from '../../src/lib/tree';

const block = (id: string, data: Partial<Block['data']> = {}, body = ''): Block => ({
  id,
  body,
  data: { title: id, parent: 'map', layer: 'schools', order: 1, status: 'draft', sources: [{ id: 'w' }], related: [], ...data },
});

const fixture = [
  block('vedanta', { order: 7 }),
  block('mimamsa', { order: 6 }),
  block('advaita', { parent: 'vedanta', layer: undefined, order: 1 }),
  block('dvaita', { parent: 'vedanta', layer: undefined, order: 3, status: 'stub', sources: [] }),
  block('sankara', { parent: 'advaita', layer: undefined }),
  block('samskrta', { layer: 'foundation' }),
];

describe('buildTree', () => {
  const tree = buildTree(fixture);

  it('lists children in order', () => {
    expect(tree.children('vedanta').map((b) => b.id)).toEqual(['advaita', 'dvaita']);
  });

  it('lists the top-level blocks of a layer in order', () => {
    expect(tree.topLevel('schools').map((b) => b.id)).toEqual(['mimamsa', 'vedanta']);
  });

  it('returns ancestors root-first, without the block itself', () => {
    expect(tree.ancestors('sankara').map((b) => b.id)).toEqual(['vedanta', 'advaita']);
    expect(tree.ancestors('vedanta')).toEqual([]);
  });

  it('finds the layer through the top-level ancestor', () => {
    expect(tree.layerOf('sankara')).toBe('schools');
    expect(tree.layerOf('samskrta')).toBe('foundation');
  });
});

describe('validate', () => {
  it('accepts a consistent tree', () => {
    expect(validate(fixture)).toEqual([]);
  });

  it('reports a missing parent', () => {
    expect(validate([block('x', { parent: 'nowhere', layer: undefined })])).toEqual(['x: parent "nowhere" does not exist']);
  });

  it('requires a layer on top-level blocks and forbids it below', () => {
    expect(validate([block('a', { layer: undefined }), block('b', { parent: 'a', layer: 'vada' })])).toEqual([
      'a: a top-level block needs a layer',
      'b: only top-level blocks set a layer',
    ]);
  });

  it('reports a parent loop', () => {
    const errors = validate([block('a', { parent: 'b', layer: undefined }), block('b', { parent: 'a', layer: undefined })]);
    expect(errors).toContain('a: parent chain loops through "a"');
  });

  it('requires a source on every written block but not on stubs', () => {
    expect(validate([block('a', { sources: [] }), block('b', { status: 'stub', sources: [] })])).toEqual([
      'a: a written block needs at least one source',
    ]);
  });

  it('reports a missing related block, a duplicate source id and an unknown citation', () => {
    const errors = validate([block('a', { sources: [{ id: 'w' }, { id: 'w' }], related: ['ghost'] }, 'Text :cite[sep].')]);
    expect(errors).toEqual([
      'a: related block "ghost" does not exist',
      'a: source id "w" is used twice',
      'a: :cite[sep] has no matching source',
    ]);
  });

  it('reports links to missing pages and to stubs, and allows the fixed pages', () => {
    const errors = validate([...fixture, block('z', {}, 'See [x](/nothing), [d](/dvaita) and [g](/glossary).')]);
    expect(errors).toEqual([
      'z: link to /nothing goes nowhere',
      'z: link to /dvaita points at a page that does not exist yet',
    ]);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test`
Expected: FAIL. The import of `../../src/lib/tree` can't be resolved.

- [ ] **Step 3: Implement the tree**

`src/lib/tree.ts`:
```ts
import type { Layer } from './vocab';

export const ROOT = 'map';
export const PAGES = ['about', 'glossary'] as const;

export interface Block {
  id: string;
  body?: string;
  data: {
    title: string;
    parent: string;
    layer?: Layer;
    order: number;
    status: 'stub' | 'draft' | 'reviewed';
    sources: { id: string }[];
    related: string[];
  };
}

export interface Tree<T extends Block> {
  get(id: string): T | undefined;
  children(id: string): T[];
  ancestors(id: string): T[];
  layerOf(id: string): Layer | undefined;
  topLevel(layer: Layer): T[];
}

const byOrder = (a: Block, b: Block) => a.data.order - b.data.order || a.id.localeCompare(b.id);

export function buildTree<T extends Block>(blocks: T[]): Tree<T> {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const kids = new Map<string, T[]>();
  for (const b of blocks) kids.set(b.data.parent, [...(kids.get(b.data.parent) ?? []), b]);
  for (const list of kids.values()) list.sort(byOrder);

  const ancestors = (id: string): T[] => {
    const chain: T[] = [];
    const seen = new Set([id]);
    let cur = byId.get(id)?.data.parent;
    while (cur && cur !== ROOT && !seen.has(cur)) {
      const b = byId.get(cur);
      if (!b) break;
      seen.add(cur);
      chain.unshift(b);
      cur = b.data.parent;
    }
    return chain;
  };

  return {
    get: (id) => byId.get(id),
    children: (id) => kids.get(id) ?? [],
    ancestors,
    layerOf: (id) => (ancestors(id)[0] ?? byId.get(id))?.data.layer,
    topLevel: (layer) => (kids.get(ROOT) ?? []).filter((b) => b.data.layer === layer),
  };
}

const CITE = /:cite\[([^\]]*)\]/g;
const LINK = /\]\(\/([a-z0-9-]+)\)/g;

export function validate(blocks: Block[]): string[] {
  const errors: string[] = [];
  const byId = new Map(blocks.map((b) => [b.id, b]));
  for (const b of blocks) {
    const { parent, layer, related, sources, status } = b.data;
    if (parent === ROOT) {
      if (!layer) errors.push(`${b.id}: a top-level block needs a layer`);
    } else {
      if (!byId.has(parent)) errors.push(`${b.id}: parent "${parent}" does not exist`);
      if (layer) errors.push(`${b.id}: only top-level blocks set a layer`);
    }
    const seen = new Set([b.id]);
    for (let cur = parent; cur !== ROOT && byId.has(cur); cur = byId.get(cur)!.data.parent) {
      if (seen.has(cur)) {
        errors.push(`${b.id}: parent chain loops through "${cur}"`);
        break;
      }
      seen.add(cur);
    }
    if (status !== 'stub' && sources.length === 0) errors.push(`${b.id}: a written block needs at least one source`);
    for (const r of related) if (!byId.has(r)) errors.push(`${b.id}: related block "${r}" does not exist`);
    const ids = sources.map((s) => s.id);
    for (const id of new Set(ids.filter((x, i) => ids.indexOf(x) !== i))) errors.push(`${b.id}: source id "${id}" is used twice`);
    const body = b.body ?? '';
    for (const [, id] of body.matchAll(CITE)) if (!ids.includes(id)) errors.push(`${b.id}: :cite[${id}] has no matching source`);
    for (const [, slug] of body.matchAll(LINK)) {
      const target = byId.get(slug);
      if (!target && !(PAGES as readonly string[]).includes(slug)) errors.push(`${b.id}: link to /${slug} goes nowhere`);
      else if (target?.data.status === 'stub') errors.push(`${b.id}: link to /${slug} points at a page that does not exist yet`);
    }
  }
  return errors;
}
```

- [ ] **Step 4: Run the unit tests and watch them pass**

Run: `npm test`
Expected: PASS, 11 tests.

- [ ] **Step 5: Load blocks through the checks**

`src/lib/blocks.ts`:
```ts
import { getCollection, type CollectionEntry } from 'astro:content';
import { buildTree, validate, type Tree } from './tree';

export type BlockEntry = CollectionEntry<'blocks'>;

let cache: Promise<{ all: BlockEntry[]; tree: Tree<BlockEntry> }> | undefined;

/** Every block, checked. Any content error fails the build with the full list. */
export function loadBlocks() {
  cache ??= (async () => {
    const all = await getCollection('blocks');
    const errors = validate(all);
    if (errors.length) throw new Error(`Content errors:\n- ${errors.join('\n- ')}`);
    return { all, tree: buildTree(all) };
  })();
  return cache;
}

export const isWritten = (b: BlockEntry) => b.data.status !== 'stub';
```

In `src/pages/[slug].astro`, replace the frontmatter's `getStaticPaths` with:
```ts
import { render } from 'astro:content';
import { loadBlocks, isWritten } from '../lib/blocks';

export async function getStaticPaths() {
  const { all } = await loadBlocks();
  return all.filter(isWritten).map((b) => ({ params: { slug: b.id }, props: { b } }));
}
```

- [ ] **Step 6: Watch the build fail on real content**

Run: `npm run build`
Expected: FAIL with `Content errors:` and `- advaita-vedanta: parent "vedanta" does not exist`. The check works. Add the parent:

`src/content/blocks/vedanta.md`:
```markdown
---
title: Vedānta
devanagari: वेदान्त
gloss: philosophy of the Upaniṣads · “end of the Veda”
kind: school
parent: map
layer: schools
order: 7
status: draft
vedic_authority: accepts
pramanas: [pratyaksa, anumana, sabda, upamana, arthapatti, anupalabdhi]
sources:
  - { id: wiki, title: "Wikipedia — Vedanta", url: "https://en.wikipedia.org/wiki/Vedanta" }
---
Vedānta reads the Upaniṣads as a single teaching about brahman.
```

Run: `npm run build && npm run check && npm test && npm run e2e`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: content tree with build-time checks"
```

---

### Task 6: Palm-leaf look: tokens, fonts, base layout

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/manuscript.css`, `src/layouts/Base.astro`
- Modify: `src/pages/index.astro`, `src/pages/[slug].astro` (wrap in `Base`)

- [ ] **Step 1: Write the styles**

`src/styles/tokens.css`:
```css
:root {
  --leaf: #e4dcc4;
  --leaf-2: #ddd3b6;
  --line: #c9bd9c;
  --rule: #9c8f6e;
  --ink: #2a2620;
  --ink-muted: #5f5747;
  --rubric: #8e3b2c;
  --sourced: #4f5838;
  --draft: #7a4f1c;
  --focus: #8e3b2c;
  --serif: 'Gentium Book Plus', 'Gentium Plus', Georgia, serif;
  --deva: 'Tiro Devanagari Sanskrit', 'Noto Serif Devanagari', serif;
  --sans: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --measure: 40rem;
  --margin-col: 15rem;
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root {
    --leaf: #1c1914;
    --leaf-2: #26221b;
    --line: #3a3428;
    --rule: #6b6150;
    --ink: #ddd3b8;
    --ink-muted: #a39880;
    --rubric: #d0806a;
    --sourced: #a9b58a;
    --draft: #d9a85f;
    --focus: #d0806a;
    color-scheme: dark;
  }
}
```

`src/styles/base.css`:
```css
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--leaf); color: var(--ink); font: 1.0625rem/1.65 var(--serif); }
@media (min-width: 700px) { body { font-size: 1.125rem; } }
a { color: inherit; text-decoration-color: var(--rule); text-underline-offset: 0.18em; }
a:hover { text-decoration-color: var(--rubric); }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
h1, h2, h3 { font-weight: 400; line-height: 1.15; text-wrap: balance; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.skip { position: absolute; left: -999px; }
.skip:focus { left: 1rem; top: 1rem; background: var(--leaf-2); padding: 0.4rem 0.8rem; }

.site-head, .site-foot, .page { max-width: calc(var(--measure) + 2rem); margin-inline: auto; padding-inline: 1rem; }
.page { padding-block: 0.5rem 2rem; }
.page.wide, .site-head.wide { max-width: 76rem; }
@media (min-width: 1100px) {
  .page:not(.wide) { max-width: calc(var(--measure) + var(--margin-col) + 5rem); padding-right: calc(var(--margin-col) + 4rem); }
}
.site-head { display: flex; align-items: center; justify-content: space-between; padding-block: 1rem 0.5rem; }
.site-name { font: 700 1.0625rem var(--serif); letter-spacing: 0.02em; text-decoration: none; }
.site-foot { padding-block: 2rem 3rem; font: 0.875rem/1.5 var(--sans); color: var(--ink-muted); text-align: center; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; animation: none !important; }
}
```

`src/styles/manuscript.css`:
```css
/* motifs */
.hole { width: 0.7rem; height: 0.7rem; border: 1.5px solid var(--rule); border-radius: 50%; }
.rule-double { height: 4px; border-block: 1px solid var(--rule); margin-block: 1rem 1.5rem; }
.danda { color: var(--rubric); letter-spacing: 0.3em; }

/* breadcrumb and layer strip */
.crumbs ol { display: flex; flex-wrap: wrap; gap: 0.25rem 0.5rem; list-style: none; padding: 0; margin: 0 0 0.6rem; font: 0.8125rem/1.4 var(--sans); color: var(--ink-muted); }
.crumbs li + li::before { content: '›'; margin-right: 0.5rem; color: var(--rule); }
.layer-strip { display: flex; gap: 3px; list-style: none; padding: 0; margin: 0 0 1.25rem; max-width: 16rem; }
.layer-strip li { flex: 1; }
.layer-strip a { display: block; height: 6px; background: var(--line); border-radius: 2px; }
.layer-strip .on a { background: var(--rubric); }

/* page header */
.title { font-size: clamp(2rem, 7vw, 2.75rem); margin: 0; }
.gloss { margin: 0.35rem 0 0; color: var(--rubric); font-style: italic; }
.deva { font: normal 1.05em var(--deva); margin-left: 0.6em; color: var(--ink-muted); }
.meta { display: flex; flex-wrap: wrap; gap: 0.4rem 0.8rem; align-items: center; margin: 0.6rem 0 0; font: 0.8125rem var(--sans); color: var(--ink-muted); }
.pill { border: 1px solid currentColor; border-radius: 999px; padding: 0.05rem 0.55rem; font: 0.75rem var(--sans); }
.pill-draft { color: var(--draft); }
.pill-reviewed { color: var(--sourced); }

/* section labels and the ॥ divider */
.sec { font: 600 0.75rem/1 var(--sans); letter-spacing: 0.14em; text-transform: uppercase; color: var(--rubric); margin: 0 0 0.75rem; }
.page > section { margin-top: 2rem; }
.page > section::before { content: '॥'; display: block; text-align: center; color: var(--rubric); letter-spacing: 0.3em; margin-bottom: 1.25rem; }
.page > section.layer::before { content: none; }

/* rows: go deeper, related, the map */
.blocks { list-style: none; padding: 0; margin: 0; }
.row { display: grid; grid-template-columns: 1fr auto; gap: 0.1rem 1rem; padding: 0.7rem 0; border-bottom: 1px solid var(--line); text-decoration: none; min-height: 44px; }
a.row::after { content: '›'; grid-column: 2; grid-row: 1 / span 2; align-self: center; color: var(--rule); }
.row-title { font-weight: 700; }
.row-gloss { grid-column: 1; color: var(--ink-muted); font-size: 0.9375rem; }
.row.prep { color: var(--ink-muted); }
.row.prep .row-title { font-weight: 400; }
.row-tag { grid-column: 2; grid-row: 1 / span 2; align-self: center; font: italic 0.75rem var(--sans); }
.chips { display: flex; flex-wrap: wrap; gap: 0.3rem; list-style: none; padding: 0; margin: 0.4rem 0 0.6rem; }
.chip { font: 0.6875rem var(--sans); border: 1px solid var(--line); border-radius: 999px; padding: 0.05rem 0.5rem; color: var(--ink-muted); }

/* prose, citations, margin notes, glossary terms */
.prose p { margin: 0 0 1em; }
.cite { font: 0.7em var(--sans); margin-left: 0.1em; }
.cite a { text-decoration: none; color: var(--ink-muted); }
.note-mark { color: var(--rubric); cursor: pointer; font-weight: 700; padding: 0 0.2em; vertical-align: super; font-size: 0.85em; line-height: 0; }
.note-toggle { position: absolute; opacity: 0; width: 1px; height: 1px; }
.note:has(.note-toggle:focus-visible) .note-mark { outline: 2px solid var(--focus); outline-offset: 2px; }
.note-body { display: none; }
.note-toggle:checked + .note-body { display: block; margin: 0.5rem 0; padding: 0.45rem 0.75rem; border-left: 2px solid var(--rubric); background: var(--leaf-2); font-size: 0.9375rem; }
@media (min-width: 1100px) {
  .note-body, .note-toggle:checked + .note-body {
    display: block; float: right; clear: right; width: var(--margin-col);
    margin: 0.25rem calc(-1 * var(--margin-col) - 2.5rem) 0.75rem 0;
    padding: 0 0 0 0.7rem; background: none; border-left: 2px solid var(--rubric);
    font-size: 0.875rem; line-height: 1.45;
  }
  .note-mark { cursor: default; }
}
a.term { text-decoration: underline dotted var(--rubric); text-underline-offset: 0.2em; }
#gloss-pop { position: absolute; z-index: 10; max-width: min(20rem, calc(100vw - 2rem)); background: var(--ink); color: var(--leaf); padding: 0.5rem 0.7rem; border-radius: 4px; font: 0.875rem/1.45 var(--sans); }
#gloss-pop b { font: 700 1rem var(--serif); }

/* sources, texts, correction */
.sources, .read { padding-left: 1.4rem; margin: 0; font-size: 0.9375rem; }
.sources li, .read li { margin-bottom: 0.4rem; }
.read-kind { font: 0.75rem var(--sans); color: var(--ink-muted); }
.correct { margin-top: 2rem; font: 0.875rem var(--sans); }

/* home map */
.intro .lede { color: var(--ink-muted); max-width: 36rem; }
.layer { margin-top: 2.5rem; }
.layer-title { font-size: 1.6rem; margin: 0; }
.layer-n { font: 600 0.8rem var(--sans); color: var(--rubric); vertical-align: middle; margin-right: 0.4rem; }
.layer-gloss { margin: 0.2rem 0 0.75rem; color: var(--rubric); font-style: italic; }
.side-label { font: 0.75rem var(--sans); letter-spacing: 0.06em; color: var(--ink-muted); margin: 1rem 0 0.2rem; border-top: 1px dashed var(--rule); padding-top: 0.5rem; }
.side-label b { color: var(--rubric); font-weight: 600; }
@media (min-width: 1000px) {
  .blocks-map { display: grid; grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); gap: 0 1.5rem; }
}
```

- [ ] **Step 2: Write the base layout**

`src/layouts/Base.astro`:
```astro
---
import '@fontsource/gentium-book-plus/400.css';
import '@fontsource/gentium-book-plus/400-italic.css';
import '@fontsource/gentium-book-plus/700.css';
import '@fontsource/tiro-devanagari-sanskrit/400.css';
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/manuscript.css';

interface Props {
  title: string;
  description: string;
  path: string;
  og: string;
  wide?: boolean;
}
const { title, description, path, og, wide = false } = Astro.props;
const url = new URL(path, Astro.site).href;
const image = new URL(og, Astro.site).href;
const fullTitle = path === '/' ? 'Śāstras — a map of Indian philosophy and the classical sciences' : `${title} · Śāstras`;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{fullTitle}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={url} />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Śāstras" />
    <meta property="og:title" content={fullTitle} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={url} />
    <meta property="og:image" content={image} />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="theme-color" content="#e4dcc4" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#1c1914" media="(prefers-color-scheme: dark)" />
  </head>
  <body>
    <a class="skip" href="#main">Skip to content</a>
    <header class:list={['site-head', { wide }]}>
      <a class="site-name" href="/">Śāstras</a>
      <span class="hole" aria-hidden="true"></span>
    </header>
    <main id="main" class:list={['page', { wide }]}><slot /></main>
    <footer class="site-foot">
      <span class="danda" aria-hidden="true">॥</span>
      <p>Drafted from public sources; every page lists its own. <a href="/about">About this map</a> · <a href="/glossary">Glossary</a> · <a href="https://github.com/dhanjit/sastras">Source on GitHub</a></p>
    </footer>
    <script>
      const pop = document.createElement('div');
      pop.id = 'gloss-pop';
      pop.setAttribute('role', 'tooltip');
      pop.hidden = true;
      document.body.append(pop);
      let current: HTMLElement | null = null;
      const hover = matchMedia('(hover: hover)');

      function show(term: HTMLElement) {
        current?.removeAttribute('aria-describedby');
        current = term;
        const b = document.createElement('b');
        b.textContent = term.textContent;
        pop.replaceChildren(b, ' · ', term.dataset.gloss ?? '');
        pop.hidden = false;
        const r = term.getBoundingClientRect();
        const maxX = scrollX + document.documentElement.clientWidth - pop.offsetWidth - 8;
        pop.style.left = `${Math.max(scrollX + 8, Math.min(r.left + scrollX, maxX))}px`;
        pop.style.top = `${r.bottom + scrollY + 6}px`;
        term.setAttribute('aria-describedby', 'gloss-pop');
      }
      function hide() {
        pop.hidden = true;
        current?.removeAttribute('aria-describedby');
        current = null;
      }
      const termOf = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>('a.term') : null);

      document.addEventListener('click', (e) => {
        const t = termOf(e.target);
        if (t) {
          e.preventDefault();
          show(t); // tap or click always shows; tapping elsewhere or Escape hides
        } else if (!pop.contains(e.target as Node)) hide();
      });
      document.addEventListener('mouseover', (e) => {
        const t = termOf(e.target);
        if (t && hover.matches) show(t);
      });
      document.addEventListener('mouseout', (e) => {
        if (termOf(e.target) && hover.matches) hide();
      });
      document.addEventListener('focusin', (e) => {
        const t = termOf(e.target);
        if (t?.matches(':focus-visible')) show(t); // keyboard focus only; taps are handled by click
        else if (!t) hide();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hide();
      });
    </script>
  </body>
</html>
```

- [ ] **Step 3: Use the layout on both pages**

`src/pages/index.astro` (Task 10 replaces this with the map):
```astro
---
import Base from '../layouts/Base.astro';
---
<Base title="Śāstras" description="A map of Indian philosophy and the classical sciences." path="/" og="/og/home.png" wide>
  <h1 class="title">Śāstras</h1>
  <p class="gloss">a map of Indian philosophy and the classical sciences</p>
</Base>
```

In `src/pages/[slug].astro`, replace the template (everything below the frontmatter fence) with:
```astro
<Base title={b.data.title} description={b.data.gloss} path={`/${b.id}`} og={`/og/${b.id}.png`}>
  <header class="block-head">
    <h1 class="title">{b.data.title}</h1>
    <p class="gloss">{b.data.gloss}{b.data.devanagari && <span class="deva" lang="sa">{b.data.devanagari}</span>}</p>
  </header>
  <div class="rule-double" aria-hidden="true"></div>
  <article class="prose"><Content /></article>
</Base>
```
and add `import Base from '../layouts/Base.astro';` to its frontmatter.

- [ ] **Step 4: Check it in the browser at both widths, light and dark**

Run: `npm run build && npm run preview`. Open `http://localhost:4321/advaita-vedanta` at 375px and 1280px wide, and with the OS in dark mode. Expected: leaf background, Gentium headings with no missing-glyph boxes in "Vedānta", the gloss in red-ochre italic, Devanagari in Tiro, and the lamp-lit palette in dark mode.

Run: `npm run check && npm run e2e`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: palm-leaf layout, tokens and fonts"
```

---

### Task 7: The full block page

**Files:**
- Create: `src/lib/links.ts`, `tests/unit/links.test.ts`, `src/components/Breadcrumb.astro`, `src/components/LayerStrip.astro`, `src/components/BlockList.astro`, `src/components/SourceList.astro`, `src/components/StatusPill.astro`
- Modify: `src/pages/[slug].astro`, `tests/e2e/pages.spec.ts`

- [ ] **Step 1: Write the failing tests**

`tests/unit/links.test.ts`:
```ts
import { expect, it } from 'vitest';
import { correctionUrl } from '../../src/lib/links';

it('builds a prefilled GitHub issue link for a page', () => {
  const u = new URL(correctionUrl('advaita-vedanta', 'Advaita Vedānta'));
  expect(u.origin + u.pathname).toBe('https://github.com/dhanjit/sastras/issues/new');
  expect(u.searchParams.get('title')).toBe('Correction: Advaita Vedānta');
  expect(u.searchParams.get('body')).toContain('https://sastras.dhanjit.me/advaita-vedanta');
});
```

Append to `tests/e2e/pages.spec.ts`:
```ts
test('a block page shows where it sits, its status, its sources and a correction link', async ({ page }) => {
  await page.goto('/advaita-vedanta');
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumbs.getByRole('link', { name: 'Map' })).toHaveAttribute('href', '/');
  await expect(crumbs.getByRole('link', { name: 'Vedānta' })).toHaveAttribute('href', '/vedanta');
  await expect(page.locator('.layer-strip li.on')).toHaveCount(1);
  await expect(page.locator('.pill')).toContainText('draft');
  await expect(page.locator('#src-wiki a')).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Advaita_Vedanta');
  await expect(page.getByRole('link', { name: 'Suggest a correction' })).toHaveAttribute('href', /github\.com\/dhanjit\/sastras\/issues\/new/);
});

test('a parent page lists its children under "Go deeper"', async ({ page }) => {
  await page.goto('/vedanta');
  const deeper = page.locator('section', { has: page.getByRole('heading', { name: 'Go deeper' }) });
  await deeper.getByRole('link', { name: /Advaita Vedānta/ }).click();
  await expect(page).toHaveURL(/\/advaita-vedanta$/);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test && npm run e2e`
Expected: the unit test fails (no `links` module). The two new e2e tests fail (no breadcrumb, no "Go deeper").

- [ ] **Step 3: Implement the links module and components**

`src/lib/links.ts`:
```ts
export const SITE = 'https://sastras.dhanjit.me';
export const REPO = 'https://github.com/dhanjit/sastras';

export function correctionUrl(id: string, title: string): string {
  const q = new URLSearchParams({
    title: `Correction: ${title}`,
    body: `Page: ${SITE}/${id}\n\nWhat is wrong:\n\nWhat it should say, with a source:\n`,
    labels: 'correction',
  });
  return `${REPO}/issues/new?${q}`;
}
```

`src/components/Breadcrumb.astro`:
```astro
---
import type { BlockEntry } from '../lib/blocks';
interface Props { trail: BlockEntry[]; current: string }
const { trail, current } = Astro.props;
---
<nav class="crumbs" aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Map</a></li>
    {trail.map((b) => <li>{b.data.status === 'stub' ? b.data.title : <a href={`/${b.id}`}>{b.data.title}</a>}</li>)}
    <li aria-current="page">{current}</li>
  </ol>
</nav>
```

`src/components/LayerStrip.astro`:
```astro
---
import { LAYERS, LAYER_LABEL, type Layer } from '../lib/vocab';
interface Props { current: Layer }
const { current } = Astro.props;
---
<ol class="layer-strip" aria-label="Where this sits on the map">
  {LAYERS.map((l) => (
    <li class:list={{ on: l === current }}>
      <a href={`/#${l}`} aria-current={l === current ? 'location' : undefined}>
        <span class="sr-only">{LAYER_LABEL[l].title}: {LAYER_LABEL[l].gloss}</span>
      </a>
    </li>
  ))}
</ol>
```

`src/components/BlockList.astro`:
```astro
---
import type { BlockEntry } from '../lib/blocks';
import { PRAMANA_LABEL } from '../lib/vocab';
interface Props { blocks: BlockEntry[]; variant?: 'list' | 'map' }
const { blocks, variant = 'list' } = Astro.props;
---
<ul class:list={['blocks', `blocks-${variant}`]}>
  {blocks.map((b) => (
    <li>
      {b.data.status === 'stub' ? (
        <div class="row prep">
          <span class="row-title">{b.data.title}</span>
          <span class="row-gloss">{b.data.gloss}</span>
          <span class="row-tag">in preparation</span>
        </div>
      ) : (
        <a class="row" href={`/${b.id}`}>
          <span class="row-title">{b.data.title}</span>
          <span class="row-gloss">{b.data.gloss}</span>
        </a>
      )}
      {variant === 'map' && b.data.pramanas && (
        <ul class="chips" aria-label="Ways of knowing accepted">
          {b.data.pramanas.map((p) => <li class="chip" title={PRAMANA_LABEL[p].gloss}>{PRAMANA_LABEL[p].title}</li>)}
        </ul>
      )}
    </li>
  ))}
</ul>
```

`src/components/SourceList.astro`:
```astro
---
interface Props { sources: { id: string; title: string; url: string }[] }
const { sources } = Astro.props;
---
<ol class="sources">
  {sources.map((s) => <li id={`src-${s.id}`}><a href={s.url} rel="noopener">{s.title}</a></li>)}
</ol>
```

`src/components/StatusPill.astro`:
```astro
---
interface Props { status: 'stub' | 'draft' | 'reviewed' }
const { status } = Astro.props;
---
{status === 'reviewed'
  ? <span class="pill pill-reviewed">reviewed</span>
  : <span class="pill pill-draft">draft · sourced, not yet reviewed</span>}
```

Replace `src/pages/[slug].astro` entirely:
```astro
---
import { render } from 'astro:content';
import Base from '../layouts/Base.astro';
import Breadcrumb from '../components/Breadcrumb.astro';
import LayerStrip from '../components/LayerStrip.astro';
import BlockList from '../components/BlockList.astro';
import SourceList from '../components/SourceList.astro';
import StatusPill from '../components/StatusPill.astro';
import { loadBlocks, isWritten, type BlockEntry } from '../lib/blocks';
import { correctionUrl } from '../lib/links';

export async function getStaticPaths() {
  const { all } = await loadBlocks();
  return all.filter(isWritten).map((b) => ({ params: { slug: b.id }, props: { b } }));
}
const { b } = Astro.props;
const { tree } = await loadBlocks();
const { Content } = await render(b);
const children = tree.children(b.id);
const related = b.data.related.map((r) => tree.get(r)).filter((x): x is BlockEntry => Boolean(x));
const layer = tree.layerOf(b.id);
---
<Base title={b.data.title} description={`${b.data.title}: ${b.data.gloss}`} path={`/${b.id}`} og={`/og/${b.id}.png`}>
  <Breadcrumb trail={tree.ancestors(b.id)} current={b.data.title} />
  {layer && <LayerStrip current={layer} />}
  <header class="block-head">
    <h1 class="title">{b.data.title}</h1>
    <p class="gloss">{b.data.gloss}{b.data.devanagari && <span class="deva" lang="sa">{b.data.devanagari}</span>}</p>
    <p class="meta">{b.data.dates && <span>{b.data.dates}</span>}<StatusPill status={b.data.status} /></p>
  </header>
  <div class="rule-double" aria-hidden="true"></div>
  <article class="prose"><Content /></article>
  {children.length > 0 && (
    <section><h2 class="sec">Go deeper</h2><BlockList blocks={children} /></section>
  )}
  {related.length > 0 && (
    <section><h2 class="sec">Related</h2><BlockList blocks={related} /></section>
  )}
  {b.data.read.length > 0 && (
    <section>
      <h2 class="sec">Read the text</h2>
      <ul class="read">
        {b.data.read.map((r) => <li><a href={r.url} rel="noopener">{r.title}</a> <span class="read-kind">{r.kind}</span></li>)}
      </ul>
    </section>
  )}
  <section>
    <h2 class="sec">Sources</h2>
    <SourceList sources={b.data.sources} />
    <p class="correct"><a href={correctionUrl(b.id, b.data.title)}>Suggest a correction</a></p>
  </section>
</Base>
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test && npm run check && npm run e2e`
Expected: all pass (12 unit tests; e2e 3 tests × 2 projects).

- [ ] **Step 5: Create the `correction` label and commit**

```bash
gh label create correction --repo dhanjit/sastras --color c5523f --description "A reader-reported error on a page" || true
git add -A && git commit -m "feat: full block page — breadcrumb, layer strip, children, sources, correction link"
```

---

### Task 8: Margin notes and citations

**Files:**
- Create: `src/lib/remark-note.ts`, `src/lib/remark-cite.ts`, `tests/unit/markdown.test.ts`
- Modify: `astro.config.mjs`, `src/content/blocks/advaita-vedanta.md`, `tests/e2e/pages.spec.ts`

- [ ] **Step 1: Write the failing unit tests**

`tests/unit/markdown.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { remarkNote } from '../../src/lib/remark-note';
import { remarkCite } from '../../src/lib/remark-cite';

async function md(src: string, frontmatter: Record<string, unknown> = {}) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkDirective)
    .use(remarkNote)
    .use(remarkCite)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process({ value: src, data: { astro: { frontmatter } } });
  return String(file);
}

describe('remarkNote', () => {
  it('turns :note into an asterisk that toggles a margin note', async () => {
    expect(await md('Ātman is brahman:note[the witness behind thought].')).toContain(
      '<span class="note"><label for="note-1" class="note-mark">*</label><input type="checkbox" id="note-1" class="note-toggle" aria-label="Show note"><span class="note-body">the witness behind thought</span></span>',
    );
  });

  it('numbers notes within a document', async () => {
    const html = await md('a:note[x] b:note[y]');
    expect(html).toContain('id="note-1"');
    expect(html).toContain('id="note-2"');
  });
});

describe('remarkCite', () => {
  it('links to the source by its position in the frontmatter list', async () => {
    const html = await md('A claim:cite[iep].', { sources: [{ id: 'sep' }, { id: 'iep' }] });
    expect(html).toContain('<sup class="cite"><a href="#src-iep" aria-label="Source 2">2</a></sup>');
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test`
Expected: FAIL. The modules `remark-note` and `remark-cite` don't exist.

- [ ] **Step 3: Implement both plugins**

`src/lib/remark-note.ts`:
```ts
import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

/** `:note[text]` → a red asterisk that opens a margin note. Pure CSS toggle, no JavaScript. */
export function remarkNote() {
  return (tree: Root) => {
    let n = 0;
    visit(tree, (node: any) => {
      if (node.type !== 'textDirective' || node.name !== 'note') return;
      n += 1;
      const id = `note-${n}`;
      node.data = { hName: 'span', hProperties: { className: ['note'] } };
      node.children = [
        { type: 'html', value: `<label for="${id}" class="note-mark">*</label><input type="checkbox" id="${id}" class="note-toggle" aria-label="Show note"><span class="note-body">` },
        ...node.children,
        { type: 'html', value: '</span>' },
      ];
    });
  };
}
```

`src/lib/remark-cite.ts`:
```ts
import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

type FileData = { data: { astro?: { frontmatter?: { sources?: { id: string }[] } } } };

/** `:cite[id]` → a superscript number linking to that source in the page's source list. */
export function remarkCite() {
  return (tree: Root, file: FileData) => {
    const sources = file.data.astro?.frontmatter?.sources ?? [];
    visit(tree, (node: any) => {
      if (node.type !== 'textDirective' || node.name !== 'cite') return;
      const id = node.children.map((c: any) => c.value ?? '').join('').replace(/[^a-z0-9-]/g, '');
      const n = sources.findIndex((s) => s.id === id) + 1 || '?';
      node.data = { hName: 'sup', hProperties: { className: ['cite'] } };
      node.children = [{ type: 'html', value: `<a href="#src-${id}" aria-label="Source ${n}">${n}</a>` }];
    });
  };
}
```

- [ ] **Step 4: Run the unit tests and watch them pass**

Run: `npm test`
Expected: PASS, 15 tests.

- [ ] **Step 5: Wire the plugins into Astro and use them in content**

`astro.config.mjs`:
```js
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import remarkDirective from 'remark-directive';
import { remarkNote } from './src/lib/remark-note.ts';
import { remarkCite } from './src/lib/remark-cite.ts';

export default defineConfig({
  site: 'https://sastras.dhanjit.me',
  trailingSlash: 'never',
  build: { format: 'file' },
  markdown: {
    processor: unified({ remarkPlugins: [remarkDirective, remarkNote, remarkCite] }),
  },
});
```

Replace the body of `src/content/blocks/advaita-vedanta.md`:
```markdown
For Advaita, the self (ātman) and ultimate reality (brahman) are one:note[“Self” here means the witness behind your own thinking, not the personality.]:cite[wiki].
```

Append to `tests/e2e/pages.spec.ts`:
```ts
test('a citation links to its source and a note opens', async ({ page }, info) => {
  await page.goto('/advaita-vedanta');
  await expect(page.locator('sup.cite a')).toHaveAttribute('href', '#src-wiki');
  const body = page.locator('.note-body').first();
  if (info.project.name === 'phone') {
    await expect(body).toBeHidden();
    await page.locator('.note-mark').first().tap();
    await expect(body).toBeVisible();
  } else {
    await expect(body).toBeVisible(); // margin note, always shown on wide screens
  }
});
```

- [ ] **Step 6: Run everything**

Run: `npm run check && npm test && npm run e2e`
Expected: all pass. The note test runs a different branch on each project.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: margin notes (:note) and citations (:cite)"
```

---

### Task 9: The glossary — tap or hover for meaning

**Files:**
- Create: `src/data/glossary.yaml` (seeded), `src/lib/glossary.ts`, `src/lib/rehype-gloss.ts`, `tests/unit/glossary.test.ts`, `src/pages/glossary.astro`
- Modify: `astro.config.mjs`, `tests/e2e/pages.spec.ts`

- [ ] **Step 1: Write the failing unit tests**

`tests/unit/glossary.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { loadGlossary, termAnchor } from '../../src/lib/glossary';
import { rehypeGloss } from '../../src/lib/rehype-gloss';

const glossary = new Map([
  ['ātman', 'the self'],
  ['brahman', 'ultimate reality'],
  ['brahmasūtra', 'aphorisms on brahman'],
]);

async function gloss(src: string) {
  const file = await unified().use(remarkParse).use(remarkRehype).use(rehypeGloss, { glossary }).use(rehypeStringify).process(src);
  return String(file);
}

describe('termAnchor', () => {
  it('strips diacritics into a stable ASCII anchor', () => {
    expect(termAnchor('Brahmasūtra')).toBe('g-brahmasutra');
    expect(termAnchor('Navya-Nyāya')).toBe('g-navya-nyaya');
  });
});

describe('loadGlossary', () => {
  it('lower-cases terms and rejects an empty meaning', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gloss-'));
    writeFileSync(join(dir, 'ok.yaml'), 'Ātman: the self\n');
    expect(loadGlossary(join(dir, 'ok.yaml')).get('ātman')).toBe('the self');
    writeFileSync(join(dir, 'bad.yaml'), 'ātman: ""\n');
    expect(() => loadGlossary(join(dir, 'bad.yaml'))).toThrow('glossary.yaml: "ātman" has no meaning');
  });
});

describe('rehypeGloss', () => {
  it('wraps the first occurrence of each term in a paragraph', async () => {
    expect(await gloss('For Advaita, ātman is brahman; ātman again.')).toBe(
      '<p>For Advaita, <a class="term" href="/glossary#g-atman" data-gloss="the self">ātman</a> is <a class="term" href="/glossary#g-brahman" data-gloss="ultimate reality">brahman</a>; ātman again.</p>',
    );
  });

  it('prefers the longest term, keeps the original case, and respects word edges', async () => {
    expect(await gloss('The Brahmasūtra, not brahmanical.')).toBe(
      '<p>The <a class="term" href="/glossary#g-brahmasutra" data-gloss="aphorisms on brahman">Brahmasūtra</a>, not brahmanical.</p>',
    );
  });

  it('leaves headings and links alone', async () => {
    expect(await gloss('# ātman\n\n[ātman](/atman)')).toBe('<h1>ātman</h1>\n<p><a href="/atman">ātman</a></p>');
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test`
Expected: FAIL. The modules `glossary` and `rehype-gloss` don't exist.

- [ ] **Step 3: Implement the glossary loader and plugin**

`src/lib/glossary.ts`:
```ts
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

export type Glossary = Map<string, string>;

/** Reads term → meaning from YAML. Keys are lower-cased; an empty meaning is an error. */
export function loadGlossary(path = 'src/data/glossary.yaml'): Glossary {
  const raw = (parse(readFileSync(path, 'utf8')) ?? {}) as Record<string, unknown>;
  const map: Glossary = new Map();
  for (const [term, meaning] of Object.entries(raw)) {
    if (typeof meaning !== 'string' || !meaning.trim()) throw new Error(`glossary.yaml: "${term}" has no meaning`);
    map.set(term.toLowerCase(), meaning.trim());
  }
  return map;
}

export const termAnchor = (term: string) =>
  'g-' + term.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
```

`src/lib/rehype-gloss.ts`:
```ts
import type { Element, ElementContent, Root, Text } from 'hast';
import { SKIP, visit } from 'unist-util-visit';
import { termAnchor, type Glossary } from './glossary';

const CONTAINERS = new Set(['p', 'li', 'blockquote', 'td']);
const LEAVE_ALONE = new Set(['a', 'sup', 'code', 'pre', 'label', 'button', 'h1', 'h2', 'h3', 'h4']);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Wraps the first occurrence of each glossary term per paragraph in <a class="term" data-gloss>. */
export function rehypeGloss({ glossary }: { glossary: Glossary }) {
  const terms = [...glossary.keys()].sort((a, b) => b.length - a.length).map(escape);
  const re = terms.length ? new RegExp(`(?<![\\p{L}\\p{M}])(${terms.join('|')})(?![\\p{L}\\p{M}])`, 'giu') : null;

  function split(node: Text, used: Set<string>): ElementContent[] {
    const out: ElementContent[] = [];
    let last = 0;
    for (const m of node.value.matchAll(re!)) {
      const key = m[0].toLowerCase();
      if (used.has(key)) continue;
      used.add(key);
      out.push({ type: 'text', value: node.value.slice(last, m.index) });
      out.push({
        type: 'element',
        tagName: 'a',
        properties: { className: ['term'], href: `/glossary#${termAnchor(key)}`, dataGloss: glossary.get(key)! },
        children: [{ type: 'text', value: m[0] }],
      });
      last = m.index! + m[0].length;
    }
    if (last === 0) return [node];
    out.push({ type: 'text', value: node.value.slice(last) });
    return out;
  }

  function wrap(el: Element, used: Set<string>) {
    el.children = el.children.flatMap((child): ElementContent[] => {
      if (child.type === 'text') return split(child, used);
      if (child.type === 'element' && !LEAVE_ALONE.has(child.tagName)) wrap(child, used);
      return [child];
    });
  }

  return (tree: Root) => {
    if (!re) return;
    visit(tree, 'element', (el: Element) => {
      if (!CONTAINERS.has(el.tagName)) return;
      wrap(el, new Set());
      return SKIP;
    });
  };
}
```

- [ ] **Step 4: Run the unit tests and watch them pass**

Run: `npm test`
Expected: PASS, 20 tests.

- [ ] **Step 5: Seed the glossary from the annotated map**

```bash
node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
import { stringify } from 'yaml';
const html = readFileSync(process.env.HOME + '/Code/reading/library/sastras/study-map.html', 'utf8');
const G = Function('return ' + html.match(/const G=(\{[\s\S]*?\n\});/)[1])();
const sorted = Object.fromEntries(Object.keys(G).sort((a, b) => a.localeCompare(b)).map((k) => [k, G[k]]));
writeFileSync('src/data/glossary.yaml', '# term (IAST, lower case) → short English meaning, shown on hover or tap\n' + stringify(sorted));
console.log(Object.keys(sorted).length, 'terms');
"
```
Expected: prints about 138 terms. Open `src/data/glossary.yaml` and confirm it has entries such as `ātman: the self`.

- [ ] **Step 6: Wire it in, add the glossary page and an end-to-end test**

In `astro.config.mjs`, add two imports and the rehype plugin:
```js
import { rehypeGloss } from './src/lib/rehype-gloss.ts';
import { loadGlossary } from './src/lib/glossary.ts';
```
```js
    processor: unified({
      remarkPlugins: [remarkDirective, remarkNote, remarkCite],
      rehypePlugins: [[rehypeGloss, { glossary: loadGlossary() }]],
    }),
```

`src/pages/glossary.astro`:
```astro
---
import Base from '../layouts/Base.astro';
import { loadGlossary, termAnchor } from '../lib/glossary';
const entries = [...loadGlossary().entries()].sort(([a], [b]) => a.localeCompare(b));
---
<Base title="Glossary" description="Short English meanings for the Sanskrit terms used across the map." path="/glossary" og="/og/home.png">
  <header class="block-head">
    <h1 class="title">Kośa</h1>
    <p class="gloss">glossary · the Sanskrit terms used on this site</p>
  </header>
  <div class="rule-double" aria-hidden="true"></div>
  <dl class="glossary">
    {entries.map(([term, meaning]) => (
      <div id={termAnchor(term)}><dt><b>{term}</b></dt><dd>{meaning}</dd></div>
    ))}
  </dl>
</Base>
```

Append to `src/styles/manuscript.css`:
```css
.glossary div { padding: 0.5rem 0; border-bottom: 1px solid var(--line); }
.glossary dt { display: inline; }
.glossary dd { display: inline; margin: 0 0 0 0.5rem; color: var(--ink-muted); }
.glossary div:target { background: var(--leaf-2); }
```

Append to `tests/e2e/pages.spec.ts`:
```ts
test('a Sanskrit term shows its meaning when tapped or clicked', async ({ page }, info) => {
  await page.goto('/advaita-vedanta');
  const term = page.locator('a.term', { hasText: 'ātman' }).first();
  if (info.project.name === 'phone') await term.tap();
  else await term.click();
  await expect(page.locator('#gloss-pop')).toBeVisible();
  await expect(page.locator('#gloss-pop')).toContainText('self');
  await expect(page).toHaveURL(/\/advaita-vedanta$/); // stayed on the page
});
```

- [ ] **Step 7: Run everything**

Run: `npm run check && npm test && npm run e2e`
Expected: all pass. Then open `/glossary#g-atman` in preview and confirm the entry is highlighted.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: glossary with tap/hover meanings and a glossary page"
```

---

### Task 10: The map home page, with every block placed

**Files:**
- Create: the stub blocks in `src/content/blocks/` (generated once, see Step 3), `tests/e2e/home.spec.ts`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Write the failing end-to-end test**

`tests/e2e/home.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('the home page shows all five layers in study order', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h2.layer-title')).toHaveText([/Ādhāra/, /Pramāṇa/, /Darśana/, /Śruti and Śāstra/, /Vāda/]);
});

test('written blocks are links, unwritten ones say "in preparation"', async ({ page }) => {
  await page.goto('/');
  const schools = page.locator('#schools');
  await expect(schools.getByRole('link', { name: /Vedānta/ })).toHaveAttribute('href', '/vedanta');
  const carvaka = schools.locator('.row', { hasText: 'Cārvāka' });
  await expect(carvaka).toContainText('in preparation');
  await expect(schools.getByRole('link', { name: /Cārvāka/ })).toHaveCount(0);
});

test('schools are grouped by whether they accept the Veda, with their pramāṇas', async ({ page }) => {
  await page.goto('/');
  const labels = page.locator('#schools .side-label');
  await expect(labels).toHaveCount(3);
  await expect(labels.nth(0)).toContainText('nāstika');
  const vedanta = page.locator('#schools li', { has: page.getByRole('link', { name: /Vedānta/ }) });
  await expect(vedanta.locator('.chip')).toHaveCount(6);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run e2e -- tests/e2e/home.spec.ts`
Expected: FAIL. The home page has no layers yet.

- [ ] **Step 3: Generate the stub blocks (one-time script, not committed)**

The script only creates files that don't exist yet, so `vedanta.md` and `advaita-vedanta.md` are left alone.

```bash
node --input-type=module -e "
import { existsSync, writeFileSync } from 'node:fs';
const all = '[pratyaksa, anumana, sabda, upamana, arthapatti, anupalabdhi]';
const B = [
  ['samskrta','Saṃskṛta','संस्कृतम्','the Sanskrit language','topic','map','foundation',1],
  ['vyakarana','Vyākaraṇa','व्याकरणम्','grammar','topic','map','foundation',2],
  ['vyakarana-darsana','Vyākaraṇa-darśana','','philosophy of language','topic','map','foundation',3],
  ['pramana-sastra','Pramāṇa-śāstra','प्रमाणशास्त्रम्','theory of knowledge','topic','map','foundation',4],
  ['navya-nyaya','Navya-Nyāya','नव्यन्यायः','the new logic, after c. 1325','topic','map','foundation',5],
  ['pratyaksa','Pratyakṣa','प्रत्यक्षम्','perception','concept','map','pramana',1],
  ['anumana','Anumāna','अनुमानम्','inference','concept','map','pramana',2],
  ['sabda','Śabda','शब्दः','testimony','concept','map','pramana',3],
  ['upamana','Upamāna','उपमानम्','comparison','concept','map','pramana',4],
  ['arthapatti','Arthāpatti','अर्थापत्तिः','postulation','concept','map','pramana',5],
  ['anupalabdhi','Anupalabdhi','अनुपलब्धिः','non-perception','concept','map','pramana',6],
  ['carvaka','Cārvāka','चार्वाकः','materialism','school','map','schools',1,'rejects','[pratyaksa]'],
  ['bauddha','Bauddha','बौद्धदर्शनम्','Buddhist philosophy','school','map','schools',2,'rejects','[pratyaksa, anumana]'],
  ['jaina','Jaina','जैनदर्शनम्','Jain philosophy','school','map','schools',3,'rejects','[pratyaksa, anumana, sabda]'],
  ['sankhya-yoga','Sāṅkhya-Yoga','सांख्ययोगः','dualism and meditative discipline','school','map','schools',4,'accepts','[pratyaksa, anumana, sabda]'],
  ['nyaya-vaisesika','Nyāya-Vaiśeṣika','न्यायवैशेषिकम्','logic and atomist realism','school','map','schools',5,'accepts','[pratyaksa, anumana, sabda, upamana]'],
  ['mimamsa','Mīmāṃsā','मीमांसा','Vedic interpretation','school','map','schools',6,'accepts',all],
  ['sahitya','Sāhitya','साहित्यम्','poetics and aesthetics','school','map','schools',8,'n/a'],
  ['ganita-jyotisa','Gaṇita-Jyotiṣa','गणितज्योतिषम्','mathematics and astronomy','school','map','schools',9,'n/a'],
  ['veda','Veda','वेदः','revealed scripture (śruti)','topic','map','corpus',1],
  ['itihasa-purana','Itihāsa-Purāṇa','इतिहासपुराणम्','epics and ancient lore','topic','map','corpus',2],
  ['dharmasastra','Dharmaśāstra','धर्मशास्त्रम्','law and duty','topic','map','corpus',3],
  ['arthasastra','Arthaśāstra','अर्थशास्त्रम्','statecraft','topic','map','corpus',4],
  ['vada','Vāda','वादः','the debates between the schools','topic','map','vada',1],
  ['visistadvaita','Viśiṣṭādvaita','विशिष्टाद्वैतम्','qualified non-dualism','subschool','vedanta','',2],
  ['dvaita','Dvaita','द्वैतम्','dualism','subschool','vedanta','',3],
  ['upanisads','Upaniṣad','उपनिषद्','the philosophical end of the Veda','text','vedanta','',4],
  ['brahmasutra','Brahmasūtra','ब्रह्मसूत्रम्','aphorisms on brahman','text','vedanta','',5],
  ['bhagavad-gita','Bhagavad Gītā','भगवद्गीता','the song of the Lord','text','vedanta','',6],
  ['atman','Ātman','आत्मन्','the self','concept','vedanta','',7],
  ['brahman','Brahman','ब्रह्मन्','ultimate reality','concept','vedanta','',8],
  ['sankara','Śaṅkara','शङ्कराचार्यः','the great teacher of Advaita','person','advaita-vedanta','',1],
  ['maya','Māyā','माया','appearance; the one seen as many','concept','advaita-vedanta','',2],
];
let made = 0;
for (const [id, title, deva, gloss, kind, parent, layer, order, side, pramanas] of B) {
  const path = 'src/content/blocks/' + id + '.md';
  if (existsSync(path)) continue;
  const lines = ['---', 'title: ' + title];
  if (deva) lines.push('devanagari: ' + deva);
  lines.push('gloss: \"' + gloss + '\"', 'kind: ' + kind, 'parent: ' + parent);
  if (layer) lines.push('layer: ' + layer);
  lines.push('order: ' + order, 'status: stub');
  if (side) lines.push('vedic_authority: \"' + side + '\"');
  if (pramanas) lines.push('pramanas: ' + pramanas);
  lines.push('---', '');
  writeFileSync(path, lines.join('\n'));
  made++;
}
console.log(made, 'stubs written');
"
```
Expected: `33 stubs written`. Run `npm run build`; it must pass, which shows the whole tree checks out.

- [ ] **Step 4: Write the map page**

Replace `src/pages/index.astro`:
```astro
---
import Base from '../layouts/Base.astro';
import BlockList from '../components/BlockList.astro';
import { loadBlocks } from '../lib/blocks';
import { LAYERS, LAYER_LABEL, SIDES, SIDE_LABEL } from '../lib/vocab';

const { tree } = await loadBlocks();
const schools = tree.topLevel('schools');
---
<Base title="Śāstras" description="An explorable map of Indian philosophy and the classical sciences: Sanskrit first, every claim sourced." path="/" og="/og/home.png" wide>
  <header class="intro">
    <h1 class="title">Śāstras</h1>
    <p class="gloss">a map of Indian philosophy and the classical sciences</p>
    <p class="lede">Read it top to bottom, in the order a student learns: the language, then grammar and the ways of knowing, then one of the schools, then its texts, and finally the debates. Every name opens its own page.</p>
  </header>
  {LAYERS.map((layer, i) => (
    <section class="layer" id={layer} aria-labelledby={`h-${layer}`}>
      <h2 class="layer-title" id={`h-${layer}`}><span class="layer-n">{i + 1}</span>{LAYER_LABEL[layer].title}</h2>
      <p class="layer-gloss">{LAYER_LABEL[layer].gloss}</p>
      {layer === 'schools'
        ? SIDES.map((side) => (
            <>
              <p class="side-label"><b>{SIDE_LABEL[side].title}</b> · {SIDE_LABEL[side].gloss}</p>
              <BlockList blocks={schools.filter((s) => (s.data.vedic_authority ?? 'n/a') === side)} variant="map" />
            </>
          ))
        : <BlockList blocks={tree.topLevel(layer)} variant="map" />}
    </section>
  ))}
</Base>
```

- [ ] **Step 5: Run the tests and look at it**

Run: `npm run check && npm run e2e`
Expected: all pass. In preview, at 375px the layers stack as lists; at 1280px each layer's blocks form a grid.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: the map home page and stubs for every block on it"
```

---

### Task 11: About page and a 404

**Files:**
- Create: `src/pages/about.astro`, `src/pages/404.astro`
- Modify: `tests/e2e/home.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/e2e/home.spec.ts`:
```ts
test('the about page explains the method and credits the original map', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Paricaya');
  await expect(page.getByRole('link', { name: /Navigating Indian Śāstras/ })).toHaveAttribute('href', 'https://youtu.be/hj6yzj_HlvA');
});

test('an unknown address shows the 404 page', async ({ page }) => {
  const res = await page.goto('/no-such-page');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('link', { name: 'Back to the map' })).toBeVisible();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run e2e -- tests/e2e/home.spec.ts`
Expected: the two new tests fail.

- [ ] **Step 3: Write the pages**

`src/pages/about.astro`:
```astro
---
import Base from '../layouts/Base.astro';
---
<Base title="About" description="How this map of the śāstras is written, sourced and corrected." path="/about" og="/og/home.png">
  <header class="block-head">
    <h1 class="title">Paricaya</h1>
    <p class="gloss">introduction · how this map is made</p>
  </header>
  <div class="rule-double" aria-hidden="true"></div>
  <article class="prose">
    <p>The śāstras are the disciplined fields of Indian learning: grammar, logic, the schools of philosophy, poetics, mathematics, law. This site lays them out as a map you can walk through. It follows the order a traditional student learns them, from the language at the bottom to the debates at the top.</p>
    <h2 class="sec">How pages are written</h2>
    <p>Each page is drafted from public sources: encyclopedias such as the Stanford Encyclopedia of Philosophy and the Internet Encyclopedia of Philosophy, Wikipedia, and the introductions to published translations. The sources are listed at the foot of every page, and the small numbers in the text point to them. The text is our own; quotations from primary texts name their translator.</p>
    <p>Each school is described in its own terms. The map doesn't take sides between them, and where scholars disagree, on dates, authorship or meaning, the page says so.</p>
    <h2 class="sec">Draft and reviewed</h2>
    <p>Every page starts as a <b>draft</b>: sourced, but not yet checked line by line. A page is marked <b>reviewed</b> once that check is done. Treat drafts as a careful first reading, not the last word.</p>
    <h2 class="sec">Corrections</h2>
    <p>Every page ends with a "Suggest a correction" link. It opens a GitHub issue for that page; please include a source. The whole site, text and code, is open at <a href="https://github.com/dhanjit/sastras">github.com/dhanjit/sastras</a>.</p>
    <h2 class="sec">Credit</h2>
    <p>The structure of the map comes from the study map presented in the video <a href="https://youtu.be/hj6yzj_HlvA">Navigating Indian Śāstras</a>, which reads the tradition as a curriculum in which each layer is a prerequisite for the next. The pages here expand that map; any errors in them are ours.</p>
    <h2 class="sec">Licence</h2>
    <p>Text: <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. Code: MIT.</p>
  </article>
</Base>
```

`src/pages/404.astro`:
```astro
---
import Base from '../layouts/Base.astro';
---
<Base title="Not found" description="This page is not on the map." path="/404" og="/og/home.png">
  <header class="block-head">
    <h1 class="title">Na labdham</h1>
    <p class="gloss">not found · this page isn’t on the map yet</p>
  </header>
  <div class="rule-double" aria-hidden="true"></div>
  <p><a href="/">Back to the map</a></p>
</Base>
```

Add the licence files: `LICENSE` (MIT, copyright 2026 Dhanjit Das) and `LICENSE-CONTENT.md` (one line: "Text in `src/content/` and `src/data/` is licensed CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/").

- [ ] **Step 4: Run the tests**

Run: `npm run e2e`
Expected: all pass. If `astro preview` returns 200 rather than 404 for the 404 page, change that assertion to check the page content only, and verify the real status with `curl` against the Worker after deploy (Task 20). The Worker's `not_found_handling: "404-page"` returns 404.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: about page, 404 page, licences"
```

---

### Task 12: Link-preview images

**Files:**
- Create: `src/pages/og/[slug].png.ts`, `tests/e2e/og.spec.ts`

- [ ] **Step 1: Write the failing test**

`tests/e2e/og.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('every page points at its own preview image, and the image exists', async ({ page, request }) => {
  await page.goto('/advaita-vedanta');
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toBe('https://sastras.dhanjit.me/og/advaita-vedanta.png');
  const res = await request.get('/og/advaita-vedanta.png');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('image/png');
  expect((await request.get('/og/home.png')).status()).toBe(200);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run e2e -- tests/e2e/og.spec.ts --project desktop`
Expected: FAIL. `/og/advaita-vedanta.png` returns 404.

- [ ] **Step 3: Write the endpoint**

`src/pages/og/[slug].png.ts`:
```ts
import type { APIRoute, GetStaticPaths } from 'astro';
import { readFileSync } from 'node:fs';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { loadBlocks, isWritten } from '../../lib/blocks';
import { LAYERS, type Layer } from '../../lib/vocab';

// latin and latin-ext must be registered under different names, or IAST letters render as boxes.
const font = (f: string) => readFileSync(`node_modules/@fontsource/gentium-book-plus/files/gentium-book-plus-${f}.woff`);
const fonts = [
  { name: 'Gentium', data: font('latin-400-normal'), weight: 400 as const, style: 'normal' as const },
  { name: 'GentiumExt', data: font('latin-ext-400-normal'), weight: 400 as const, style: 'normal' as const },
  { name: 'Gentium', data: font('latin-400-italic'), weight: 400 as const, style: 'italic' as const },
  { name: 'GentiumExt', data: font('latin-ext-400-italic'), weight: 400 as const, style: 'italic' as const },
];
const C = { leaf: '#e4dcc4', ink: '#2a2620', muted: '#5f5747', rubric: '#8e3b2c', line: '#c9bd9c', rule: '#9c8f6e' };

type Props = { title: string; gloss: string; layer?: Layer };

export const getStaticPaths = (async () => {
  const { all, tree } = await loadBlocks();
  return [
    { params: { slug: 'home' }, props: { title: 'Śāstras', gloss: 'a map of Indian philosophy and the classical sciences' } },
    ...all.filter(isWritten).map((b) => ({
      params: { slug: b.id },
      props: { title: b.data.title, gloss: b.data.gloss, layer: tree.layerOf(b.id) },
    })),
  ];
}) satisfies GetStaticPaths;

const el = (style: Record<string, unknown>, children?: unknown) => ({ type: 'div', props: { style, children } });

export const GET: APIRoute = async ({ props }) => {
  const { title, gloss, layer } = props as Props;
  const strip = el({ display: 'flex', gap: 8, width: 360 }, LAYERS.map((l) => el({ flex: 1, height: 10, borderRadius: 4, background: l === layer ? C.rubric : C.line })));
  const card = el(
    { width: 1200, height: 630, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: C.leaf, color: C.ink, padding: '64px 80px', fontFamily: 'Gentium, GentiumExt' },
    [
      el({ display: 'flex', height: 6, borderTop: `1.5px solid ${C.rule}`, borderBottom: `1.5px solid ${C.rule}` }),
      el({ display: 'flex', flexDirection: 'column', gap: 18 }, [
        el({ fontSize: title.length > 20 ? 84 : 108, lineHeight: 1.05 }, title),
        el({ fontSize: 44, color: C.rubric, fontStyle: 'italic' }, gloss),
      ]),
      el({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, [el({ fontSize: 32, color: C.muted }, 'Śāstras · sastras.dhanjit.me'), strip]),
    ],
  );
  const svg = await satori(card as Parameters<typeof satori>[0], { width: 1200, height: 630, fonts });
  return new Response(new Resvg(svg).render().asPng(), { headers: { 'Content-Type': 'image/png' } });
};
```

- [ ] **Step 4: Run the test and look at an image**

Run: `npm run e2e -- tests/e2e/og.spec.ts`
Expected: PASS. Open `dist/og/advaita-vedanta.png` and `dist/og/home.png`. Check that the diacritics render (no boxes), the gloss is in red-ochre italic, and the layer strip lights the third segment for Advaita.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: per-page link-preview images"
```

---

### Task 13: Phone, desktop and accessibility checks

**Files:**
- Create: `tests/e2e/quality.spec.ts`

- [ ] **Step 1: Write the tests**

`tests/e2e/quality.spec.ts`:
```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const path of ['/', '/advaita-vedanta', '/about', '/glossary']) {
  test(`${path} never scrolls sideways`, async ({ page }) => {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test(`${path} has no serious accessibility problems`, async ({ page }) => {
    await page.goto(path);
    const { violations } = await new AxeBuilder({ page }).analyze();
    const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  });
}

test('dark mode switches to the lamp-lit palette', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/advaita-vedanta');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(28, 25, 20)');
});
```

- [ ] **Step 2: Run them**

Run: `npm run e2e -- tests/e2e/quality.spec.ts`
Expected: PASS. If axe reports `color-contrast`, darken the named token in `src/styles/tokens.css` (keep its hue) and re-run; fix every finding, don't suppress any. Repeat the axe test in dark mode by adding `await page.emulateMedia({ colorScheme: 'dark' })` temporarily, and fix any dark-mode contrast findings the same way.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "test: no sideways scroll, axe checks, dark mode"
```

---

### Task 14: Weekly dead-link check

**Files:**
- Create: `.github/workflows/links.yml`

- [ ] **Step 1: Write the workflow**

`.github/workflows/links.yml`:
```yaml
name: links
on:
  schedule: [{ cron: '0 3 * * 1' }]
  workflow_dispatch: {}
permissions: { contents: read, issues: write }
jobs:
  links:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .node-version, cache: npm }
      - run: npm ci && npm run build
      - id: lychee
        uses: lycheeverse/lychee-action@v2
        with:
          args: --no-progress --max-concurrency 4 --scheme https --scheme http --accept 200,206,429 --exclude-path dist/og 'dist/**/*.html'
          output: lychee/out.md
          fail: false
      - id: existing
        if: steps.lychee.outputs.exit_code != 0
        env: { GH_TOKEN: '${{ github.token }}' }
        run: echo "number=$(gh issue list --repo '${{ github.repository }}' --label links --state open --json number -q '.[0].number')" >> "$GITHUB_OUTPUT"
      - if: steps.lychee.outputs.exit_code != 0
        uses: peter-evans/create-issue-from-file@v5
        with:
          title: Dead source links
          content-filepath: lychee/out.md
          labels: links
          issue-number: ${{ steps.existing.outputs.number }}
```

- [ ] **Step 2: Create the label and run it once**

```bash
gh label create links --repo dhanjit/sastras --color 9c8f6e --description "Dead external links found by the weekly check" || true
git add -A && git commit -m "ci: weekly dead-link check" && git push
gh workflow run links --repo dhanjit/sastras --ref 1-first-slice
```
Expected: the run finishes green (`gh run watch`). If any links are dead it opens an issue labelled `links`; fix them in Tasks 15–18.

---

## Content tasks (15–18)

These four tasks turn 13 stubs into written pages. They are writing, not code, so instead of code each task gives the procedure, the rules and the per-page brief.

### How to write one block (applies to every page in Tasks 15–18)

1. **Gather sources first.** For each candidate URL in the brief, fetch it (WebFetch) and read the relevant part. Keep a source only if the page exists and actually supports what you will say. Aim for at least two per block: one encyclopedia (SEP, IEP, Britannica) and Wikipedia. If a candidate URL 404s, search the same site for the right entry; don't guess URLs.
2. **Edit the stub file**, keeping its `title`, `devanagari`, `gloss`, `kind`, `parent`, `layer`, `order` and school fields. Then:
   - set `status: draft`;
   - add `dates` where the brief asks for it;
   - add `sources` (ids short and lower-case: `sep`, `iep`, `wiki`, `brit`);
   - add `read` for text blocks;
   - add `related` where useful.
3. **Write the body: 150–350 words of English sentences that keep the Sanskrit terms.** Rules:
   - Name schools' views in their own terms ("For Advaita, …"). Never write a school's claim as plain fact.
   - Put `:cite[id]` after every sentence or clause that states a fact. Each one must point to a source you read that says it.
   - Add at least one `:note[...]` where a term needs a deeper explanation than a gloss gives.
   - Link other blocks with `[text](/slug)`, and only to blocks that are written (the build rejects links to stubs).
   - Say when dates, authorship or interpretation are contested, and cite both views.
   - Write in your own words. Quote at most a short phrase, in quotation marks, with its source.
   - No "ancient India discovered X" claims and no dismissive framing.
4. **Glossary:** any Sanskrit term the page uses without an in-line English meaning must exist in `src/data/glossary.yaml`. Add it (lower-case key, meaning in under ten words).
5. **Check:** `npm run build && npm run e2e` must pass. Then read the page in preview at phone width.

---

### Task 15: Foundation — four blocks

**Files:** modify `src/content/blocks/{samskrta,vyakarana,pramana-sastra,navya-nyaya}.md`, `src/data/glossary.yaml`

- [ ] **Step 1: `samskrta` (Saṃskṛta)**

Cover: what Sanskrit is (an Indo-Aryan language; Vedic and Classical stages), and why the śāstras are written in it. Also that Buddhist and Jain traditions wrote in Pāli and Prakrit as well. Add a note on the romanization (IAST) used across the site. Candidate sources: `https://en.wikipedia.org/wiki/Sanskrit`, `https://www.britannica.com/topic/Sanskrit-language`.

- [ ] **Step 2: `vyakarana` (Vyākaraṇa)**

Cover: the trio of Pāṇini's Aṣṭādhyāyī (about 4,000 rules), Kātyāyana's vārttikas and Patañjali's Mahābhāṣya; grammar as a generative rule system; its place among the six Vedāṅgas; the teaching texts (Siddhāntakaumudī and the shorter Laghu-siddhāntakaumudī). Candidate sources: `https://en.wikipedia.org/wiki/Vy%C4%81kara%E1%B9%87a`, `https://en.wikipedia.org/wiki/P%C4%81%E1%B9%87ini`, `https://www.britannica.com/biography/Panini-Indian-grammarian`.

- [ ] **Step 3: `pramana-sastra` (Pramāṇa-śāstra)**

Cover: pramāṇa (means of valid knowledge) against prameya (what is known). The six pramāṇas, and the fact that schools accept different numbers of them, which is what the home map's chips show. Each tradition wrote its own treatise. Candidate sources: `https://plato.stanford.edu/entries/epistemology-india/`, `https://en.wikipedia.org/wiki/Pramana`.

- [ ] **Step 4: `navya-nyaya` (Navya-Nyāya)**

Cover: Gaṅgeśa's Tattvacintāmaṇi (Mithilā, 14th century); its technical vocabulary (avacchedaka, vyāpti, pratiyogin), each explained in a `:note`; how later grammar, law, poetics and Vedānta came to be written in its idiom; and the usual way in, Annaṃbhaṭṭa's Tarkasaṅgraha. Set `dates: from c. 1325 CE`. Candidate sources: `https://en.wikipedia.org/wiki/Navya-Ny%C4%81ya`, `https://plato.stanford.edu/entries/nyaya/` (verify it covers Navya-Nyāya before citing it).

- [ ] **Step 5: Check and commit**

Run: `npm run build && npm run e2e`
Expected: pass.
```bash
git add -A && git commit -m "content: Foundation — Saṃskṛta, Vyākaraṇa, Pramāṇa-śāstra, Navya-Nyāya"
```

---

### Task 16: Vedānta, Advaita Vedānta, Śaṅkara

**Files:** modify `src/content/blocks/{vedanta,advaita-vedanta,sankara}.md`, `src/data/glossary.yaml`

- [ ] **Step 1: `vedanta` (rewrite the placeholder)**

Cover: Vedānta as Uttara Mīmāṃsā, the inquiry into the Upaniṣads; the prasthānatrayī (Upaniṣads, Brahmasūtra, Bhagavad Gītā), which every Vedānta school must comment on; the three best-known schools (Advaita, Viśiṣṭādvaita, Dvaita), and that there are others (for example Bhedābheda). Make clear that the six pramāṇas shown on the map hold for Advaita, while Viśiṣṭādvaita and Dvaita accept three; put this in a `:note` with a citation. Link `/advaita-vedanta`, `/upanisads`, `/brahmasutra`, `/bhagavad-gita`, `/atman`, `/brahman` (all written by the end of Task 18; write Task 17–18 pages before building if a link fails). Candidate sources: `https://en.wikipedia.org/wiki/Vedanta`, `https://www.britannica.com/topic/Vedanta`, `https://iep.utm.edu/` (search "Vedānta").

- [ ] **Step 2: `advaita-vedanta` (rewrite the placeholder)**

Cover: ātman is brahman; māyā and avidyā; the two standpoints, conventional (vyāvahārika) and ultimate (pāramārthika); liberation through knowledge (jñāna). Teachers: Gauḍapāda, then Śaṅkara, then the later Bhāmatī and Vivaraṇa sub-schools. Mention the long debate with Dvaita (Nyāyāmṛta ⇄ Advaitasiddhi). Set `dates: c. 7th–8th century CE onward` and `related: [maya, atman, brahman]`. Keep the existing `:note` on "self", and keep a glossary term (ātman) in the first paragraph, because the Task 9 e2e test depends on both. Candidate sources: `https://iep.utm.edu/advaita-vedanta/` (verify), `https://en.wikipedia.org/wiki/Advaita_Vedanta`, `https://plato.stanford.edu/entries/shankara/` (verify; search SEP if missing).

- [ ] **Step 3: `sankara` (Śaṅkara)**

Cover: traditional dates against scholarly ones (c. 700–750 CE vs the older 788–820). Say it's contested and cite both. Works whose authorship is generally accepted (the Brahmasūtra-bhāṣya, commentaries on the principal Upaniṣads and the Gītā), and that many works attributed to him are doubted. Treat the hagiographies (digvijaya) and the founding of the maṭhas as tradition, marked as such. Set `dates`. Candidate sources: `https://en.wikipedia.org/wiki/Adi_Shankara`, `https://www.britannica.com/biography/Shankara`, the IEP/SEP entry found in Step 2.

- [ ] **Step 4: Check and commit**

Run: `npm run build && npm run e2e`
Expected: pass. Links to Task 17–18 pages fail until those exist; if so, finish Tasks 17–18 first and commit them together.
```bash
git add -A && git commit -m "content: Vedānta, Advaita Vedānta, Śaṅkara"
```

---

### Task 17: The three texts

**Files:** modify `src/content/blocks/{upanisads,brahmasutra,bhagavad-gita}.md`, `src/data/glossary.yaml`

Each text block needs at least one `read` link to a legal free edition. Fetch each one to confirm it is the right text.

- [ ] **Step 1: `upanisads` (Upaniṣad)**

Cover: the principal Upaniṣads (about a dozen, often given as 10–13); the oldest are the Bṛhadāraṇyaka and Chāndogya, which many scholars place before the Buddha. Give date ranges as contested and cited. The great sayings (mahāvākya), with one example and a `:note` on its meaning. Set `related: [veda, atman, brahman]`. Read links: Max Müller's translation in *Sacred Books of the East* vols 1 and 15 at `https://sacred-texts.com/hin/sbe01/index.htm` and `https://sacred-texts.com/hin/sbe15/index.htm` (`kind: translation`); a Sanskrit e-text from GRETIL (`https://gretil.sub.uni-goettingen.de/`, find the Upaniṣad files; `kind: etext`). Candidate sources: `https://en.wikipedia.org/wiki/Upanishads`, `https://www.britannica.com/topic/Upanishad`.

- [ ] **Step 2: `brahmasutra` (Brahmasūtra)**

Cover: attributed to Bādarāyaṇa; about 555 sūtras in four chapters; so terse it can only be read through a commentary; every Vedānta school writes one, which is why the schools differ. Read links: Thibaut's translation with Śaṅkara's commentary, SBE vols 34 and 38 (`https://sacred-texts.com/hin/sbe34/index.htm`, `https://sacred-texts.com/hin/sbe38/index.htm`). Candidate sources: `https://en.wikipedia.org/wiki/Brahma_Sutras`, `https://www.britannica.com/topic/Brahma-sutra`.

- [ ] **Step 3: `bhagavad-gita` (Bhagavad Gītā)**

Cover: 700 verses in the Bhīṣma-parvan of the Mahābhārata; a dialogue between Kṛṣṇa and Arjuna; its dating is contested; the paths of action, devotion and knowledge (karma, bhakti, jñāna); Śaṅkara, Rāmānuja and Madhva each read it in their own way. Read links: Telang's translation, SBE vol 8 (`https://sacred-texts.com/hin/sbe08/index.htm`), and a Sanskrit e-text from GRETIL. Candidate sources: `https://en.wikipedia.org/wiki/Bhagavad_Gita`, `https://www.britannica.com/topic/Bhagavadgita`.

- [ ] **Step 4: Check and commit**

Run: `npm run build && npm run e2e`
Expected: pass.
```bash
git add -A && git commit -m "content: Upaniṣads, Brahmasūtra, Bhagavad Gītā"
```

---

### Task 18: The three concepts

**Files:** modify `src/content/blocks/{atman,brahman,maya}.md`, `src/data/glossary.yaml`

- [ ] **Step 1: `atman` (Ātman)**

Cover: the self in the Upaniṣads; that schools disagree about it (for Nyāya-Vaiśeṣika a substance with qualities, for Advaita identical with brahman, for Viśiṣṭādvaita and Dvaita distinct in different ways); the Buddhist denial (anātman), described in Buddhist terms. Set `related: [brahman, advaita-vedanta]`. Candidate sources: `https://en.wikipedia.org/wiki/%C4%80tman_(Hinduism)`, `https://www.britannica.com/topic/atman`.

- [ ] **Step 2: `brahman` (Brahman)**

Cover: the ultimate reality of the Upaniṣads; with qualities and without (saguṇa and nirguṇa); the description sat-cit-ānanda, with a `:note`; how Advaita, Viśiṣṭādvaita and Dvaita relate brahman to the world and to selves. Set `related: [atman, maya]`. Candidate sources: `https://en.wikipedia.org/wiki/Brahman`, `https://www.britannica.com/topic/brahman`.

- [ ] **Step 3: `maya` (Māyā)**

Cover: in Advaita, the appearance of the many in the one; "neither real nor unreal" (anirvacanīya), in a `:note`; the rope-and-snake example; Rāmānuja's objections (often counted as seven), as the Viśiṣṭādvaita reply. Note that māyā means other things in other texts. Set `related: [advaita-vedanta, brahman]`. Candidate sources: `https://en.wikipedia.org/wiki/Maya_(religion)`, the IEP Advaita entry from Task 16.

- [ ] **Step 4: Check and commit**

Run: `npm run build && npm run e2e`
Expected: pass. All 13 slice blocks are now `draft`.
```bash
git add -A && git commit -m "content: ātman, brahman, māyā"
```

---

### Task 19: Repo instructions

**Files:**
- Create: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: Write `CLAUDE.md`**

```markdown
# Śāstras

An explorable map of the Indian śāstras at sastras.dhanjit.me. It's an Astro static site, served by a Cloudflare Worker. Design: `docs/superpowers/specs/2026-10-12-sastras-site-design.md`.

## Commands
- `npm run dev`: local site
- `npm run build`: builds `dist/`, and fails on any content error (see `src/lib/tree.ts`)
- `npm run check` / `npm test` / `npm run e2e`: types, unit tests, browser tests (phone and desktop)
- Deploys: Cloudflare Workers Builds deploys every push to `main`. Nothing to run.

## Content
- One block = one file in `src/content/blocks/<slug>.md`. The schema is in `src/content.config.ts`. `parent` and `order` place it on the map; top-level blocks use `parent: map` and set `layer`.
- `status`: `stub` (on the map, "in preparation", no page) → `draft` (written, sourced) → `reviewed`. Only Dhanjit sets `reviewed`.
- Sanskrit first: titles in IAST, English in `gloss`. Body text is English sentences that keep the Sanskrit terms; every term without in-line English goes in `src/data/glossary.yaml`.
- `:cite[id]` after every factual statement. The id must be in the block's `sources`, and every source must be a page you actually read.
- `:note[...]` for a deeper explanation (margin note on desktop, tap-to-open on a phone).
- Describe each school in its own terms; flag contested dates and readings; write in your own words.
- Link only to written blocks: `[text](/slug)`.

## Tracking
- Site-level tracker: dhanjit/brain#208. Slice issues live in this repo.
```

- [ ] **Step 2: Update `README.md`**

Replace its last line with:
```markdown
Live: https://sastras.dhanjit.me · Design: [spec](docs/superpowers/specs/2026-10-12-sastras-site-design.md) · Corrections welcome: use the "Suggest a correction" link on any page.

Text CC BY-SA 4.0; code MIT.
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "docs: repo instructions"
```

---

### Task 20: Ship the slice

**Files:** none changed.

- [ ] **Step 1: Everything green**

Run: `npm run check && npm test && npm run e2e && git push`
Expected: all pass locally. `gh pr checks` shows `ci` passing on the PR.

- [ ] **Step 2: Ask Dhanjit before merging**

Merging deploys to the public site. Show him the PR link and have him look at the full site locally (`npm run build && npm run preview`, then open http://localhost:4321); branch previews stay off so unpublished drafts aren't public. Wait for a clear yes. Then:
```bash
gh pr ready && gh pr merge --squash --delete-branch
```

- [ ] **Step 3: Verify the live site**

```bash
for p in / /advaita-vedanta /vedanta /about /glossary /og/advaita-vedanta.png; do curl -s -o /dev/null -w "$p %{http_code}\n" "https://sastras.dhanjit.me$p"; done
curl -s -o /dev/null -w "/no-such-page %{http_code}\n" https://sastras.dhanjit.me/no-such-page
curl -s https://sastras.dhanjit.me/advaita-vedanta | grep -o '<meta property="og:image" content="[^"]*"'
```
Expected: every page `200`, `/no-such-page 404`, and the og:image meta points at `https://sastras.dhanjit.me/og/advaita-vedanta.png`.

- [ ] **Step 4: Real share check (Dhanjit)**

Ask Dhanjit to paste `https://sastras.dhanjit.me/advaita-vedanta` into a private place (a Discord DM, a private subreddit or a draft post) and confirm the preview card shows the palm-leaf image with title and gloss.

- [ ] **Step 5: Close out**

The merge closes dhanjit/sastras#1 through `Closes #1`. Confirm with `gh issue view 1 --repo dhanjit/sastras --json state`. Then post progress on the parent, which stays open:
```bash
gh issue comment 208 --repo dhanjit/brain --body "First slice live at https://sastras.dhanjit.me (dhanjit/sastras#1): the map, Foundation, and the Vedānta → Advaita path. Next: one PR per school for the other eight."
```
