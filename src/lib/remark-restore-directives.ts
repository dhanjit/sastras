import type { Root } from 'mdast';
import { SKIP, visit } from 'unist-util-visit';
import { DIRECTIVES, DIRECTIVE_NODES } from './directives';

/**
 * remark-directive reads any `:word` as a directive, so ordinary text like "Gītā 2:47" or
 * "Advaita:Dvaita" would parse as an unknown directive and be dropped from the page. Run this
 * last: it puts the original source text back for every directive that is not `note` or `cite`.
 * It reads the raw source rather than the node's children, which smartypants has already rewritten.
 */
export function remarkRestoreDirectives() {
  return (tree: Root, file: { value: unknown }) => {
    const source = String(file.value);
    visit(tree, (node: any, index, parent: any) => {
      if (!DIRECTIVE_NODES.has(node.type) || DIRECTIVES.has(node.name) || !parent || index === undefined) return;
      const { start, end } = node.position ?? {};
      if (start?.offset === undefined || end?.offset === undefined) return;
      const text = { type: 'text', value: source.slice(start.offset, end.offset) };
      parent.children[index] = node.type === 'textDirective' ? text : { type: 'paragraph', children: [text] };
      return SKIP;
    });
  };
}
