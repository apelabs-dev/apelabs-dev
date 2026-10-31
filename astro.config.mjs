// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';

// Pages kept out of the sitemap. /blog/ joins the sitemap once the first post exists
// (remove it here and drop the noindex in src/pages/blog/index.astro).
const NOT_IN_SITEMAP = ['/blog/', '/diagnostic/thanks/', '/404/'];

export default defineConfig({
  site: 'https://apelabs.dev',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },

  vite: {
    plugins: [tailwindcss()],
  },

  // React is available for future islands only (client:visible / client:idle).
  // With no island on a page, no React runtime ships.
  integrations: [
    react(),
    sitemap({
      filter: (page) => !NOT_IN_SITEMAP.some((path) => new URL(page).pathname === path),
    }),
  ],
});
