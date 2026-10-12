import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import remarkDirective from 'remark-directive';
import { remarkNote } from './src/lib/remark-note.ts';
import { remarkCite } from './src/lib/remark-cite.ts';
import { remarkRestoreDirectives } from './src/lib/remark-restore-directives.ts';
import { rehypeGloss } from './src/lib/rehype-gloss.ts';
import { loadGlossary } from './src/lib/glossary.ts';

export default defineConfig({
  site: 'https://sastras.dhanjit.me',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [
    {
      // the glossary is read once at startup; Astro's in-place restart would not rebuild the content layer, so ask for a real one
      name: 'glossary-watch',
      hooks: {
        'astro:server:setup': ({ server, logger }) => {
          const file = fileURLToPath(new URL('./src/data/glossary.yaml', import.meta.url));
          server.watcher.on('change', (f) => {
            if (f === file) logger.warn('glossary.yaml changed: stop and restart the dev server to re-gloss pages');
          });
        },
      },
    },
  ],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkDirective, remarkNote, remarkCite, remarkRestoreDirectives],
      // a plain object, not a Map: Astro's content cache keys on the serialized config, and a Map serializes as {}
      rehypePlugins: [[rehypeGloss, { terms: Object.fromEntries(loadGlossary()) }]],
    }),
  },
});
