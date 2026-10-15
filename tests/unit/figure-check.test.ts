import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkFigure } from '../../src/lib/figure-svg';

const ID = 'stock-flow';
// A figure that passes every rule: classes for colour, a scoped <style>, a marker by local reference, a CSS animation.
const valid = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 400 240">
  <title>A stock and its flows</title>
  <desc>Water flows into a tank and out through a valve.</desc>
  <style>
    #fig-stock-flow .fill { animation: stock-flow--rise 1.2s ease-out 1 both; fill: var(--leaf-2); stroke: currentColor; marker-end: url(#arrow); font: italic 13px/1.2 serif; }
    #fig-stock-flow > svg .a, #fig-stock-flow:hover .b, #fig-stock-flow[data-x] .c, #fig-stock-flow.d .k, #fig-stock-flow .e ~ .f, #fig-stock-flow:is(.g, .h) svg > .i + .j { opacity: 0.5; animation-iteration-count: 3; }
    /* comments are dropped */
    @keyframes stock-flow--rise { from { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { #fig-stock-flow .fill { animation: none; } }
  </style>
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path class="ink-fill" d="M0 0L10 5L0 10z"/></marker></defs>
  <!-- comments are dropped -->
  <rect class="stock" x="140" y="80" width="120" height="80" fill="none" stroke="currentColor" stroke-width="2"/>
  <path class="flow" d="M20 120H140" marker-end="url(#arrow)" fill="transparent"/>
  <use href="#arrow" xlink:href="#arrow"/>
  <text x="200" y="125" font-size="13" text-anchor="middle" class="anim fill">stock <tspan class="muted">level</tspan></text>
</svg>`;

const check = (svg: string) => checkFigure(ID, svg);
const msg = (m: string) => `figure ${ID}: ${m}`;
/** The valid figure with one substring replaced. */
const with_ = (from: string, to: string) => {
  if (!valid.includes(from)) throw new Error(`fixture has no ${from}`);
  return valid.replace(from, to);
};
/** The valid figure with extra elements just before </svg>. */
const adding = (markup: string) => with_('</svg>', `${markup}</svg>`);
/** The valid figure with extra CSS in its <style>. */
const styled = (css: string) => with_('  </style>', `    ${css}\n  </style>`);

describe('checkFigure', () => {
  it('passes a figure that follows every rule', () => {
    expect(check(valid)).toEqual([]);
  });

  it('passes the example figure the guide points to', () => {
    const svg = readFileSync(new URL('../../src/figures/example-system.svg', import.meta.url), 'utf8');
    expect(checkFigure('example-system', svg)).toEqual([]);
  });

  it('rejects a file name that is not lower-case ASCII words joined by hyphens', () => {
    expect(checkFigure('Stock_Flow', valid)).toContain('figure Stock_Flow: file name must be lower-case ASCII words joined by hyphens');
  });

  describe('the file', () => {
    it('starts with <svg, after an optional XML declaration', () => {
      expect(check(valid.replace(/^<\?xml[^>]*\?>\s*/, ''))).toEqual([]);
      expect(check(`﻿  \n${valid}`)).toEqual([]);
      expect(check(`<!DOCTYPE svg>\n${valid}`)).toContain(msg('must start with <svg (an XML declaration may come first)'));
    });

    it('is a single <svg> element with nothing after it', () => {
      expect(check(`${valid}<p>after</p>`)).toContain(msg('must be a single <svg> element with nothing after it'));
      // HTML closes the <svg> at a <p>, so this is not inside the figure either
      expect(check(adding('<p>inside?</p>'))).toContain(msg('must be a single <svg> element with nothing after it'));
    });

    it('is at most 30 KB', () => {
      const big = adding(`<!-- ${'x'.repeat(30 * 1024)} -->`);
      expect(check(big)).toEqual([msg(`${(Buffer.byteLength(big) / 1024).toFixed(1)} KB; keep it at most 30 KB`)]);
    });
  });

  describe('the root', () => {
    it('needs a viewBox of four numbers, at most 480 wide', () => {
      expect(check(with_(' viewBox="0 0 400 240"', ''))).toEqual([msg('the root <svg> needs a viewBox')]);
      expect(check(with_('viewBox="0 0 400 240"', 'viewBox="0 0 wide"'))).toEqual([msg('viewBox must be four numbers, like "0 0 400 240"')]);
      expect(check(with_('viewBox="0 0 400 240"', 'viewBox="0,0,480,240"'))).toEqual([]);
      expect(check(with_('viewBox="0 0 400 240"', 'viewBox="0 0 640 240"'))).toEqual([msg('viewBox is 640 wide; keep it at most 480 (phone first)')]);
    });

    it('has no width or height, so the page sizes the figure', () => {
      expect(check(with_('viewBox="0 0 400 240"', 'viewBox="0 0 400 240" width="400" height="240"'))).toEqual([
        msg('remove width and height from the root <svg>; the page sizes the figure'),
      ]);
    });

    it('has exactly one non-empty <title> and <desc>', () => {
      expect(check(with_('<title>A stock and its flows</title>', ''))).toEqual([msg('needs exactly one <title>, found 0')]);
      expect(check(with_('<title>A stock and its flows</title>', '<title>A</title><title>B</title>'))).toEqual([msg('needs exactly one <title>, found 2')]);
      expect(check(with_('<title>A stock and its flows</title>', '<title>  </title>'))).toEqual([msg('<title> is empty')]);
      expect(check(with_('<desc>Water flows into a tank and out through a valve.</desc>', '<desc></desc>'))).toEqual([msg('<desc> is empty')]);
      // a commented-out title is not a title
      expect(check(with_('<title>A stock and its flows</title>', '<!-- <title>old</title> -->'))).toEqual([msg('needs exactly one <title>, found 0')]);
    });
  });

  describe('elements and attributes (allowlist; the tree is parsed as the page parses it)', () => {
    it.each([
      ['<script>', '<script>alert(1)</script>', '<script> is not allowed'],
      ['a script behind <!-->, which HTML closes at once', '<!--><script>alert(1)</script>-->', '<script> is not allowed'],
      ['<foreignObject>', '<foreignObject><div>x</div></foreignObject>', '<foreignObject> is not allowed'],
      ['<image>', '<image href="#arrow"/>', '<image> is not allowed'],
      ['<a>', '<a href="#arrow"><text>x</text></a>', '<a> is not allowed'],
      ['<linearGradient>', '<linearGradient id="g"/>', '<linearGradient> is not allowed'],
      ['SMIL <animate>', '<animate attributeName="opacity" to="0"/>', '<animate> is not allowed; animate with CSS @keyframes'],
      ['SMIL <set>', '<set to="1"/>', '<set> is not allowed; animate with CSS @keyframes'],
    ])('rejects %s', (_, markup, error) => {
      expect(check(adding(markup))).toContain(msg(error));
    });

    it.each([
      ['an event handler', '<rect onclick="x()"/>'],
      ['one after a slash', '<rect/onclick="x()"/>'],
      ['one glued to the previous attribute', '<rect class="box"onclick="x()"/>'],
      ['one after a quoted ">"', '<rect class="a>b" onclick="x()"/>'],
    ])('rejects %s', (_, markup) => {
      expect(check(adding(markup))).toContain(msg('attribute onclick is not allowed on <rect>'));
    });

    it('rejects attributes outside the allowlist', () => {
      expect(check(adding('<rect aria-label="x" data-x="1"/>'))).toEqual([
        msg('attribute aria-label is not allowed on <rect>'),
        msg('attribute data-x is not allowed on <rect>'),
      ]);
    });

    it('rejects style attributes outright', () => {
      expect(check(adding('<rect class="box" style="stroke-width: 3"/>'))).toEqual([
        msg('style attributes are not allowed; use the figure classes, and the <style> element for figure-specific CSS'),
      ]);
    });

    it('rejects stray text outside <text>', () => {
      expect(check(adding('hello'))).toEqual([msg('text "hello" sits outside <text>')]);
    });
  });

  describe('references', () => {
    it.each([
      ['an entity-encoded scheme', '<use href="&#106;avascript:alert(1)"/>', 'javascript:alert(1)'],
      ['an unquoted one', '<use href=javascript:alert(1) />', 'javascript:alert(1)'],
      ['a scheme split by a tab', '<use href="java\tscript:alert(1)"/>', 'java\tscript:alert(1)'],
      ['an external URL in xlink:href', '<use xlink:href="https://example.org/a.svg#x"/>', 'https://example.org/a.svg#x'],
      ['a protocol-relative URL', "<use href='//example.org/a.svg'/>", '//example.org/a.svg'],
      ['a relative URL', '<use href="a.svg#x"/>', 'a.svg#x'],
    ])('rejects an href that leaves the figure: %s', (_, markup, target) => {
      expect(check(adding(markup))).toContain(msg(`href must point inside the figure (#id), not to ${target}`));
    });

    it('rejects a url() that leaves the figure, in an attribute or in <style>', () => {
      expect(check(adding('<rect fill="url(https://example.org/p.svg#g)"/>'))).toEqual([
        msg('url() must point inside the figure (#id), not to https://example.org/p.svg#g'),
      ]);
      expect(check(styled('#fig-stock-flow .x { fill: url(https://example.org/p.svg#g); }'))).toEqual([
        msg('url() must point inside the figure (#id), not to https://example.org/p.svg#g'),
      ]);
    });

    it('rejects a reference to an id the figure does not have', () => {
      expect(check(adding('<use href="#nowhere"/><path d="M0 0" marker-end="url(#gone)"/>'))).toEqual([
        msg('#nowhere is referenced, but no element has that id'),
        msg('#gone is referenced, but no element has that id'),
      ]);
    });

    it('rejects the ids it reserves for the title and desc, and a repeated id', () => {
      expect(check(adding('<g id="title"/><g id="desc"/><g id="arrow"/>'))).toEqual([
        msg('id "title" is reserved for the figure\'s <title>'),
        msg('id "desc" is reserved for the figure\'s <desc>'),
        msg('id "arrow" is used twice'),
      ]);
    });
  });

  describe('colour', () => {
    it.each([
      ['a short hex', 'fill="none"', 'fill="#fff"', '#fff'],
      ['a long hex', 'stroke="currentColor"', 'stroke="#8E3B2C"', '#8E3B2C'],
      ['rgb()', 'fill="none"', 'fill="rgb(1, 2, 3)"', 'rgb('],
      ['hsl()', 'fill="none"', 'fill="hsl(10 50% 50%)"', 'hsl('],
      ['oklch()', 'fill="none"', 'fill="oklch(0.5 0.1 30)"', 'oklch('],
      ['color-mix()', 'fill="none"', 'fill="color-mix(in srgb, red, blue)"', 'color-mix('],
      ['light-dark()', 'fill="none"', 'fill="light-dark(black, white)"', 'light-dark('],
      ['a named colour', 'fill="none"', 'fill="red"', 'red'],
      ['a named colour in another case', 'stroke="currentColor"', 'stroke="Black"', 'Black'],
      ['a system colour', 'fill="none"', 'fill="Canvas"', 'Canvas'],
    ])('rejects a literal colour in an attribute: %s', (_, from, to, shown) => {
      const errors = check(with_(from, to));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/^figure stock-flow: literal colour .+; colour comes from the figure classes \(see docs\/figure-guide\.md\)$/);
      expect(errors[0]).toContain(shown);
    });

    it.each([
      ['a hex', '#fig-stock-flow .x { fill: #ddd3b6; }', '#ddd3b6'],
      ['a named colour', '#fig-stock-flow .x { stroke: navy; }', 'navy'],
      ['a system colour', '#fig-stock-flow .x { fill: CanvasText; }', 'CanvasText'],
      ['a colour function', '#fig-stock-flow .x { fill: hwb(10 10% 10%); }', 'hwb('],
      ['a colour() function', '#fig-stock-flow .x { fill: color(display-p3 1 0 0); }', 'color('],
    ])('rejects a literal colour in <style>: %s', (_, css, shown) => {
      const errors = check(styled(css));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatch(/^figure stock-flow: literal colour /);
      expect(errors[0]).toContain(shown);
    });

    it('does not read a font name or a quoted string as a colour', () => {
      expect(check(styled('#fig-stock-flow .x { font-family: "Gold Serif", Tan, serif; }'))).toEqual([]);
    });

    it('allows none, currentColor, transparent, inherit, context paint, a local paint server and a CSS variable', () => {
      expect(check(adding('<rect fill="inherit" stroke="context-stroke"/><path d="M0 0" fill="url(#arrow)"/>'))).toEqual([]);
      expect(check(styled('#fig-stock-flow .x { fill: var(--ink); stroke: var(--red-ish, currentColor); }'))).toEqual([]);
    });
  });

  describe('the <style> element, which applies to the whole page', () => {
    it.each([
      ['an element selector', 'body { display: none; }', 'body'],
      ['a page class', '.box { stroke-width: 9; }', '.box'],
      ['another figure, by a longer id', '#fig-stock-flow-head .x { opacity: 0; }', '#fig-stock-flow-head .x'],
      ['an inner id, renamed at build', '#fig-stock-flow #arrow { opacity: 0; }', '#fig-stock-flow #arrow'],
      ['one bad selector in a list', '#fig-stock-flow .a, .b { opacity: 0; }', '.b'],
      ['a general sibling of the figure', '#fig-stock-flow ~ p { display: none; }', '#fig-stock-flow ~ p'],
      ['an adjacent sibling of the figure', '#fig-stock-flow + * { display: none; }', '#fig-stock-flow + *'],
      ['a sibling after a pseudo-class', '#fig-stock-flow:where(.x) ~ .fig .box { opacity: 0; }', '#fig-stock-flow:where(.x) ~ .fig .box'],
      ['an id inside :is()', '#fig-stock-flow :is(#x) { opacity: 0; }', '#fig-stock-flow :is(#x)'],
      ['the figure itself', '#fig-stock-flow { transform: scale(30); }', '#fig-stock-flow'],
      ['the figure in a state', '#fig-stock-flow:hover { opacity: 0; }', '#fig-stock-flow:hover'],
      ['a child of the figure that is not the drawing', '#fig-stock-flow > .a { opacity: 0; }', '#fig-stock-flow > .a'],
      ['the caption', '#fig-stock-flow > figcaption { display: none; }', '#fig-stock-flow > figcaption'],
      ['the caption, further in', '#fig-stock-flow figcaption { display: none; }', '#fig-stock-flow figcaption'],
      ['the Replay button', '#fig-stock-flow .x button { display: none; }', '#fig-stock-flow .x button'],
      ['the drawing itself', '#fig-stock-flow svg { transform: scale(30); }', '#fig-stock-flow svg'],
      ['the drawing itself, as a child', '#fig-stock-flow > svg { transform: scale(30); }', '#fig-stock-flow > svg'],
    ])('rejects a selector that does not step into the drawing: %s', (_, css, selector) => {
      expect(check(styled(css))).toEqual([msg(`selector "${selector}" must step into the drawing: #fig-stock-flow, then a space, then its parts by class`)]);
    });

    it('rejects nested rules, which can climb out of the figure with &', () => {
      expect(check(styled('#fig-stock-flow .x { & ~ p { display: none; } }'))).toEqual([msg('nested rules are not allowed in <style>')]);
      expect(check(styled('#fig-stock-flow .x { @media (prefers-reduced-motion: reduce) { opacity: 1; } }'))).toEqual([
        msg('nested rules are not allowed in <style>'),
      ]);
    });

    it.each([
      ['a script behind entities in a comment', '#fig-stock-flow .x { opacity: 1; } /* &lt;/style&gt;&lt;script&gt;alert(1)&lt;/script&gt; */'],
      ['a script behind entities in a string', '#fig-stock-flow .x { font-family: "&lt;script&gt;alert(1)&lt;/script&gt;"; }'],
    ])('rejects "<" in <style>, which the page would read as markup: %s', (_, css) => {
      expect(check(styled(css))).toContain(msg('<style> may not contain "<"'));
    });

    it.each([
      ['an escaped url()', '#fig-stock-flow .x { fill: \\75 rl(https://example.org/p.gif); }'],
      ['an escape inside url', '#fig-stock-flow .x { fill: u\\rl(https://example.org/p.gif); }'],
    ])('rejects CSS escapes, which hide what a value says: %s', (_, css) => {
      expect(check(styled(css))).toContain(msg('<style> may not contain "\\" (no CSS escapes)'));
    });

    it('rejects properties outside the allowlist, including custom properties', () => {
      expect(check(styled('#fig-stock-flow .x { position: fixed; z-index: 9; --c: tomato; }'))).toEqual([
        msg('property position is not allowed in <style>'),
        msg('property z-index is not allowed in <style>'),
        msg('property --c is not allowed in <style>'),
      ]);
    });

    it.each([
      ['infinite in the shorthand', 'animation: stock-flow--rise 1s infinite both', 'animation: stock-flow--rise 1s infinite both'],
      ['infinite on its own', 'animation-iteration-count: infinite', 'animation-iteration-count: infinite'],
      ['more than three runs', 'animation: stock-flow--rise 1s ease-out 4 both', 'animation: stock-flow--rise 1s ease-out 4 both'],
      ['one of several animations', 'animation-iteration-count: 1, infinite', 'animation-iteration-count: 1, infinite'],
    ])('rejects an animation that does not end: %s', (_, decl, shown) => {
      expect(check(styled(`#fig-stock-flow .x { ${decl}; }`))).toEqual([msg(`${shown}: run an animation at most 3 times, so it ends on its still frame`)]);
    });

    it('does not read the numbers in a timing function as an iteration count', () => {
      expect(check(styled('#fig-stock-flow .x { animation: stock-flow--rise 1s cubic-bezier(0.1, 7, 0.3, 9) 2 both; }'))).toEqual([]);
    });

    it('rejects keyframes that are not prefixed with the figure id and --', () => {
      expect(check(styled('@keyframes rise { from { opacity: 0; } }'))).toEqual([msg('@keyframes rise must be named stock-flow--…')]);
      // stock-flow-spin could be figure stock-flow's, or figure stock's "flow-spin"
      expect(check(styled('@keyframes stock-flow-spin { from { opacity: 0; } }'))).toEqual([msg('@keyframes stock-flow-spin must be named stock-flow--…')]);
    });

    it.each([
      ['@import', '@import url(https://example.org/x.css);'],
      ['@font-face', '@font-face { font-family: x; src: url(#a); }'],
      ['@media other than reduced motion', '@media (min-width: 1px) { #fig-stock-flow .x { opacity: 0; } }'],
      ['@supports', '@supports (display: grid) { #fig-stock-flow .x { opacity: 0; } }'],
    ])('rejects %s', (_, css) => {
      const name = css.match(/^@([\w-]+)/)![1];
      expect(check(styled(css))).toContain(msg(`@${name} is not allowed in <style>`));
    });

    it('rejects image functions, which load files without url()', () => {
      expect(check(styled('#fig-stock-flow .x { fill: image-set("https://example.org/m.png" 1x); }'))).toEqual([
        msg('image-set() is not allowed in <style>'),
      ]);
    });

    it('rejects CSS it cannot parse', () => {
      expect(check(styled('#fig-stock-flow .x { opacity: 0;'))).toEqual([msg('<style> is not valid CSS: Unclosed block')]);
    });
  });

  describe('font size', () => {
    it('requires every font size, as an attribute or in CSS, to be at least 12 px', () => {
      expect(check(with_('font-size="13"', 'font-size="12px"'))).toEqual([]);
      expect(check(with_('font-size="13"', 'font-size="10"'))).toEqual([msg('font-size 10 is below 12')]);
      expect(check(with_('font-size="13"', 'font-size="0.6em"'))).toEqual([msg('font-size 0.6em: write it in px, at least 12')]);
      expect(check(styled('#fig-stock-flow .x { font-size: 9px; }'))).toEqual([msg('font-size 9px is below 12')]);
    });

    it('reads the size out of the font shorthand', () => {
      expect(check(styled('#fig-stock-flow .x { font: 700 11px/1.2 serif; }'))).toEqual([msg('font-size 11px is below 12')]);
      expect(check(styled('#fig-stock-flow .x { font: small-caps 700 14px serif; }'))).toEqual([]);
    });

    it.each([['bold 1.2em serif'], ['calc(8px) serif'], ['1e1px serif']])('requires the font shorthand to carry a plain px size: %s', (font) => {
      expect(check(styled(`#fig-stock-flow .x { font: ${font}; }`))).toEqual([msg(`font: ${font}: give the size in px, at least 12`)]);
    });

    it('rejects system fonts in the font shorthand', () => {
      expect(check(styled('#fig-stock-flow .x { font: caption; }'))).toEqual([msg('font: caption: system fonts are not allowed; give the size in px, at least 12')]);
    });
  });

  it('reports every problem at once', () => {
    const bad = '<svg width="10" viewBox="0 0 900 10"><script/><rect fill="red" onclick="x()"/></svg>';
    expect(check(bad)).toHaveLength(7); // width, 900 wide, no title, no desc, script, onclick, colour
  });
});
