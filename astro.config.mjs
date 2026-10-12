import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://sastras.dhanjit.me',
  trailingSlash: 'never',
  build: { format: 'file' },
});
