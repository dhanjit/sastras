import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

type FileInfo = { stem?: string };

/**
 * `:note[text]` → a red asterisk that opens a margin note. Pure CSS toggle, no JavaScript.
 *
 * Built as real elements (not HTML strings) so attributes are escaped. The note's own children stay
 * inside the body, so formatting and glossary terms inside a note still render.
 */
export function remarkNote() {
  return (tree: Root, file: FileInfo) => {
    const stem = file.stem ? `${file.stem}-` : '';
    let n = 0;
    visit(tree, (node: any) => {
      if (node.type !== 'textDirective' || node.name !== 'note') return;
      n += 1;
      const id = `note-${stem}${n}`;
      node.data = { hName: 'span', hProperties: { className: ['note'] } };
      node.children = [
        {
          type: 'noteMark',
          data: {
            hName: 'label',
            hProperties: { className: ['note-mark'], htmlFor: id, ariaHidden: 'true' },
            hChildren: [{ type: 'text', value: '*' }],
          },
        },
        {
          type: 'noteToggle',
          data: {
            hName: 'input',
            hProperties: { className: ['note-toggle'], type: 'checkbox', id, ariaLabel: `Show note ${n}` },
            hChildren: [],
          },
        },
        {
          type: 'noteBody',
          data: { hName: 'span', hProperties: { className: ['note-body'] } },
          children: [
            {
              type: 'noteLabel',
              data: {
                hName: 'span',
                hProperties: { className: ['sr-only'] },
                hChildren: [{ type: 'text', value: 'Note: ' }],
              },
            },
            ...node.children,
          ],
        },
      ];
    });
  };
}
