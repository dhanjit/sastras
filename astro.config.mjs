import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import remarkDirective from 'remark-directive';
import { remarkNote } from './src/lib/remark-note.ts';
import { remarkCite } from './src/lib/remark-cite.ts';
import { remarkFigure } from './src/lib/remark-figure.ts';
import { remarkRestoreDirectives } from './src/lib/remark-restore-directives.ts';
import { rehypeGloss } from './src/lib/rehype-gloss.ts';
import { loadGlossary } from './src/lib/glossary.ts';
import { loadFigures } from './src/lib/figures.ts';
import { figures as checkFigures } from './src/integrations/figures.ts';

const glossaryFile = fileURLToPath(new URL('./src/data/glossary.yaml', import.meta.url));
const figuresDir = fileURLToPath(new URL('./src/figures/', import.meta.url));

export default defineConfig({
  site: 'https://sastras.dhanjit.me',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [
    // fails the build on a broken figure or a reference to a missing one
    checkFigures(),
    {
      // the glossary and the figures are read once at startup; Astro's in-place restart would not rebuild the content layer, so ask for a real one
      name: 'restart-watch',
      hooks: {
        'astro:server:setup': ({ server, logger }) => {
          server.watcher.on('change', (f) => {
            if (f === glossaryFile) logger.warn('glossary.yaml changed: stop and restart the dev server to re-gloss pages');
          });
          server.watcher.on('all', (event, f) => {
            if (['add', 'change', 'unlink'].includes(event) && f.startsWith(figuresDir) && f.endsWith('.svg')) logger.warn('figure changed: restart the dev server');
          });
        },
      },
    },
  ],
  markdown: {
    processor: unified({
      // plain objects, not Maps: Astro's content cache keys on the serialized config, and a Map serializes as {};
      // so an edited figure or glossary entry changes the digest and the cached pages are rebuilt
      remarkPlugins: [remarkDirective, remarkNote, remarkCite, [remarkFigure, { figures: loadFigures(figuresDir) }], remarkRestoreDirectives],
      rehypePlugins: [[rehypeGloss, { terms: Object.fromEntries(loadGlossary(glossaryFile)) }]],
    }),
  },
});
