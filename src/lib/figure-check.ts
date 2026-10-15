import { SLUG } from './tree';

const MAX_VIEWBOX_WIDTH = 480;
const MAX_KB = 30;
const MIN_FONT_SIZE = 12;
/** Properties that take a colour, as attributes (`fill="…"`) or CSS declarations (`fill: …`). */
const COLOUR_PROPS = 'fill|stroke|stop-color|flood-color|lighting-color|color';
/** The only bare keywords a colour property may take; everything else comes from the figure classes. */
const COLOUR_KEYWORDS = /^(?:none|currentcolor|inherit)$/i;
const HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi;
const COLOUR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\([^)]*\)?/gi;

const unique = (xs: string[]) => [...new Set(xs)];

/** Every `name="value"` attribute in every start tag. */
function attributes(svg: string): { name: string; value: string }[] {
  const out: { name: string; value: string }[] = [];
  for (const [tag] of svg.matchAll(/<[a-z][^>]*>/gi)) {
    for (const m of tag.matchAll(/\s([\w:.-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) out.push({ name: m[1], value: m[3] });
  }
  return out;
}

/** CSS declarations from `<style>` elements and `style="…"` attributes. */
function declarations(svg: string, attrs: { name: string; value: string }[]): { prop: string; value: string }[] {
  const css = [...svg.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  css.push(...attrs.filter((a) => a.name.toLowerCase() === 'style').map((a) => a.value));
  const out: { prop: string; value: string }[] = [];
  for (const text of css) {
    for (const m of text.matchAll(/(?<![\w-])([a-z-]+)\s*:\s*([^;{}]+)/gi)) out.push({ prop: m[1].toLowerCase(), value: m[2].replace(/!important/i, '').trim() });
  }
  return out;
}

/** "13", "13px" → 13; anything else (em, %, keywords) → null. */
const px = (value: string): number | null => {
  const m = value.trim().match(/^(\d+(?:\.\d+)?|\.\d+)(?:px)?$/i);
  return m ? Number(m[1]) : null;
};

/**
 * Checks one figure file against the rules in docs/figure-guide.md: an inline, self-contained, theme-coloured,
 * phone-first SVG with a title and description. Returns one message per problem, each prefixed `figure <id>:`.
 */
export function checkFigure(id: string, svg: string): string[] {
  const errors: string[] = [];
  const fail = (message: string) => errors.push(`figure ${id}: ${message}`);

  if (!SLUG.test(id)) fail('file name must be lower-case ASCII words joined by hyphens');

  const body = svg.trim().replace(/^<\?xml[^>]*\?>\s*/, '');
  if (!/^<svg[\s>]/.test(body)) fail('must start with <svg (an XML declaration may come first)');

  // comments are not drawn, so the rules below look only at what is
  const code = svg.replace(/<!--[\s\S]*?-->/g, '');
  const root = code.match(/<svg\b[^>]*>/)?.[0] ?? '';

  const viewBox = root.match(/\sviewBox\s*=\s*(["'])(.*?)\1/i)?.[2];
  if (viewBox === undefined) fail('the root <svg> needs a viewBox');
  else {
    const box = viewBox.trim().split(/[\s,]+/).map(Number);
    if (box.length !== 4 || box.some((n) => !Number.isFinite(n))) fail('viewBox must be four numbers, like "0 0 400 240"');
    else if (box[2] > MAX_VIEWBOX_WIDTH) fail(`viewBox is ${box[2]} wide; keep it at most ${MAX_VIEWBOX_WIDTH} (phone first)`);
  }
  if (/\s(?:width|height)\s*=/i.test(root)) fail('remove width and height from the root <svg>; the page sizes the figure');

  for (const tag of ['title', 'desc']) {
    const found = [...code.matchAll(new RegExp(`<${tag}\\b[^>]*?(?:/>|>([\\s\\S]*?)</${tag}>)`, 'g'))];
    if (found.length !== 1) fail(`needs exactly one <${tag}>, found ${found.length}`);
    else if (!(found[0][1] ?? '').replace(/<[^>]*>/g, '').trim()) fail(`<${tag}> is empty`);
  }

  if (/<script\b/i.test(code)) fail('no <script>');
  const handlers = unique([...code.matchAll(/<[a-z][^>]*>/gi)].flatMap(([tag]) => [...tag.matchAll(/\s(on[a-z]+)\s*=/gi)].map((m) => m[1])));
  if (handlers.length) fail(`no event attributes (${handlers.join(', ')})`);
  if (/<foreignObject\b/i.test(code)) fail('no <foreignObject>');
  if (/<(?:animate\w*|set)\b/i.test(code)) fail('no SMIL animation (<animate>, <animateTransform>, <animateMotion>, <set>); use CSS @keyframes');

  const attrs = attributes(code);
  const decls = declarations(code, attrs);

  // any scheme (http:, https:, data:, javascript:) or a protocol-relative URL leaves the figure
  for (const href of unique(attrs.filter((a) => /^(?:xlink:)?href$/i.test(a.name)).map((a) => a.value.trim()))) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) fail(`href must point inside the figure, not to ${href}`);
  }

  // colour must come from the figure classes, so it follows the theme; a reference like url(#a) is not a colour
  const valueText = [
    ...attrs.filter((a) => !/^(?:xlink:)?href$|^id$/i.test(a.name)).map((a) => a.value),
    ...decls.map((d) => d.value),
  ]
    .join('\n')
    .replace(/url\(\s*["']?#[^)]*\)/gi, 'url()');
  const colours = [
    ...[...valueText.matchAll(HEX)].map((m) => m[0]),
    ...[...valueText.matchAll(COLOUR_FUNCTION)].map((m) => m[0]),
    ...attrs
      .filter((a) => new RegExp(`^(?:${COLOUR_PROPS})$`, 'i').test(a.name) && /^[a-z]+$/i.test(a.value.trim()) && !COLOUR_KEYWORDS.test(a.value.trim()))
      .map((a) => `${a.name}="${a.value.trim()}"`),
    ...decls
      .filter((d) => new RegExp(`^(?:${COLOUR_PROPS})$`).test(d.prop) && /^[a-z]+$/i.test(d.value) && !COLOUR_KEYWORDS.test(d.value))
      .map((d) => `${d.prop}: ${d.value}`),
  ];
  if (colours.length) fail(`literal colour ${unique(colours).join(', ')}; colour comes from the figure classes (see docs/figure-guide.md)`);

  const sizes = [...attrs.filter((a) => a.name.toLowerCase() === 'font-size').map((a) => a.value.trim()), ...decls.filter((d) => d.prop === 'font-size').map((d) => d.value)];
  for (const size of unique(sizes)) {
    const n = px(size);
    if (n === null) fail(`font-size ${size}: write it in px, at least ${MIN_FONT_SIZE}`);
    else if (n < MIN_FONT_SIZE) fail(`font-size ${size} is below ${MIN_FONT_SIZE}`);
  }

  const kb = new TextEncoder().encode(svg).length / 1024;
  if (kb > MAX_KB) fail(`${kb.toFixed(1)} KB; keep it at most ${MAX_KB} KB`);

  return errors;
}
