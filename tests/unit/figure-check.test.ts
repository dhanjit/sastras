import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkFigure } from '../../src/lib/figure-check';

// A figure that passes every rule: classes for colour, a marker by local reference, a CSS animation.
const valid = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 400 240">
  <title>A stock and its flows</title>
  <desc>Water flows into a tank and out through a valve.</desc>
  <style>.fill { animation: rise 1.2s ease-out 1 both; fill: var(--leaf-2); stroke: currentColor; } @keyframes rise { from { opacity: 0 } }</style>
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5"><path class="ink-fill" d="M0 0L10 5L0 10z"/></marker></defs>
  <rect class="stock" x="140" y="80" width="120" height="80" fill="none" stroke="currentColor" stroke-width="2"/>
  <path class="flow" d="M20 120H140" marker-end="url(#arrow)"/>
  <use href="#arrow" xlink:href="#arrow"/>
  <text x="200" y="125" font-size="13" class="anim fill">stock</text>
</svg>`;

/** The valid figure with one substring replaced. */
const with_ = (from: string, to: string) => {
  if (!valid.includes(from)) throw new Error(`fixture has no ${from}`);
  return valid.replace(from, to);
};

describe('checkFigure', () => {
  it('passes a figure that follows every rule', () => {
    expect(checkFigure('stock-flow', valid)).toEqual([]);
  });

  it('passes the example figure the guide points to', () => {
    const svg = readFileSync(new URL('../../src/figures/example-system.svg', import.meta.url), 'utf8');
    expect(checkFigure('example-system', svg)).toEqual([]);
  });

  it('rejects a file name that is not lower-case ASCII words joined by hyphens', () => {
    expect(checkFigure('Stock_Flow', valid)).toEqual(['figure Stock_Flow: file name must be lower-case ASCII words joined by hyphens']);
  });

  it('requires the file to start with <svg, after an optional XML declaration', () => {
    expect(checkFigure('f', valid.replace(/^<\?xml[^>]*\?>\s*/, ''))).toEqual([]);
    expect(checkFigure('f', `  \n${valid}`)).toEqual([]);
    expect(checkFigure('f', `<!DOCTYPE svg>\n${valid}`)).toEqual(['figure f: must start with <svg (an XML declaration may come first)']);
    expect(checkFigure('f', '<html><svg viewBox="0 0 10 10"></svg></html>')).toContain('figure f: must start with <svg (an XML declaration may come first)');
  });

  it('requires a viewBox of four numbers', () => {
    expect(checkFigure('f', with_(' viewBox="0 0 400 240"', ''))).toEqual(['figure f: the root <svg> needs a viewBox']);
    expect(checkFigure('f', with_('viewBox="0 0 400 240"', 'viewBox="0 0 wide"'))).toEqual(['figure f: viewBox must be four numbers, like "0 0 400 240"']);
  });

  it('rejects width and height on the root element, so the page can size the figure', () => {
    expect(checkFigure('f', with_('viewBox="0 0 400 240"', 'viewBox="0 0 400 240" width="400" height="240"'))).toEqual([
      'figure f: remove width and height from the root <svg>; the page sizes the figure',
    ]);
    expect(checkFigure('f', with_('viewBox="0 0 400 240"', 'viewBox="0 0 400 240" height="240"'))).toHaveLength(1);
  });

  it('allows width and height on inner elements and stroke-width on the root', () => {
    expect(checkFigure('f', with_('viewBox="0 0 400 240"', 'viewBox="0 0 400 240" stroke-width="2"'))).toEqual([]);
  });

  it('caps the viewBox width at 480, phone first', () => {
    expect(checkFigure('f', with_('viewBox="0 0 400 240"', 'viewBox="0,0,480,240"'))).toEqual([]);
    expect(checkFigure('f', with_('viewBox="0 0 400 240"', 'viewBox="0 0 640 240"'))).toEqual([
      'figure f: viewBox is 640 wide; keep it at most 480 (phone first)',
    ]);
  });

  it('requires exactly one non-empty <title> and one non-empty <desc>', () => {
    expect(checkFigure('f', with_('<title>A stock and its flows</title>', ''))).toEqual(['figure f: needs exactly one <title>, found 0']);
    expect(checkFigure('f', with_('<title>A stock and its flows</title>', '<title>A</title><title>B</title>'))).toEqual([
      'figure f: needs exactly one <title>, found 2',
    ]);
    expect(checkFigure('f', with_('<title>A stock and its flows</title>', '<title>  </title>'))).toEqual(['figure f: <title> is empty']);
    expect(checkFigure('f', with_('<desc>Water flows into a tank and out through a valve.</desc>', ''))).toEqual([
      'figure f: needs exactly one <desc>, found 0',
    ]);
    expect(checkFigure('f', with_('<desc>Water flows into a tank and out through a valve.</desc>', '<desc></desc>'))).toEqual([
      'figure f: <desc> is empty',
    ]);
  });

  it('rejects scripts, event handlers and foreignObject', () => {
    expect(checkFigure('f', with_('</svg>', '<script>alert(1)</script></svg>'))).toEqual(['figure f: no <script>']);
    expect(checkFigure('f', with_('<rect ', '<rect onclick="x()" '))).toEqual(['figure f: no event attributes (onclick)']);
    expect(checkFigure('f', with_('<rect ', '<rect ONload="x()" '))).toEqual(['figure f: no event attributes (ONload)']);
    expect(checkFigure('f', with_('</svg>', '<foreignObject><p>x</p></foreignObject></svg>'))).toEqual(['figure f: no <foreignObject>']);
  });

  it('rejects links and references that leave the figure', () => {
    expect(checkFigure('f', with_('<use href="#arrow"', '<use href="https://example.org/a.svg#x"'))).toEqual([
      'figure f: href must point inside the figure, not to https://example.org/a.svg#x',
    ]);
    expect(checkFigure('f', with_('xlink:href="#arrow"', 'xlink:href="http://example.org/a.svg#x"'))).toEqual([
      'figure f: href must point inside the figure, not to http://example.org/a.svg#x',
    ]);
    expect(checkFigure('f', with_('<use href="#arrow"', "<use href='//example.org/a.svg'"))).toEqual([
      'figure f: href must point inside the figure, not to //example.org/a.svg',
    ]);
  });

  it.each(['<animate attributeName="opacity" to="0"/>', '<animateTransform type="rotate"/>', '<animateMotion path="M0 0"/>', '<set to="1"/>'])(
    'rejects SMIL animation (%s), which cannot respect reduced motion',
    (el) => {
      expect(checkFigure('f', with_('</svg>', `${el}</svg>`))).toEqual(['figure f: no SMIL animation (<animate>, <animateTransform>, <animateMotion>, <set>); use CSS @keyframes']);
    },
  );

  it.each([
    ['a short hex fill', 'fill="none"', 'fill="#fff"', '#fff'],
    ['a long hex stroke', 'stroke="currentColor"', 'stroke="#8E3B2C"', '#8E3B2C'],
    ['an rgb() fill', 'fill="none"', 'fill="rgb(1, 2, 3)"', 'rgb('],
    ['an hsl() stroke', 'stroke="currentColor"', 'stroke="hsl(10 50% 50%)"', 'hsl('],
    ['a named fill', 'fill="none"', 'fill="red"', 'fill="red"'],
    ['a named stroke', 'stroke="currentColor"', "stroke='Black'", 'stroke="Black"'],
    ['a colour in a style attribute', 'class="flow"', 'class="flow" style="stroke: teal"', 'stroke: teal'],
    ['a colour in the style element', 'fill: var(--leaf-2)', 'fill: #ddd3b6', '#ddd3b6'],
    ['a named colour in the style element', 'stroke: currentColor', 'stroke: navy', 'stroke: navy'],
  ])('rejects literal colour: %s', (_, from, to, shown) => {
    const errors = checkFigure('f', with_(from, to));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^figure f: literal colour .+; colour comes from the figure classes \(see docs\/figure-guide\.md\)$/);
    expect(errors[0]).toContain(shown);
  });

  it('does not mistake a reference like url(#bad) or href="#add" for a hex colour', () => {
    const svg = with_('<marker id="arrow"', '<marker id="bad"').replace('url(#arrow)', 'url(#bad)').replace('<use href="#arrow" xlink:href="#arrow"/>', '<use href="#bad"/>');
    expect(checkFigure('f', svg)).toEqual([]);
  });

  it('allows none, currentColor, a paint server and a CSS variable', () => {
    expect(checkFigure('f', with_('fill="none"', 'fill="url(#arrow)"'))).toEqual([]);
    expect(checkFigure('f', with_('class="flow"', 'class="flow" style="fill: var(--ink); stroke: none"'))).toEqual([]);
  });

  it('requires every font-size to be at least 12', () => {
    expect(checkFigure('f', with_('font-size="13"', 'font-size="12px"'))).toEqual([]);
    expect(checkFigure('f', with_('font-size="13"', 'font-size="10"'))).toEqual(['figure f: font-size 10 is below 12']);
    expect(checkFigure('f', with_('font-size="13"', 'font-size="0.6em"'))).toEqual(['figure f: font-size 0.6em: write it in px, at least 12']);
    expect(checkFigure('f', with_('ease-out 1 both;', 'ease-out 1 both; font-size: 9px;'))).toEqual(['figure f: font-size 9px is below 12']);
  });

  it('caps the file at 30 KB', () => {
    const big = with_('</svg>', `<!-- ${'x'.repeat(30 * 1024)} --></svg>`);
    expect(checkFigure('f', big)).toEqual([`figure f: ${(Buffer.byteLength(big) / 1024).toFixed(1)} KB; keep it at most 30 KB`]);
  });

  it('reports every problem at once', () => {
    const bad = '<svg width="10" viewBox="0 0 900 10"><script/><rect fill="red"/></svg>';
    expect(checkFigure('f', bad)).toHaveLength(6); // width, 900 wide, no title, no desc, script, colour
  });
});
