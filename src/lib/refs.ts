import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { visit } from 'unist-util-visit';

/** An internal link's path without the leading slash ('' is the home page), or null when the link is relative. */
export interface InternalLink { url: string; path: string | null }
/** A `:cite` directive's source id (null when empty) and whether it sits inline, which is the only form the renderer turns into a link. */
export interface Cite { id: string | null; inline: boolean }
export interface Refs { cites: Cite[]; links: InternalLink[] }

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);

/** Citations and internal links exactly as the Markdown pipeline will see them. */
export function extractRefs(body: string): Refs {
  const cites: Cite[] = [];
  const links: InternalLink[] = [];
  visit(parser.parse(body), (node: any) => {
    if ((node.type === 'textDirective' || node.type === 'leafDirective') && node.name === 'cite') {
      const label = (node.children ?? []).map((c: any) => c.value ?? '').join('').trim();
      cites.push({ id: label || null, inline: node.type === 'textDirective' });
    }
    if (node.type === 'link' || node.type === 'definition') {
      const url: string = node.url;
      if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('#') || url.startsWith('//')) return;
      if (!url.startsWith('/')) return void links.push({ url, path: null });
      links.push({ url, path: url.split(/[?#]/)[0].slice(1) });
    }
  });
  return { cites, links };
}
