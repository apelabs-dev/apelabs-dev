# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The apeLabs website at **apelabs.dev** (business system repair for small teams). Static Astro site on
Cloudflare Pages, with one Pages Function for the free-diagnostic form and a separate mailer Worker.
Product context: `PRODUCT.md`. Visual system: `DESIGN.md` (read it before any UI change).

## Commands

- `npm run dev`: dev server (localhost:4321). The form posts need the Pages Function, so use `pages:dev` for those.
- `npm run build`: build to `./dist/`
- `npm run preview`: serve the built site
- `npm test`: unit tests (`node --test tests/*.test.ts`, Node ≥22.18 runs the TypeScript natively)
- `npm run pages:dev`: `wrangler pages dev dist` with the Function (copy `.dev.vars.example` to `.dev.vars` first)
- `node scripts/check-copy.ts <site-copy-deck.md>`: checks that every string in `src/lib/copy.ts` appears verbatim in the copy deck

## Architecture

**Stack:** Astro 6 (static output, `trailingSlash: 'always'`, directory format) + Tailwind CSS 4 via
`@tailwindcss/vite` (no tailwind.config; tokens live in `src/styles/global.css` under `@theme`) + TypeScript.
`@astrojs/react` is installed for future islands, but there are none, so no React runtime ships.

**Pages:** `/` (all sections), `/repair/`, `/build-and-care/`, `/diagnostic/` (+ `/diagnostic/thanks/`,
noindex), `/proof/`, `/process/`, `/faq/` (FAQPage JSON-LD), `/contact/`, `/privacy/`, `/blog/`
(content collection, noindex while there are no posts), `404`. Each page reuses the section components in
`src/components/sections/`. The `pageHeading` prop makes a section's heading the page h1.

**Copy:** all visible copy is in `src/lib/copy.ts`, verbatim from the copy deck. Do not reword it in
components. SEO titles, descriptions and JSON-LD are in `src/lib/seo.ts`; nav, CTA and email in `src/lib/site.ts`.

**Layout:** `src/layouts/BaseLayout.astro` holds the head (SEO, OG/Twitter, brand-kit icons + manifest,
JSON-LD, optional Cloudflare Web Analytics when `PUBLIC_CF_WEB_ANALYTICS_TOKEN` is set). There is no GA4.
`Header.astro` is the sticky docking bar plus the mobile menu (a native `<dialog>`).

**Brand:** `Logo.astro` is the single swap point for the logo (lockup ≥96px wide, mark ≥32px). Kit
files in `public/` (favicons, icons, `og/og-image.png`, `site.webmanifest`) are verbatim brand-kit
drops; replace them file-for-file. Do not regenerate them. Diagrams are code: `Blocks.astro` +
`src/lib/motif.ts` (the kit's "C" block-line motif), `RunTrace`, `RepairFlow`, `ProcessStrip`, `SampleReport`.

**Motion:** `src/scripts/hero-replay.ts` sets `--p` (0–6) on the hero while the reader scrolls past the
chapters, and `RunTrace.astro` CSS eases each part with smoothstep windows. It only runs at
≥1024×760 with motion allowed, and the final state is the default for no-JS and reduced motion.
`src/scripts/reveal.ts` fades in diagram fix marks (`[data-reveal]`). No scroll-jacking, no Lenis.

**Form:** `src/components/DiagnosticForm.astro` + `src/scripts/diagnostic-form.ts` (progressive
enhancement; works without JS). `functions/api/diagnostic.ts` → `src/lib/intake.ts` (validation,
Turnstile, honeypot, size cap, origin check), then → the `INTAKE_MAILER` service binding →
`workers/intake-mailer` (one email to hello@apelabs.dev). `functions/diagnostic/_middleware.ts` shows
server errors on the no-JS path. Nothing is stored. `FORM_DEV_SINK=1` logs instead of sending.

## Key Conventions

- Dark theme only; palette, type and do/don't rules are in `DESIGN.md`. Orange is the fix or the CTA, never decoration.
- Every visual is SVG/CSS. Anything that needs a real image is a `MEDIA SLOT: <name> <w>×<h>` placeholder.
- Internal links end in `/`. One h1 per page.
- Sitemap via `@astrojs/sitemap`; noindex pages are filtered out in `astro.config.mjs` (`NOT_IN_SITEMAP`).
- Never commit secrets. `.dev.vars.example` lists every variable; the values in it are Cloudflare's public test keys.

## Deployment

Cloudflare Pages connected to GitHub repo `apelabs-dev/apelabs-dev`. Build command: `npm run build`,
output dir: `dist`, Functions from `functions/`. Domain apelabs.dev (DNS on Cloudflare; apex MX is
Google Workspace and must stay). Pages env: `PUBLIC_TURNSTILE_SITE_KEY` (build),
`PUBLIC_CF_WEB_ANALYTICS_TOKEN` (build, optional), secret `TURNSTILE_SECRET_KEY`, service binding
`INTAKE_MAILER` → `apelabs-intake-mailer`. Mailer setup: `workers/intake-mailer/README.md`.
