import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

type FileData = { data: { astro?: { frontmatter?: { sources?: { id: string; title?: string }[] } } } };

/**
 * `:cite[id]` → a superscript number linking to that source in the page's source list.
 * A cite straight after another cite starts with a comma, so `¹³` reads `¹,³`.
 */
export function remarkCite() {
  return (tree: Root, file: FileData) => {
    const sources = file.data.astro?.frontmatter?.sources ?? [];
    visit(tree, (node: any, index, parent: any) => {
      if (node.type !== 'textDirective' || node.name !== 'cite') return;
      const prev = index === undefined ? undefined : parent?.children[index - 1];
      const afterCite = prev?.type === 'textDirective' && prev.name === 'cite';
      const id = node.children.map((c: any) => c.value ?? '').join('').replace(/[^a-z0-9-]/g, '');
      const pos = sources.findIndex((s) => s.id === id);
      const n = pos + 1 || '?';
      const title = sources[pos]?.title ?? 'unknown source';
      node.data = {
        hName: 'sup',
        hProperties: { className: ['cite'] },
        hChildren: [
          ...(afterCite ? [{ type: 'text', value: ',' }] : []),
          {
            type: 'element',
            tagName: 'a',
            properties: { href: `#src-${id}`, ariaLabel: `Source ${n}: ${title}` },
            children: [{ type: 'text', value: String(n) }],
          },
        ],
      };
    });
  };
}
