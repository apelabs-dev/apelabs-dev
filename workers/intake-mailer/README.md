# intake-mailer

A small Worker that turns one free-diagnostic request into one plain-text email to
hello@apelabs.dev, with Reply-To set to the person who asked. The Pages Function
(`functions/api/diagnostic.ts`) calls it over the `INTAKE_MAILER` service binding, because Pages
Functions cannot hold a `send_email` binding themselves.

- No public URL: `workers_dev` and `preview_urls` are off, and there are no routes.
- The `send_email` binding has `destination_address: hello@apelabs.dev`, so it cannot mail anyone else.
- Nothing is stored. The email is the only copy; the 90-day retention in the privacy note applies to
  the mailbox.
- Logs hold error codes only, never request contents.

## Activation (owner steps, none done by this repo)

The apex `apelabs.dev` receives mail through Google Workspace. **Do not change the apex MX records.**
Cloudflare Email Routing cannot be enabled on a zone whose apex has non-Cloudflare MX records
(error 2008), so it is not the route here.

### Option A (recommended): Cloudflare Email Sending

1. Dashboard → Compute → Email Service → Email Sending → **Onboard Domain** → `apelabs.dev`.
   It adds MX, SPF and DKIM records on `cf-bounce.apelabs.dev` (apex MX and SPF untouched) and a DMARC
   record on `_dmarc.apelabs.dev`.
   **Check first:** if `_dmarc.apelabs.dev` already exists, keep its policy, or start at `p=none`, and
   confirm Google-sent mail still passes alignment before moving to `p=reject`.
2. Keep `MAIL_FROM = intake@apelabs.dev` in `wrangler.jsonc` (any address on the onboarded domain).
3. Deploy this Worker from this folder: `npx wrangler deploy`.
4. Pages project → Settings → Bindings → add a **Service binding** `INTAKE_MAILER` → `apelabs-intake-mailer`
   (Production, and Preview if wanted).
5. Pages project → Settings → Variables and secrets → add the secret `TURNSTILE_SECRET_KEY` and the
   build variable `PUBLIC_TURNSTILE_SITE_KEY` (Turnstile widget for `apelabs.dev`), then redeploy the site.
6. Send one test request from the live form and check it lands in hello@apelabs.dev with Reply-To set.

### Option B: Email Routing on a subdomain

Only if Option A is not available on the account. Enable Email Routing for a subdomain (for example
`mail.apelabs.dev`; this adds MX records on that subdomain only), add hello@apelabs.dev as a verified
destination address, set `MAIL_FROM` to an address on that subdomain, then follow steps 3 to 6 above.

## Local development

`FORM_DEV_SINK=1` in the site's `.dev.vars` makes the Pages Function log instead of calling this Worker,
so no email is ever sent locally. The pure parts (`src/message.ts`) are covered by `npm test` at the
repo root.
