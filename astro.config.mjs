// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';

// Pages kept out of the sitemap. /blog/ joins the sitemap once the first post exists
// (remove it here and drop the noindex in src/pages/blog/index.astro).
const NOT_IN_SITEMAP = ['/blog/', '/diagnostic/thanks/', '/404/'];

// Older subpages from the 2026-10-30 build. The landing does not link them and they predate the new
// design, so they stay noindex and out of the sitemap until they are restyled and linked.
export const LEGACY_PAGES = ['/repair/', '/build-and-care/', '/diagnostic/', '/proof/', '/process/', '/faq/', '/contact/'];
const SITEMAP_EXCLUDE = [...NOT_IN_SITEMAP, ...LEGACY_PAGES];

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
      lastmod: new Date(),
      filter: (page) => !SITEMAP_EXCLUDE.some((path) => new URL(page).pathname === path),
    }),
  ],
});
