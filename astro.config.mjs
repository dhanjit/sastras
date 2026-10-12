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
  markdown: {
    processor: unified({
      remarkPlugins: [remarkDirective, remarkNote, remarkCite, remarkRestoreDirectives],
      rehypePlugins: [[rehypeGloss, { glossary: loadGlossary() }]],
    }),
  },
});
