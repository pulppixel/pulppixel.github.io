import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  vite: {
    build: {
      chunkSizeWarningLimit: 700,
    },
  },
  site: 'https://pulppixel.github.io',
  integrations: [sitemap()],
  output: 'static',
});

<meta property="og:image" content={new URL(ogImage, Astro.site)} />
