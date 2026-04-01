import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://pulppixel.github.io',
  integrations: [sitemap()],
  output: 'static',
});
