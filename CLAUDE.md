# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

apeLabs holding page at **apelabs.dev**. Static site deployed to Cloudflare Pages.

## Commands

- `npm run dev` — Start dev server (localhost:4321)
- `npm run build` — Build to `./dist/`
- `npm run preview` — Preview production build locally

## Architecture

**Stack:** Astro 6 (static output) + Tailwind CSS 4 + TypeScript

**Layout:** One holding page (`src/pages/index.astro`, scoped styles) plus `src/pages/404.astro`. `BaseLayout.astro` holds head/SEO, GA4 and the scroll observer. The full apeLabs site replaces this in a later build.

**Styling:** Tailwind 4 via `@tailwindcss/vite` plugin (no tailwind.config — theme defined in `src/styles/global.css` using `@theme` directive). Brand colors: `--color-brand-400` (#A78BFA), `--color-brand-500` (#8B5CF6), `--color-brand-600` (#7C3AED). Dark theme only.

**Animations:** CSS `.fade-in` class + IntersectionObserver in BaseLayout. Respects `prefers-reduced-motion`.

## Key Conventions

- Favicon PNG in `public/` root.
- Sitemap auto-generated via `@astrojs/sitemap` integration.
- GA4 tracking ID: `G-P3TDFKX6HC` (in BaseLayout head).

## Deployment

Static build on Cloudflare Pages connected to GitHub repo `apelabs-dev/apelabs-dev`. Build command: `npm run build`, output dir: `dist`. Domain: apelabs.dev (DNS on Cloudflare).
