/** Remove every `:name[...]` text directive, content included. Brackets inside it may nest. */
function dropDirective(text: string, name: string): string {
  const open = `:${name}[`;
  let out = '';
  let i = 0;
  for (;;) {
    const at = text.indexOf(open, i);
    if (at < 0) return out + text.slice(i);
    out += text.slice(i, at);
    let depth = 1;
    let j = at + open.length;
    for (; j < text.length && depth > 0; j++) {
      if (text[j] === '[') depth++;
      else if (text[j] === ']') depth--;
    }
    i = j; // an unclosed directive swallows the rest, which is safer than leaking its markup into a description
  }
}

/** The body as plain running text: no directives, links, emphasis or block markers. */
function plain(body: string): string {
  return dropDirective(dropDirective(body, 'note'), 'cite')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/(^|[^\p{L}\p{N}])_([^_\n]+)_(?![\p{L}\p{N}])/gu, '$1$2')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The text for `<meta name="description">` and `og:description`: the gloss with its first letter
 * upper-cased, then the opening of the body as plain text, cut at a word boundary within `max`.
 */
export function describe(gloss: string, body: string, max = 155): string {
  const g = gloss.trim().replace(/\.+$/, '');
  const head = g.charAt(0).toUpperCase() + g.slice(1);
  const text = plain(body);
  const full = text ? `${head}. ${text}` : `${head}.`;
  if (full.length <= max) return full;
  const room = full.slice(0, max - 1); // leave a column for the ellipsis
  const atBoundary = /\s/.test(full.charAt(max - 1));
  const cut = atBoundary || !room.includes(' ') ? room : room.slice(0, room.lastIndexOf(' '));
  return `${cut.replace(/[\s,;:]+$/, '')}…`;
}
