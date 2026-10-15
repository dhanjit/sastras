import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { visitParents } from 'unist-util-visit-parents';
import { DIRECTIVES, DIRECTIVE_NODES } from './directives';

/** An internal link's path without the leading slash ('' is the home page), or null when the link is relative. */
export interface InternalLink { url: string; path: string | null }
/** A `:cite` directive's source id (null when empty), whether it sits inline (the only form the renderer turns into a link), and where it sits. */
export interface Cite { id: string | null; inline: boolean; inLink: boolean; inHeading: boolean }
/** A `:note` directive: whether it sits inline (the only form the renderer turns into a margin note), whether it has text, and where it sits. */
export interface Note { inline: boolean; empty: boolean; inLink: boolean; inHeading: boolean; inNote: boolean }
/** A `::figure[caption]{#id}` directive: its id (null when missing), whether it is a leaf (on its own line, the only form the renderer draws), whether it has a caption, whether it sits in a note, and whether it is a top-level block (not in a list, quote or table). */
export interface Figure { id: string | null; leaf: boolean; caption: boolean; inNote: boolean; topLevel: boolean }
/** `bare` lists directive names written without their colon (`cite[`), which the page would print as text. */
export interface Refs { cites: Cite[]; notes: Note[]; figures: Figure[]; unknown: string[]; bare: string[]; links: InternalLink[] }

/** The Markdown parser the page pipeline starts from; describe() reads the same tree. */
export const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);

/** The label exactly as remarkCite reads it: the text children only. */
const citeLabel = (node: any): string => (node.children ?? []).map((c: any) => c.value ?? '').join('').trim();
/** A directive name and its "[" with no colon before it, as in `:cite[a],cite[b]`; not inside a longer word (footnote[1]). */
const BARE = new RegExp(`(?<![:\\w])(${[...DIRECTIVES].join('|')})\\[`, 'g');
const plainText = (node: any): string => node.value ?? (node.children ?? []).map(plainText).join('');

/** A directive that carries a label or attributes: `:ntoe[typo]`, not the `:47` in `2:47`. */
function hasLabelOrAttributes(node: any): boolean {
  if (Object.keys(node.attributes ?? {}).length > 0) return true;
  if (node.type === 'containerDirective') return Boolean(node.children?.[0]?.data?.directiveLabel);
  return (node.children ?? []).length > 0;
}

/** Citations, notes, figures, stray directives and internal links exactly as the Markdown pipeline will see them. */
export function extractRefs(body: string): Refs {
  const cites: Cite[] = [];
  const notes: Note[] = [];
  const figures: Figure[] = [];
  const unknown: string[] = [];
  const bare: string[] = [];
  const links: InternalLink[] = [];
  visitParents(parser.parse(body), (node: any, ancestors: any[]) => {
    const inLink = ancestors.some((a) => a.type === 'link' || a.type === 'linkReference');
    const inHeading = ancestors.some((a) => a.type === 'heading');
    const inNote = ancestors.some((a) => a.type === 'textDirective' && a.name === 'note');
    if (DIRECTIVE_NODES.has(node.type) && node.name === 'cite') {
      cites.push({ id: citeLabel(node) || null, inline: node.type === 'textDirective', inLink, inHeading });
    } else if (DIRECTIVE_NODES.has(node.type) && node.name === 'note') {
      notes.push({ inline: node.type === 'textDirective', empty: plainText(node).trim() === '', inLink, inHeading, inNote });
    } else if (DIRECTIVE_NODES.has(node.type) && node.name === 'figure') {
      const id = node.attributes?.id;
      figures.push({ id: id ? String(id) : null, leaf: node.type === 'leafDirective', caption: plainText(node).trim() !== '', inNote, topLevel: ancestors.length === 1 });
    } else if (DIRECTIVE_NODES.has(node.type) && !DIRECTIVES.has(node.name) && hasLabelOrAttributes(node)) {
      unknown.push(node.name);
    }
    // code is inlineCode and code nodes, never text, so a name shown in code is left alone
    if (node.type === 'text') for (const m of String(node.value).matchAll(BARE)) bare.push(m[1]);
    if (node.type === 'link' || node.type === 'definition') {
      const url: string = node.url;
      if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('#') || url.startsWith('//')) return;
      if (!url.startsWith('/')) return void links.push({ url, path: null });
      links.push({ url, path: url.split(/[?#]/)[0].slice(1) });
    }
  });
  return { cites, notes, figures, unknown, bare, links };
}
