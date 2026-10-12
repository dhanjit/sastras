import type { Element, ElementContent, Root, Text } from 'hast';
import { SKIP, visit } from 'unist-util-visit';
import { termAnchor, type Glossary } from './glossary';

const CONTAINERS = new Set(['p', 'li', 'blockquote', 'td']);
const LEAVE_ALONE = new Set(['a', 'sup', 'code', 'pre', 'label', 'button', 'h1', 'h2', 'h3', 'h4']);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Wraps the first occurrence of each glossary term per paragraph in <a class="term" data-gloss>. */
export function rehypeGloss({ glossary }: { glossary: Glossary }) {
  const terms = [...glossary.keys()].sort((a, b) => b.length - a.length).map(escape);
  const re = terms.length ? new RegExp(`(?<![\\p{L}\\p{M}])(${terms.join('|')})(?![\\p{L}\\p{M}])`, 'giu') : null;
  let n = 0; // reset per document in the transformer

  function split(node: Text, used: Set<string>): ElementContent[] {
    const out: ElementContent[] = [];
    let last = 0;
    for (const m of node.value.matchAll(re!)) {
      const key = m[0].toLowerCase();
      if (used.has(key)) continue;
      used.add(key);
      out.push({ type: 'text', value: node.value.slice(last, m.index) });
      n += 1;
      const meaning = glossary.get(key)!;
      // the description lives next to the term, so screen readers announce it without the visual pop-up
      out.push({
        type: 'element',
        tagName: 'a',
        properties: { className: ['term'], href: `/glossary#${termAnchor(key)}`, dataGloss: meaning, ariaDescribedBy: [`gd-${n}`] },
        children: [{ type: 'text', value: m[0] }],
      });
      out.push({ type: 'element', tagName: 'span', properties: { id: `gd-${n}`, hidden: true }, children: [{ type: 'text', value: meaning }] });
      last = m.index! + m[0].length;
    }
    if (last === 0) return [node];
    out.push({ type: 'text', value: node.value.slice(last) });
    return out;
  }

  function wrap(el: Element, used: Set<string>) {
    el.children = el.children.flatMap((child): ElementContent[] => {
      if (child.type === 'text') return split(child, used);
      if (child.type === 'element' && !LEAVE_ALONE.has(child.tagName)) wrap(child, used);
      return [child];
    });
  }

  return (tree: Root) => {
    if (!re) return;
    n = 0;
    visit(tree, 'element', (el: Element) => {
      if (!CONTAINERS.has(el.tagName)) return;
      wrap(el, new Set());
      return SKIP;
    });
  };
}
