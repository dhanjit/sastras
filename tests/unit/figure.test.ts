import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import remarkDirective from 'remark-directive';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { toHtml } from 'hast-util-to-html';
import { remarkNote } from '../../src/lib/remark-note';
import { remarkCite } from '../../src/lib/remark-cite';
import { remarkFigure } from '../../src/lib/remark-figure';
import { remarkRestoreDirectives } from '../../src/lib/remark-restore-directives';
import { rehypeGloss } from '../../src/lib/rehype-gloss';
import { loadFigures } from '../../src/lib/figures';
import { figureElement, prepareFigure } from '../../src/lib/figure-svg';

const still = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 400 200">
  <!-- <title>old</title> -->
  <title>Rope</title>
  <desc>A coiled rope in dim light.</desc>
  <style>#fig-rope-snake .line { marker-start: url(#head); }</style>
  <defs><marker id="head" viewBox="0 0 10 10"><path class="ink-fill" d="M0 0L10 5L0 10z"/></marker><clipPath id="g"><rect width="9" height="9"/></clipPath></defs>
  <path id="rope" class="line" d="M10 10H90" marker-end="url(#head)" clip-path="url( #g )"/>
  <use href="#rope" xlink:href="#rope"/>
  <text x="5" y="20">user id="42"</text>
  <!-- <g class="anim"/> -->
</svg>`;
const moving = `<svg viewBox="0 0 400 200"><title>Snake</title><desc>The rope seen as a snake.</desc><style>#fig-snake .x { animation: snake-draw 1s 1 both; } @keyframes snake-draw { from { opacity: 0; } }</style><path id="body" class="flow anim x" d="M0 0H9"/></svg>`;
const broken = '<svg viewBox="0 0 400 200"><title>T</title><desc>D</desc><script>alert(1)</script></svg>';
const tiny = '<svg viewBox="0 0 400 200"><title>T</title><desc>D</desc><defs><marker id="head"><path d="M0 0"/></marker></defs><path d="M0 0H9" marker-end="url(#head)"/></svg>';
const figures = { 'rope-snake': still, snake: moving, broken, rope: tiny, 'rope-head': tiny };

// Astro's own pipeline with the site's plugins in the site's order, so rehype-raw handles the SVG as on the page.
const proc = await createMarkdownProcessor({
  remarkPlugins: [remarkDirective, remarkNote, remarkCite, [remarkFigure, { figures }], remarkRestoreDirectives],
  rehypePlugins: [[rehypeGloss, { terms: { ātman: 'the self' } }]],
  syntaxHighlight: false,
});
async function md(src: string, frontmatter: Record<string, unknown> = {}) {
  return (await proc.render(src, { frontmatter })).code;
}
const idsIn = (html: string) => [...html.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1]);

describe('remarkFigure', () => {
  it('draws the figure inline in a <figure> with its caption, without comments or the XML declaration', async () => {
    const html = await md('Before.\n\n::figure[The rope]{#rope-snake}\n\nAfter.');
    expect(html).toMatch(/<figure class="fig" id="fig-rope-snake"><svg[^>]*>[\s\S]*<\/svg><figcaption>The rope<\/figcaption><\/figure>/);
    expect(html).not.toContain('<?xml');
    expect(html).not.toContain('<!--');
  });

  it('gives every inner id the prefix fig-<id>-- and follows every reference to it', async () => {
    const html = await md('::figure[The rope]{#rope-snake}');
    expect(idsIn(html)).toEqual(expect.arrayContaining(['fig-rope-snake--head', 'fig-rope-snake--g', 'fig-rope-snake--rope']));
    expect(html).toContain('marker-end="url(#fig-rope-snake--head)"');
    expect(html).toMatch(/clip-path="url\(\s*#fig-rope-snake--g\s*\)"/);
    expect(html).toContain('href="#fig-rope-snake--rope"');
    expect(html).toContain('xlink:href="#fig-rope-snake--rope"');
    expect(html).toContain('#fig-rope-snake .line { marker-start: url(#fig-rope-snake--head); }');
    expect(html).not.toMatch(/id="(?:head|rope|g)"|#(?:head|rope|g)\b/);
  });

  it('keeps inner ids apart from other figures, whose ids are hyphenated too', async () => {
    const ids = idsIn(await md('::figure[One]{#rope}\n\n::figure[Two]{#rope-head}'));
    expect(ids).toEqual(expect.arrayContaining(['fig-rope', 'fig-rope--head', 'fig-rope-head', 'fig-rope-head--head']));
    expect(ids.filter((x, i) => ids.indexOf(x) !== i)).toEqual([]);
  });

  it('names the drawing by its real title and desc, not a commented-out one', async () => {
    const html = await md('::figure[The rope]{#rope-snake}');
    const svg = html.match(/<svg[^>]*>/)![0];
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-labelledby="fig-rope-snake--title fig-rope-snake--desc"');
    expect(html).toContain('<title id="fig-rope-snake--title">Rope</title>');
    expect(html).toContain('<desc id="fig-rope-snake--desc">A coiled rope in dim light.</desc>');
    expect(html).not.toContain('old');
  });

  it('leaves text that looks like an attribute alone', async () => {
    const html = await md('::figure[The rope]{#rope-snake}');
    expect(html).toContain('<text x="5" y="20">user id="42"</text>');
  });

  it('renders citations and glossary terms in the caption', async () => {
    const html = await md('::figure[The ātman, as the text says:cite[w]]{#rope-snake}', { sources: [{ id: 'w', title: 'W' }] });
    const caption = html.match(/<figcaption>([\s\S]*?)<\/figcaption>/)![1];
    expect(caption).toContain('<sup class="cite"><a href="#src-w" aria-label="Source 1: W">1</a></sup>');
    expect(caption).toContain('<a class="term" href="/glossary#g-aatman"');
  });

  it('adds a replay button only to a figure that animates, not to one that mentions anim in a comment', async () => {
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

  it('never inlines a figure that fails its checks', async () => {
    const html = await md('::figure[Bad]{#broken}');
    expect(html).toContain('[figure broken fails its checks]');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<svg');
  });

  it('leaves ordinary colons alone', async () => {
    expect(await md('Gītā 2:47 says act.')).toContain('<p>Gītā 2:47 says act.</p>');
  });
});

describe('figureElement', () => {
  it('draws the same <figure> as the Markdown pipeline, so the test page shows what a block page shows', async () => {
    const fromMarkdown = (await md('::figure[Moving]{#snake}')).match(/<figure[\s\S]*<\/figure>/)![0];
    const { figure } = prepareFigure('snake', moving);
    expect(toHtml(figureElement('snake', figure!, [{ type: 'text', value: 'Moving' }]))).toBe(fromMarkdown);
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
