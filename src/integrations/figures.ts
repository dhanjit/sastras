import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { checkFigure } from '../lib/figure-svg';
import { loadFigures } from '../lib/figures';
import { extractRefs } from '../lib/refs';

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

/**
 * Every problem with the figures: each file in `figuresDir` against the figure rules, and each `::figure{#id}`
 * in a block that has no file. References are read with the Markdown parser the pages use (`extractRefs`),
 * so a figure in a code sample is not one, and `{#id .class}` still counts. Also lists figures no block uses.
 */
export function findFigureProblems({ figuresDir, blocksDir }: { figuresDir: string; blocksDir: string }) {
  const figures = loadFigures(figuresDir);
  const errors = Object.entries(figures).flatMap(([id, svg]) => checkFigure(id, svg));
  const used = new Set<string>();
  const blocks = readdirSync(blocksDir).filter((f) => f.endsWith('.md')).sort();
  for (const file of blocks) {
    const body = readFileSync(join(blocksDir, file), 'utf8').replace(FRONTMATTER, '');
    for (const { id } of extractRefs(body).figures) {
      if (id === null) continue; // validate() reports it with the block's other content errors
      used.add(id);
      if (!Object.hasOwn(figures, id)) errors.push(`${file.slice(0, -'.md'.length)}: ::figure{#${id}} has no file src/figures/${id}.svg`);
    }
  }
  return { errors, unused: Object.keys(figures).filter((id) => !used.has(id)) };
}

/**
 * Fails `astro build` and `astro dev` on a broken figure or a reference to a missing one, and a production build
 * that contains the figure test pages. This lives here, not in
 * validate(), because it needs the file system, which the bundled page code does not have.
 */
export function figures(): AstroIntegration {
  return {
    name: 'figures',
    hooks: {
      'astro:config:setup': ({ config, logger }) => {
        const { errors, unused } = findFigureProblems({
          figuresDir: fileURLToPath(new URL('figures/', config.srcDir)),
          blocksDir: fileURLToPath(new URL('content/blocks/', config.srcDir)),
        });
        if (errors.length) throw new Error(`Figure errors:\n- ${errors.join('\n- ')}`);
        for (const id of unused) logger.warn(`figure ${id} is not used on any page`);
      },
      // the figure test pages (src/pages/figure-test/) are for e2e only; a production build must never ship them
      'astro:build:done': ({ dir }) => {
        if (process.env.E2E_FIGURES !== '1' && existsSync(new URL('figure-test/', dir))) {
          throw new Error('dist/figure-test/ exists, but figure test pages are built only for e2e (E2E_FIGURES=1)');
        }
      },
    },
  };
}
