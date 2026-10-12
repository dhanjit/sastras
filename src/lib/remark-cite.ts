import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

type FileData = { data: { astro?: { frontmatter?: { sources?: { id: string; title?: string }[] } } } };

/** `:cite[id]` → a superscript number linking to that source in the page's source list. */
export function remarkCite() {
  return (tree: Root, file: FileData) => {
    const sources = file.data.astro?.frontmatter?.sources ?? [];
    visit(tree, (node: any) => {
      if (node.type !== 'textDirective' || node.name !== 'cite') return;
      const id = node.children.map((c: any) => c.value ?? '').join('').replace(/[^a-z0-9-]/g, '');
      const index = sources.findIndex((s) => s.id === id);
      const n = index + 1 || '?';
      const title = sources[index]?.title ?? 'unknown source';
      node.data = {
        hName: 'sup',
        hProperties: { className: ['cite'] },
        hChildren: [
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
