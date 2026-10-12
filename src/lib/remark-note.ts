import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

/** `:note[text]` → a red asterisk that opens a margin note. Pure CSS toggle, no JavaScript. */
export function remarkNote() {
  return (tree: Root) => {
    let n = 0;
    visit(tree, (node: any) => {
      if (node.type !== 'textDirective' || node.name !== 'note') return;
      n += 1;
      const id = `note-${n}`;
      node.data = { hName: 'span', hProperties: { className: ['note'] } };
      node.children = [
        { type: 'html', value: `<label for="${id}" class="note-mark">*</label><input type="checkbox" id="${id}" class="note-toggle" aria-label="Show note"><span class="note-body">` },
        ...node.children,
        { type: 'html', value: '</span>' },
      ];
    });
  };
}
