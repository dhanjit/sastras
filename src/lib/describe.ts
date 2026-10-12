import { parser } from './refs';
import { remarkRestoreDirectives } from './remark-restore-directives';

/** Subtrees that are not running prose: citations and notes, link definitions, footnotes, raw HTML, code, images. */
const SKIP = new Set(['definition', 'footnoteDefinition', 'footnoteReference', 'html', 'code', 'image', 'imageReference', 'yaml', 'toml']);
const DIRECTIVE_NODES = new Set(['textDirective', 'leafDirective', 'containerDirective']);
/** Inline nodes: their text runs straight on. Everything else is a block and is set off by a space. */
const PHRASING = new Set(['text', 'inlineCode', 'emphasis', 'strong', 'delete', 'link', 'linkReference', 'textDirective']);

function textOf(node: any): string {
  if (SKIP.has(node.type) || (DIRECTIVE_NODES.has(node.type) && (node.name === 'note' || node.name === 'cite'))) return '';
  if (node.type === 'break') return ' ';
  if (node.type === 'text' || node.type === 'inlineCode') return node.value; // the parser has already decoded `&amp;` and the like
  const inner = (node.children ?? []).map(textOf).join('');
  return PHRASING.has(node.type) ? inner : ` ${inner} `;
}

/** The Markdown body as plain running text. */
function plain(body: string): string {
  const tree = parser.parse(body);
  remarkRestoreDirectives()(tree as any, { value: body }); // "Gītā 2:47" is text, as on the page
  return textOf(tree).replace(/\s+/g, ' ').trim();
}

/**
 * The text for `<meta name="description">` and `og:description`: the gloss with its first letter
 * upper-cased, then the opening of the body as plain text, cut at a word boundary within `max`.
 *
 * Ellipsis rule: a cut that lands on the end of a sentence (`.`, `?` or `!`, optionally followed by a
 * closing quote or bracket) keeps its punctuation and gets no ellipsis, so the result never ends in
 * `.…`. A cut that lands mid-sentence loses any trailing `,;:.·—` and gets "…".
 */
export function describe(gloss: string, body: string, max = 155): string {
  const g = gloss.trim().replace(/\.+$/, '');
  const head = g.charAt(0).toUpperCase() + g.slice(1);
  const text = plain(body);
  const full = text ? `${head}. ${text}` : `${head}.`;
  if (full.length <= max) return full;
  const room = full.slice(0, max - 1); // leave a column for the ellipsis
  const atBoundary = /\s/.test(full.charAt(max - 1));
  const cut = (atBoundary || !room.includes(' ') ? room : room.slice(0, room.lastIndexOf(' '))).replace(/[\uD800-\uDBFF]$/, '').trimEnd();
  if (/[.?!][”’"')\]]*$/.test(cut)) return cut;
  return `${cut.replace(/[\s,;:.·—]+$/, '')}…`;
}
