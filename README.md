# apelabs.dev

The apeLabs website: business system repair for small teams. A static Astro 6 + Tailwind 4 site on
Cloudflare Pages, with one Pages Function for the free-diagnostic form and a separate mailer Worker.

```
npm ci
npm run build      # → dist/
npm test           # unit tests for the form backend and the mailer
npm run preview    # serve dist/
```

Node ≥22.18.

## Working on the form locally

```
cp .dev.vars.example .dev.vars
PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA npm run build
npm run pages:dev
```

The example file uses Cloudflare's public Turnstile test keys, and `FORM_DEV_SINK=1` logs the request
instead of emailing it. A build without `PUBLIC_TURNSTILE_SITE_KEY` shows the spam-check error on the form.

## Layout

| Path | What |
| --- | --- |
| `src/pages/` | Routes: `/`, `/repair/`, `/build-and-care/`, `/diagnostic/`, `/proof/`, `/process/`, `/faq/`, `/contact/`, `/privacy/`, `/blog/`, 404 |
| `src/components/sections/` | Page sections, shared between the home page and the subpages |
| `src/lib/copy.ts` | All visible copy, verbatim from the copy deck |
| `src/lib/seo.ts`, `src/lib/site.ts` | Per-page SEO and JSON-LD; nav, CTA and contact constants |
| `src/lib/intake.ts` | Form validation, Turnstile and spam checks (shared by the Function and the tests) |
| `functions/` | Pages Function `POST /api/diagnostic` and the no-JS error middleware |
| `workers/intake-mailer/` | Worker that sends the one intake email (see its README for activation) |
| `src/content/blog/` | Blog posts (Markdown). `/blog/` is noindex until the first post is published |
| `public/` | Brand-kit files (icons, manifest, `og/og-image.png`) and self-hosted Geist fonts |
| `DESIGN.md`, `PRODUCT.md` | Visual system and product context |

## Environment

Set these in the Pages project (Settings → Variables and secrets / Bindings):

| Name | Kind | Purpose |
| --- | --- | --- |
| `PUBLIC_TURNSTILE_SITE_KEY` | build variable | Turnstile widget on the form |
| `TURNSTILE_SECRET_KEY` | secret | Server-side Turnstile check |
| `PUBLIC_CF_WEB_ANALYTICS_TOKEN` | build variable, optional | Cloudflare Web Analytics beacon (no cookies) |
| `INTAKE_MAILER` | service binding → `apelabs-intake-mailer` | Sends the intake email |
| `NOJS_FALLBACK` | variable, optional | `1` accepts no-JS posts without a Turnstile token (see `.dev.vars.example`) |

## Deploy

Merging to `main` deploys through the Cloudflare Pages Git integration (build `npm run build`, output `dist`).
