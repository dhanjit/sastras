import type { Element, ElementContent, Root, Text } from 'hast';
import { SKIP, visit } from 'unist-util-visit';
import { termAnchor } from './glossary';

const CONTAINERS = new Set(['p', 'li', 'blockquote', 'td', 'figcaption']);
// svg: a figure's drawing is checked as drawn; a term link inside it would break the SVG
const LEAVE_ALONE = new Set(['a', 'sup', 'code', 'pre', 'label', 'button', 'svg', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Wraps the first occurrence of each glossary term per paragraph in <a class="term" data-gloss>.
 *
 * Takes a plain object, not a Map: Astro decides whether its content cache is stale by serializing
 * the config, and a Map serializes as `{}`, so a glossary edit would never reach the cached pages.
 */
export function rehypeGloss({ terms }: { terms: Record<string, string> }) {
  // normalize here too, so a caller other than loadGlossary cannot hand in keys the matcher would never see
  const glossary = new Map(Object.entries(terms).map(([k, v]) => [k.normalize('NFC').toLowerCase(), v] as const));
  const keys = [...glossary.keys()].sort((a, b) => b.length - a.length).map(escape);
  const re = keys.length ? new RegExp(`(?<![\\p{L}\\p{M}])(${keys.join('|')})(?![\\p{L}\\p{M}])`, 'giu') : null;

  return (tree: Root, file: { stem?: string }) => {
    if (!re) return;
    const stem = file.stem ? `${file.stem}-` : '';
    let n = 0;

    function split(node: Text, used: Set<string>): ElementContent[] {
      const value = node.value.normalize('NFC');
      const out: ElementContent[] = [];
      let last = 0;
      for (const m of value.matchAll(re!)) {
        const key = m[0].toLowerCase();
        const meaning = glossary.get(key);
        if (meaning === undefined || used.has(key)) continue; // case-folding can match a form that is not a key
        used.add(key);
        out.push({ type: 'text', value: value.slice(last, m.index) });
        n += 1;
        const id = `gd-${stem}${n}`;
        // the description lives next to the term, so screen readers announce it without the visual pop-up
        out.push({
          type: 'element',
          tagName: 'a',
          properties: { className: ['term'], href: `/glossary#${termAnchor(key)}`, dataGloss: meaning, ariaDescribedBy: [id] },
          children: [{ type: 'text', value: m[0] }],
        });
        out.push({ type: 'element', tagName: 'span', properties: { id, hidden: true }, children: [{ type: 'text', value: meaning }] });
        last = m.index! + m[0].length;
      }
      if (last === 0) return [node];
      out.push({ type: 'text', value: value.slice(last) });
      return out;
    }

    // each paragraph, list item, table cell, figure caption and note body counts its terms separately
    function wrap(el: Element, used: Set<string>) {
      el.children = el.children.flatMap((child): ElementContent[] => {
        if (child.type === 'text') return split(child, used);
        if (child.type === 'element' && !LEAVE_ALONE.has(child.tagName)) {
          const own = CONTAINERS.has(child.tagName) || ((child.properties?.className as string[] | undefined) ?? []).includes('note-body');
          wrap(child, own ? new Set() : used);
        }
        return [child];
      });
    }

    visit(tree, 'element', (el: Element) => {
      if (!CONTAINERS.has(el.tagName)) return;
      wrap(el, new Set());
      return SKIP;
    });
  };
}
