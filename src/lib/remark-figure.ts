import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';
import { SLUG } from './tree';

/** True when any element carries the class `anim`: the figure then plays on view and gets a replay button. */
const isAnimated = (svg: string) =>
  [...svg.matchAll(/\sclass\s*=\s*(["'])(.*?)\1/g)].some((m) => m[2].split(/\s+/).includes('anim'));

/**
 * Makes a figure's SVG safe to inline next to others: every id and every reference to one gets the
 * figure's prefix, and the root is named by the title and described by the desc.
 */
export function inlineSvg(figId: string, svg: string): string {
  return svg
    .replace(/^[\s\S]*?(?=<svg[\s>])/, '') // the XML declaration has no place inside HTML
    .replace(/(\sid\s*=\s*)(["'])(.*?)\2/g, (_, attr: string, q: string, id: string) => `${attr}${q}${figId}-${id}${q}`)
    .replace(/url\(\s*(["']?)#/g, `url($1#${figId}-`)
    .replace(/(\s(?:xlink:)?href\s*=\s*)(["'])#/g, `$1$2#${figId}-`)
    .replace(/<title\b[^>]*>/, `<title id="${figId}-title">`)
    .replace(/<desc\b[^>]*>/, `<desc id="${figId}-desc">`)
    .replace(/<svg\b/, `<svg role="img" aria-labelledby="${figId}-title ${figId}-desc"`);
}

/**
 * `::figure[caption]{#id}` → `<figure class="fig" id="fig-id">` with `src/figures/<id>.svg` drawn inline and
 * the caption below it. The caption keeps its Markdown children, so citations and glossary terms still render.
 * A figure with an `anim` element gets `data-animated` and a replay button; Base.astro plays it on view.
 *
 * `figures` is a plain object (see loadFigures). A missing figure renders a marker rather than crashing dev;
 * the figures integration has already failed the build on it.
 */
export function remarkFigure({ figures }: { figures: Record<string, string> }) {
  return (tree: Root) => {
    visit(tree, (node: any) => {
      if (node.type !== 'leafDirective' || node.name !== 'figure') return;
      const id = String(node.attributes?.id ?? '');
      const figId = `fig-${id}`;
      const svg = SLUG.test(id) && Object.hasOwn(figures, id) ? figures[id] : undefined;
      const animated = svg !== undefined && isAnimated(svg);
      const caption = [...(node.children ?? [])];
      if (animated) {
        caption.push({
          type: 'figureReplay',
          data: { hName: 'button', hProperties: { type: 'button', className: ['fig-replay'] }, hChildren: [{ type: 'text', value: 'Replay' }] },
        });
      }
      node.data = { hName: 'figure', hProperties: { className: ['fig'], id: figId, ...(animated ? { dataAnimated: true } : {}) } };
      node.children = [
        svg === undefined
          ? { type: 'paragraph', children: [{ type: 'text', value: `[missing figure ${id}]` }] }
          : { type: 'html', value: inlineSvg(figId, svg) },
        { type: 'figureCaption', data: { hName: 'figcaption' }, children: caption },
      ];
    });
  };
}
