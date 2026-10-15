import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import remarkDirective from 'remark-directive';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { remarkNote } from '../../src/lib/remark-note';
import { remarkCite } from '../../src/lib/remark-cite';
import { remarkFigure } from '../../src/lib/remark-figure';
import { remarkRestoreDirectives } from '../../src/lib/remark-restore-directives';
import { rehypeGloss } from '../../src/lib/rehype-gloss';
import { loadFigures } from '../../src/lib/figures';

const still = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 400 200">
  <title>Rope</title>
  <desc>A coiled rope in dim light.</desc>
  <defs><marker id="head" viewBox="0 0 10 10"><path class="ink-fill" d="M0 0L10 5L0 10z"/></marker><linearGradient id="g"/></defs>
  <path id="rope" class="line" d="M10 10H90" marker-end="url(#head)" fill="url( #g )"/>
  <use href="#rope" xlink:href="#rope"/>
</svg>`;
const moving = `<svg viewBox="0 0 400 200"><title>Snake</title><desc>The rope seen as a snake.</desc><style>.x { animation: draw 1s 1 both; }</style><path id="body" class="flow anim" d="M0 0H9"/></svg>`;

// Astro's own pipeline with the site's plugins in the site's order, so rehype-raw parses the SVG as on the page.
const proc = await createMarkdownProcessor({
  remarkPlugins: [remarkDirective, remarkNote, remarkCite, [remarkFigure, { figures: { 'rope-snake': still, snake: moving } }], remarkRestoreDirectives],
  rehypePlugins: [[rehypeGloss, { terms: { ātman: 'the self' } }]],
  syntaxHighlight: false,
});
async function md(src: string, frontmatter: Record<string, unknown> = {}) {
  return (await proc.render(src, { frontmatter })).code;
}
const idsIn = (html: string) => [...html.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1]);

describe('remarkFigure', () => {
  it('draws the figure inline in a <figure> with its caption', async () => {
    const html = await md('Before.\n\n::figure[The rope]{#rope-snake}\n\nAfter.');
    expect(html).toMatch(/<figure class="fig" id="fig-rope-snake"><svg[^>]*>[\s\S]*<\/svg><figcaption>The rope<\/figcaption><\/figure>/);
    expect(html).not.toContain('<?xml');
  });

  it('prefixes every id and every reference to one, so figures never clash with each other or the page', async () => {
    const html = await md('::figure[The rope]{#rope-snake}');
    expect(html).toContain('id="fig-rope-snake-head"');
    expect(html).toContain('id="fig-rope-snake-rope"');
    expect(html).toContain('id="fig-rope-snake-g"');
    expect(html).toContain('marker-end="url(#fig-rope-snake-head)"');
    expect(html).toMatch(/fill="url\(\s*#fig-rope-snake-g\s*\)"/);
    expect(html).toContain('href="#fig-rope-snake-rope"');
    expect(html).toContain('xlink:href="#fig-rope-snake-rope"');
    expect(html).not.toMatch(/id="(?:head|rope|g)"|#(?:head|rope|g)\b/);
  });

  it('names the drawing by its title and describes it by its desc', async () => {
    const html = await md('::figure[The rope]{#rope-snake}');
    const svg = html.match(/<svg[^>]*>/)![0];
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-labelledby="fig-rope-snake-title fig-rope-snake-desc"');
    expect(html).toContain('<title id="fig-rope-snake-title">Rope</title>');
    expect(html).toContain('<desc id="fig-rope-snake-desc">A coiled rope in dim light.</desc>');
  });

  it('renders citations and glossary terms in the caption', async () => {
    const html = await md('::figure[The ātman, as the text says:cite[w]]{#rope-snake}', { sources: [{ id: 'w', title: 'W' }] });
    const caption = html.match(/<figcaption>([\s\S]*?)<\/figcaption>/)![1];
    expect(caption).toContain('<sup class="cite"><a href="#src-w" aria-label="Source 1: W">1</a></sup>');
    expect(caption).toContain('<a class="term" href="/glossary#g-aatman"');
  });

  it('adds a replay button only to a figure that animates', async () => {
    const html = await md('::figure[Still]{#rope-snake}\n\n::figure[Moving]{#snake}');
    const [still, moving] = html.match(/<figure[\s\S]*?<\/figure>/g)!;
    expect(still).not.toContain('data-animated');
    expect(still).not.toContain('fig-replay');
    expect(moving).toMatch(/^<figure class="fig" id="fig-snake" data-animated(?:="")?>/);
    expect(moving).toContain('<figcaption>Moving<button type="button" class="fig-replay">Replay</button></figcaption>');
  });

  it('gives two figures on one page no duplicate ids', async () => {
    const ids = idsIn(await md('::figure[One]{#rope-snake}\n\n::figure[Two]{#snake}'));
    expect(ids.length).toBeGreaterThan(6);
    expect(ids.filter((x, i) => ids.indexOf(x) !== i)).toEqual([]);
  });

  it('marks a missing figure instead of crashing (the build has already failed on it)', async () => {
    const html = await md('::figure[Lost]{#nowhere}');
    expect(html).toContain('<figure class="fig" id="fig-nowhere">');
    expect(html).toContain('[missing figure nowhere]');
    expect(html).toContain('<figcaption>Lost</figcaption>');
  });

  it('leaves inline figures and other directives to the content checks', async () => {
    expect(await md('Gītā 2:47 says act.')).toContain('<p>Gītā 2:47 says act.</p>');
  });
});

describe('loadFigures', () => {
  it('reads every SVG in the folder, keyed by file name', () => {
    const dir = mkdtempSync(join(tmpdir(), 'figures-'));
    writeFileSync(join(dir, 'rope-snake.svg'), still);
    writeFileSync(join(dir, 'snake.svg'), moving);
    writeFileSync(join(dir, 'notes.txt'), 'not a figure');
    mkdirSync(join(dir, 'drafts.svg')); // a folder, not a figure
    expect(loadFigures(dir)).toEqual({ 'rope-snake': still, snake: moving });
  });

  it('returns no figures for a missing folder', () => {
    expect(loadFigures(join(tmpdir(), 'no-such-figures-folder'))).toEqual({});
  });
});
