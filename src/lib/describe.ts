import { DIRECTIVE_NODES } from './directives';
import { parser } from './refs';
import { remarkRestoreDirectives } from './remark-restore-directives';

/** Subtrees that are not running prose: citations, notes and figures, link definitions, footnotes, raw HTML, code, images. */
const SKIP = new Set(['definition', 'footnoteDefinition', 'footnoteReference', 'html', 'code', 'image', 'imageReference', 'yaml', 'toml']);
/** Inline nodes: their text runs straight on. Everything else is a block and is set off by a space. */
const PHRASING = new Set(['text', 'inlineCode', 'emphasis', 'strong', 'delete', 'link', 'linkReference', 'textDirective']);

function textOf(node: any): string {
  if (SKIP.has(node.type) || (DIRECTIVE_NODES.has(node.type) && (node.name === 'note' || node.name === 'cite' || node.name === 'figure'))) return '';
  if (node.type === 'break') return ' ';
  if (node.type === 'text' || node.type === 'inlineCode') return node.value; // the parser has already decoded `&amp;` and the like
  const inner = (node.children ?? []).map(textOf).join('');
  return PHRASING.has(node.type) ? inner : ` ${inner} `;
}

/**
 * A word that ends in a full stop without ending a sentence: any single letter, with any combining marks
 * ("c.", "d.", "b.", "r.", the "g." of "e.g.", an initial) or one of the listed short forms ("ca.", "cf.", "fl.",
 * "vol.", "ed.", "eds.", "lit.", "Skt.", "pp.", "vv.", "ch.", "viz.", "vs.", "tr.", "trans.", "esp."), optionally
 * followed by closing quotes or brackets. The word must start the text or follow a non-letter, so "book." does not match.
 * Era markers ("CE.", "BCE.", "AD.") are deliberately not listed: they usually do end the sentence.
 */
const ABBREVIATION = /(?<![\p{L}\p{M}\p{N}])(?:\p{L}\p{M}*|ca|cf|fl|vol|ed|eds|lit|skt|pp|vv|ch|viz|vs|tr|trans|esp)\.[”’"')\]]*$/iu;

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
 * Ellipsis rules:
 * - A cut that lands on the end of a sentence (`.`, `?` or `!`, optionally followed by a closing quote or
 *   bracket) keeps its punctuation and gets no ellipsis.
 * - A cut that lands right after an abbreviation (see `ABBREVIATION`) is mid-sentence: its stop belongs
 *   to the word, so it stays, and the ellipsis follows it directly ("lived c.…"). Never a bare "c.". A comma,
 *   semicolon, colon, dot or dash after the abbreviation is dropped first ("e.g.," becomes "e.g.…").
 * - Any other mid-sentence cut loses its trailing `,;:.·—` and gets "…", so the result never ends in `.…`
 *   except after an abbreviation.
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
  const bare = cut.replace(/[\s,;:·—]+$/, ''); // the stop of an abbreviation survives this; an ordinary word's is stripped below
  if (ABBREVIATION.test(bare)) return `${bare}…`;
  if (/[.?!][”’"')\]]*$/.test(cut)) return cut;
  return `${cut.replace(/[\s,;:.·—]+$/, '')}…`;
}
