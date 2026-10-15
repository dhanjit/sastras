import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';
import { figureProperties, prepareFigure, replayButton, type InlineFigure } from './figure-svg';
import { SLUG } from './tree';

/**
 * `::figure[caption]{#id}` → `<figure class="fig" id="fig-id">` with `src/figures/<id>.svg` drawn inline and
 * the caption below it. The caption keeps its Markdown children, so citations and glossary terms still render.
 * A figure with an `anim` element gets `data-animated` and a replay button; Base.astro plays it on view.
 *
 * The drawing goes in as a hast tree (`hChildren`), never as an HTML string. Each figure is parsed and checked once,
 * when the plugin is set up; one that fails its checks is never inlined (the figures integration has already
 * failed the build on it, and a missing figure likewise renders a marker rather than crashing dev).
 */
export function remarkFigure({ figures }: { figures: Record<string, string> }) {
  const ready = new Map<string, InlineFigure | null>(Object.entries(figures).map(([id, text]) => [id, prepareFigure(id, text).figure]));
  return (tree: Root) => {
    visit(tree, (node: any) => {
      if (node.type !== 'leafDirective' || node.name !== 'figure') return;
      const id = String(node.attributes?.id ?? '');
      const figure = SLUG.test(id) && ready.has(id) ? ready.get(id) : undefined;
      const animated = Boolean(figure?.animated);
      const caption = [...(node.children ?? [])];
      if (animated) {
        const button = replayButton();
        caption.push({ type: 'figureReplay', data: { hName: button.tagName, hProperties: button.properties, hChildren: button.children } });
      }
      node.data = { hName: 'figure', hProperties: figureProperties(id, animated) };
      const marker = figure === null ? `[figure ${id} fails its checks]` : `[missing figure ${id}]`;
      const svg = figure ? structuredClone(figure.svg) : undefined;
      node.children = [
        svg
          ? { type: 'figureDrawing', data: { hName: 'svg', hProperties: svg.properties, hChildren: svg.children } }
          : { type: 'paragraph', children: [{ type: 'text', value: marker }] },
        { type: 'figureCaption', data: { hName: 'figcaption' }, children: caption },
      ];
    });
  };
}
