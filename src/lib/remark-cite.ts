import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

type FileData = { data: { astro?: { frontmatter?: { sources?: { id: string }[] } } } };

/** `:cite[id]` → a superscript number linking to that source in the page's source list. */
export function remarkCite() {
  return (tree: Root, file: FileData) => {
    const sources = file.data.astro?.frontmatter?.sources ?? [];
    visit(tree, (node: any) => {
      if (node.type !== 'textDirective' || node.name !== 'cite') return;
      const id = node.children.map((c: any) => c.value ?? '').join('').replace(/[^a-z0-9-]/g, '');
      const n = sources.findIndex((s) => s.id === id) + 1 || '?';
      node.data = { hName: 'sup', hProperties: { className: ['cite'] } };
      node.children = [{ type: 'html', value: `<a href="#src-${id}" aria-label="Source ${n}">${n}</a>` }];
    });
  };
}
