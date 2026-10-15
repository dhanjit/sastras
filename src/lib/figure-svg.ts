import type { Element, ElementContent, Properties, Root } from 'hast';
import { fromHtml } from 'hast-util-from-html';
import { find, svg as svgSchema } from 'property-information';
import postcss, { type Root as CssRoot } from 'postcss';
import { SLUG } from './tree';

/**
 * A figure is an SVG file inlined into the page. It is parsed once, exactly as the page parses it (parse5, via
 * hast-util-from-html), then checked against an allowlist and rewritten on that same tree. Nothing reads the text
 * with patterns, so the check and the browser can't disagree about what the file contains.
 */

const MAX_VIEWBOX_WIDTH = 480;
const MAX_KB = 30;
const MIN_FONT_SIZE = 12;

/** The SVG elements a figure may use. Anything else (script, foreignObject, image, a, SMIL, gradients) is refused. */
const ELEMENTS = new Set(['svg', 'g', 'defs', 'title', 'desc', 'style', 'marker', 'symbol', 'use', 'path', 'line', 'polyline', 'polygon', 'rect', 'circle', 'ellipse', 'text', 'tspan', 'clipPath']);
const HINTS: Record<string, string> = { animate: '; animate with CSS @keyframes', animateTransform: '; animate with CSS @keyframes', animateMotion: '; animate with CSS @keyframes', set: '; animate with CSS @keyframes' };
/** The attributes a figure may use: geometry, presentation, references. Deny by default: no event handlers, no style. */
const ATTRIBUTES = new Set([
  'id', 'class', 'transform', 'aria-hidden',
  'xmlns', 'xmlns:xlink', 'version', 'viewBox', 'preserveAspectRatio',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'd', 'points', 'pathLength', 'dx', 'dy',
  'refX', 'refY', 'markerWidth', 'markerHeight', 'markerUnits', 'orient', 'clipPathUnits', 'href', 'xlink:href',
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray',
  'stroke-dashoffset', 'stroke-miterlimit', 'stroke-opacity', 'opacity', 'marker-start', 'marker-mid', 'marker-end',
  'clip-path', 'clip-rule', 'vector-effect', 'paint-order',
  'text-anchor', 'dominant-baseline', 'font-size', 'font-weight', 'font-style', 'letter-spacing',
]);
/** Elements whose text is content; text anywhere else is stray. */
const TEXT_PARENTS = new Set(['text', 'tspan', 'title', 'desc', 'style']);
/** Attributes that take a colour. */
const PAINT = new Set(['fill', 'stroke']);
/** At-rules a figure's <style> may hold, besides its own @keyframes. */
const REDUCED_MOTION = /prefers-reduced-motion/i;
/** The properties a figure's <style> may set: paint, stroke, markers, text and animation. No layout, no content. */
const CSS_PROPERTIES = new Set([
  'animation', 'animation-name', 'animation-duration', 'animation-timing-function', 'animation-delay',
  'animation-iteration-count', 'animation-direction', 'animation-fill-mode', 'animation-play-state',
  'transform', 'transform-origin', 'transform-box', 'opacity', 'display', 'visibility',
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap',
  'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'paint-order', 'vector-effect', 'clip-path',
  'marker', 'marker-start', 'marker-mid', 'marker-end',
  'font', 'font-family', 'font-size', 'font-style', 'font-weight', 'font-variant', 'letter-spacing', 'text-anchor', 'dominant-baseline',
]);
/** Properties whose words are names (fonts, keyframes), not colours: only hex and colour functions are looked for there. */
const NAME_VALUED = new Set(['font', 'font-family', 'animation', 'animation-name']);
const SYSTEM_FONTS = new Set(['caption', 'icon', 'menu', 'message-box', 'small-caption', 'status-bar']);

// prettier-ignore
const NAMED_COLOURS = new Set('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen'.split(' '));
// CSS system colours, which follow the OS theme rather than the page's
// prettier-ignore
const SYSTEM_COLOURS = new Set('accentcolor accentcolortext activetext buttonborder buttonface buttontext canvas canvastext field fieldtext graytext highlight highlighttext linktext mark marktext selecteditem selecteditemtext visitedtext activeborder activecaption appworkspace background buttonhighlight buttonshadow captiontext inactiveborder inactivecaption inactivecaptiontext infobackground infotext menu menutext scrollbar threeddarkshadow threedface threedhighlight threedlightshadow threedshadow window windowframe windowtext'.split(' '));
const COLOUR_FUNCTION = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix|color|light-dark)\(/gi;
const IMAGE_FUNCTION = /(?<![\w-])(?:-webkit-)?(?:image-set|image|cross-fade|element|src)\(/i;

export interface InlineFigure {
  /** The rewritten <svg>: ids prefixed, references followed, comments dropped, named by its title and desc. */
  svg: Element;
  /** True when any element has the class `anim`. */
  animated: boolean;
}

const attributeName = (property: string) => find(svgSchema, property).attribute;
const valueOf = (v: unknown) => (Array.isArray(v) ? v.join(' ') : String(v));
const textOf = (node: ElementContent | Element): string =>
  node.type === 'text' ? node.value : 'children' in node ? node.children.map((c) => textOf(c as ElementContent)).join('') : '';
const unique = <T>(xs: T[]) => [...new Set(xs)];

const withoutStrings = (value: string) => value.replace(/"[^"]*"|'[^']*'/g, ' ');

/** Every literal colour in a CSS or attribute value: hex, colour functions, and named and system colours (unless `names` says the words are names). */
function coloursIn(value: string, names = false): string[] {
  const v = withoutStrings(value).replace(/url\([^)]*\)?/gi, ' '); // a reference or a string is not a colour
  const word = (w: string) => NAMED_COLOURS.has(w.toLowerCase()) || SYSTEM_COLOURS.has(w.toLowerCase());
  return [
    ...(v.match(/#[\w-]*/g) ?? []),
    ...[...v.matchAll(COLOUR_FUNCTION)].map((m) => m[0]),
    ...(names ? [] : (v.match(/(?<![\w-])[a-z]+(?![\w-])/gi) ?? []).filter(word)),
  ];
}

/**
 * True when a selector stays inside the figure: it starts with `#fig-<id>` (and not a longer id), has no other id,
 * and the first combinator after that compound is a descendant (space) or child (`>`). A sibling combinator there
 * (`~`, `+`) would reach the page after the figure; one further in stays inside it.
 */
function scoped(selector: string, fig: string): boolean {
  const prefix = `#${fig}`;
  if (!selector.startsWith(prefix)) return false;
  const rest = selector.slice(prefix.length);
  if (rest.includes('#') || !/^(?:$|[\s>.[:])/.test(rest)) return false;
  let depth = 0;
  let quote = '';
  let i = 0;
  for (; i < rest.length; i++) {
    const c = rest[i];
    if (quote) quote = c === quote ? '' : quote;
    else if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (depth === 0 && /[\s>+~]/.test(c)) break;
  }
  return !/^[+~]/.test(rest.slice(i).trimStart());
}

/** The target of every url(…) in a value, e.g. `#arrow`; null for an unterminated one. */
const urlsIn = (value: string) => [...value.matchAll(/url\(\s*(["']?)([^"')]*)\1\s*(\))?/gi)].map((m) => (m[3] ? m[2].trim() : null));

/** "13", "13px" → 13; anything else (em, %, keywords, var()) → null. */
const px = (value: string): number | null => {
  const m = value.trim().match(/^(\d+(?:\.\d+)?|\.\d+)(?:px)?$/i);
  return m ? Number(m[1]) : null;
};

/**
 * Parses a figure file, checks it against the rules in docs/figure-guide.md and, when it passes, rewrites it for the
 * page. Both the build check (checkFigure, through the figures integration) and the renderer (remark-figure, the
 * figure test page) come through here, so they always agree.
 */
export function prepareFigure(id: string, text: string): { errors: string[]; figure: InlineFigure | null } {
  const errors: string[] = [];
  const fail = (message: string) => errors.push(`figure ${id}: ${message}`);
  const fig = `fig-${id}`;
  const inner = (name: string) => `${fig}--${name}`; // `--` can't occur in an id, so inner ids never meet another figure's

  if (!SLUG.test(id)) fail('file name must be lower-case ASCII words joined by hyphens');
  const kb = new TextEncoder().encode(text).length / 1024;
  if (kb > MAX_KB) fail(`${kb.toFixed(1)} KB; keep it at most ${MAX_KB} KB`);
  if (!/^<svg[\s>]/.test(text.replace(/^\uFEFF/, '').trim().replace(/^<\?xml[^>]*\?>\s*/, ''))) fail('must start with <svg (an XML declaration may come first)');

  const tree: Root = fromHtml(text, { fragment: true });
  const top = tree.children.filter((n) => n.type !== 'comment' && !(n.type === 'text' && !n.value.trim()));
  const svg = top[0]?.type === 'element' && top[0].tagName === 'svg' ? top[0] : undefined;
  if (top.length !== 1 || !svg) {
    fail('must be a single <svg> element with nothing after it');
    if (!svg) return { errors, figure: null };
  }

  // the root
  const viewBox = svg.properties.viewBox;
  if (viewBox === undefined) fail('the root <svg> needs a viewBox');
  else {
    const box = valueOf(viewBox).trim().split(/[\s,]+/).map(Number);
    if (box.length !== 4 || box.some((n) => !Number.isFinite(n))) fail('viewBox must be four numbers, like "0 0 400 240"');
    else if (box[2] > MAX_VIEWBOX_WIDTH) fail(`viewBox is ${box[2]} wide; keep it at most ${MAX_VIEWBOX_WIDTH} (phone first)`);
  }
  if (svg.properties.width !== undefined || svg.properties.height !== undefined) fail('remove width and height from the root <svg>; the page sizes the figure');

  // the tree: elements, attributes, text, ids and references
  const titles: Element[] = [];
  const descs: Element[] = [];
  const styles: Element[] = [];
  const ids = new Set<string>();
  const refs: string[] = [];
  const colours: string[] = [];
  const sizes: string[] = [];
  let animated = false;
  const refuse = (target: string, what: 'href' | 'url()') => fail(`${what} must point inside the figure (#id), not to ${target}`);

  const walk = (el: Element) => {
    if (!ELEMENTS.has(el.tagName)) return void fail(`<${el.tagName}> is not allowed${HINTS[el.tagName] ?? ''}`);
    if (el.tagName === 'title') titles.push(el);
    if (el.tagName === 'desc') descs.push(el);
    if (el.tagName === 'style') styles.push(el);
    for (const [property, raw] of Object.entries(el.properties)) {
      if (raw === undefined || raw === null || raw === false) continue;
      const name = attributeName(property);
      const value = valueOf(raw);
      if (name === 'style') {
        fail('style attributes are not allowed; use the figure classes, and the <style> element for figure-specific CSS');
        continue;
      }
      if (!ATTRIBUTES.has(name)) {
        fail(`attribute ${name} is not allowed on <${el.tagName}>`);
        continue;
      }
      if (name === 'id') {
        if (value === 'title' || value === 'desc') fail(`id "${value}" is reserved for the figure's <${value}>`);
        else if (ids.has(value)) fail(`id "${value}" is used twice`);
        ids.add(value);
      } else if (name === 'class') {
        if ((raw as string[]).includes('anim')) animated = true;
      } else if (name === 'href' || name === 'xlink:href') {
        if (value.startsWith('#')) refs.push(value.slice(1));
        else refuse(value, 'href');
      } else if (name === 'font-size') {
        sizes.push(value);
      }
      for (const target of urlsIn(value)) {
        if (target?.startsWith('#')) refs.push(target.slice(1));
        else refuse(target ?? value, 'url()');
      }
      if (PAINT.has(name) && coloursIn(value).length) colours.push(`${name}="${value}"`);
    }
    for (const child of el.children) {
      if (child.type === 'element') walk(child);
      else if (child.type === 'text' && child.value.trim() && !TEXT_PARENTS.has(el.tagName)) fail(`text "${child.value.trim()}" sits outside <text>`);
    }
  };
  walk(svg);

  for (const [tag, found] of [['title', titles], ['desc', descs]] as const) {
    if (found.length !== 1) fail(`needs exactly one <${tag}>, found ${found.length}`);
    else if (!textOf(found[0]).trim()) fail(`<${tag}> is empty`);
  }

  // the <style> element applies to the whole page, so everything in it is scoped to this figure
  const sheets: { el: Element; css: CssRoot }[] = [];
  for (const el of styles) {
    const text = textOf(el);
    // the page reads <style> in an SVG as markup, so a decoded "<" could open a tag; "\\" escapes hide what CSS says
    if (text.includes('<')) {
      fail('<style> may not contain "<"');
      continue;
    }
    if (text.includes('\\')) {
      fail('<style> may not contain "\\" (no CSS escapes)');
      continue;
    }
    let css: CssRoot;
    try {
      css = postcss.parse(text);
    } catch (e) {
      fail(`<style> is not valid CSS: ${(e as { reason?: string }).reason ?? String(e)}`);
      continue;
    }
    sheets.push({ el, css });
    css.walkAtRules((at) => {
      const name = at.name.toLowerCase();
      if (at.parent?.type === 'rule') fail('nested rules are not allowed in <style>');
      else if (name === 'keyframes') {
        const keyframes = at.params.trim().replace(/^["']|["']$/g, '');
        // `--` as for ids: figure "a" can't take "a-b-spin", which might be figure "a-b"'s
        if (!keyframes.startsWith(`${id}--`)) fail(`@keyframes ${keyframes} must be named ${id}--…`);
      } else if (!(name === 'media' && REDUCED_MOTION.test(at.params))) fail(`@${at.name} is not allowed in <style>`);
    });
    css.walkRules((rule) => {
      if (rule.parent?.type === 'rule') return void fail('nested rules are not allowed in <style>'); // & can climb out of the figure
      if (rule.parent?.type === 'atrule' && /keyframes$/i.test((rule.parent as postcss.AtRule).name)) return; // from, to, 50%
      for (const selector of rule.selectors.map((s) => s.trim())) {
        if (!scoped(selector, fig)) fail(`selector "${selector}" must start with #${fig}, then a space or ">", and target parts by class`);
      }
    });
    css.walkDecls((decl) => {
      const prop = decl.prop.toLowerCase();
      if (!CSS_PROPERTIES.has(prop)) return void fail(`property ${decl.prop} is not allowed in <style>`);
      const value = decl.value;
      const image = value.match(IMAGE_FUNCTION);
      if (image) fail(`${image[0].replace(/^-webkit-/, '').toLowerCase()}) is not allowed in <style>`);
      for (const target of urlsIn(value)) {
        if (target?.startsWith('#')) refs.push(target.slice(1));
        else refuse(target ?? value, 'url()');
      }
      if (coloursIn(value, NAME_VALUED.has(prop)).length) colours.push(`${decl.prop}: ${value}`);
      if (prop === 'font-size') sizes.push(value);
      if (prop === 'font') {
        // the shorthand must carry a plain px size; a system font (font: caption) sets its own
        const tokens = withoutStrings(value).trim().split(/\s+/);
        const size = tokens.map((t) => t.split('/')[0]).find((t) => /^\d+(?:\.\d+)?px$/i.test(t));
        if (size) sizes.push(size);
        else if (tokens.length === 1 && SYSTEM_FONTS.has(tokens[0].toLowerCase())) fail(`font: ${value}: system fonts are not allowed; give the size in px, at least ${MIN_FONT_SIZE}`);
        else fail(`font: ${value}: give the size in px, at least ${MIN_FONT_SIZE}`);
      }
    });
  }

  if (colours.length) fail(`literal colour ${unique(colours).join(', ')}; colour comes from the figure classes (see docs/figure-guide.md)`);
  for (const size of unique(sizes)) {
    const n = px(size);
    if (n === null) fail(`font-size ${size}: write it in px, at least ${MIN_FONT_SIZE}`);
    else if (n < MIN_FONT_SIZE) fail(`font-size ${size} is below ${MIN_FONT_SIZE}`);
  }
  for (const ref of unique(refs)) if (!ids.has(ref)) fail(`#${ref} is referenced, but no element has that id`);

  if (errors.length) return { errors, figure: null };

  // rewrite the same tree for the page
  const relink = (value: string) => value.replace(/url\(\s*(["']?)#/gi, `url($1#${fig}--`);
  const rewrite = (el: Element) => {
    el.children = el.children.filter((c) => c.type !== 'comment');
    for (const [property, raw] of Object.entries(el.properties)) {
      const name = attributeName(property);
      if (name === 'id') el.properties[property] = inner(String(raw));
      else if (name === 'href' || name === 'xlink:href') el.properties[property] = `#${inner(String(raw).slice(1))}`;
      else if (typeof raw === 'string' && /url\(/i.test(raw)) el.properties[property] = relink(raw);
    }
    if (el.tagName === 'title') el.properties.id = inner('title');
    if (el.tagName === 'desc') el.properties.id = inner('desc');
    for (const child of el.children) if (child.type === 'element') rewrite(child);
  };
  rewrite(svg);
  for (const { el, css } of sheets) {
    // write the CSS back from the checked AST, not the source: no comments, and no raw text (which can hold them)
    css.walkComments((comment) => {
      comment.remove();
    });
    css.walk((node) => {
      node.raws = {};
      if (node.type === 'decl') node.value = relink(node.value);
    });
    css.raws = {};
    el.children = [{ type: 'text', value: css.toString() }];
  }
  svg.properties = { role: 'img', ariaLabelledBy: [inner('title'), inner('desc')], ...svg.properties };
  return { errors, figure: { svg, animated } };
}

/** Every problem with one figure file, each prefixed `figure <id>:`. */
export const checkFigure = (id: string, text: string): string[] => prepareFigure(id, text).errors;

/** The `<figure>` element's properties: its id, and `data-animated` when Base.astro should play it on view. */
export const figureProperties = (id: string, animated: boolean): Properties => ({
  className: ['fig'],
  id: `fig-${id}`,
  ...(animated ? { dataAnimated: '' } : {}),
});

/** The button that restarts an animated figure (Base.astro); it goes at the end of the caption. */
export const replayButton = (): Element => ({
  type: 'element',
  tagName: 'button',
  properties: { type: 'button', className: ['fig-replay'] },
  children: [{ type: 'text', value: 'Replay' }],
});

/** A whole `<figure>`, as remark-figure builds it: the drawing, then the caption and, for an animated figure, Replay. */
export function figureElement(id: string, figure: InlineFigure, caption: ElementContent[]): Element {
  return {
    type: 'element',
    tagName: 'figure',
    properties: figureProperties(id, figure.animated),
    children: [
      structuredClone(figure.svg),
      { type: 'element', tagName: 'figcaption', properties: {}, children: [...caption, ...(figure.animated ? [replayButton()] : [])] },
    ],
  };
}
