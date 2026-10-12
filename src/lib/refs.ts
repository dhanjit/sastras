import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { visitParents } from 'unist-util-visit-parents';

/** An internal link's path without the leading slash ('' is the home page), or null when the link is relative. */
export interface InternalLink { url: string; path: string | null }
/** A `:cite` directive's source id (null when empty), whether it sits inline (the only form the renderer turns into a link), and where it sits. */
export interface Cite { id: string | null; inline: boolean; inLink: boolean; inHeading: boolean }
/** A `:note` directive: whether it has text, and where it sits. */
export interface Note { empty: boolean; inLink: boolean; inHeading: boolean; inNote: boolean }
export interface Refs { cites: Cite[]; notes: Note[]; unknown: string[]; links: InternalLink[] }

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);

const DIRECTIVES = new Set(['textDirective', 'leafDirective', 'containerDirective']);
const KNOWN = new Set(['note', 'cite']);

/** The label exactly as remarkCite reads it: the text children only. */
const citeLabel = (node: any): string => (node.children ?? []).map((c: any) => c.value ?? '').join('').trim();
const plainText = (node: any): string => node.value ?? (node.children ?? []).map(plainText).join('');

/** A directive that carries a label or attributes: `:ntoe[typo]`, not the `:47` in `2:47`. */
function hasLabelOrAttributes(node: any): boolean {
  if (Object.keys(node.attributes ?? {}).length > 0) return true;
  if (node.type === 'containerDirective') return Boolean(node.children?.[0]?.data?.directiveLabel);
  return (node.children ?? []).length > 0;
}

/** Citations, notes, stray directives and internal links exactly as the Markdown pipeline will see them. */
export function extractRefs(body: string): Refs {
  const cites: Cite[] = [];
  const notes: Note[] = [];
  const unknown: string[] = [];
  const links: InternalLink[] = [];
  visitParents(parser.parse(body), (node: any, ancestors: any[]) => {
    const inLink = ancestors.some((a) => a.type === 'link' || a.type === 'linkReference');
    const inHeading = ancestors.some((a) => a.type === 'heading');
    if (DIRECTIVES.has(node.type) && node.name === 'cite') {
      cites.push({ id: citeLabel(node) || null, inline: node.type === 'textDirective', inLink, inHeading });
    } else if (node.type === 'textDirective' && node.name === 'note') {
      const inNote = ancestors.some((a) => a.type === 'textDirective' && a.name === 'note');
      notes.push({ empty: plainText(node).trim() === '', inLink, inHeading, inNote });
    } else if (DIRECTIVES.has(node.type) && !KNOWN.has(node.name) && hasLabelOrAttributes(node)) {
      unknown.push(node.name);
    }
    if (node.type === 'link' || node.type === 'definition') {
      const url: string = node.url;
      if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('#') || url.startsWith('//')) return;
      if (!url.startsWith('/')) return void links.push({ url, path: null });
      links.push({ url, path: url.split(/[?#]/)[0].slice(1) });
    }
  });
  return { cites, notes, unknown, links };
}
