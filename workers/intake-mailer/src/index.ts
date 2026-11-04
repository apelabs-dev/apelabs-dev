// intake-mailer: turns one diagnostic request into one plain-text email to hello@apelabs.dev.
// Reachable only through the INTAKE_MAILER service binding of the Pages project (no workers.dev URL,
// no routes). The send_email binding is locked to a single destination in wrangler.jsonc.
import { buildEmail, parsePayload, type OutgoingEmail } from './message.ts';

interface SendEmail {
  send(message: OutgoingEmail): Promise<{ messageId: string }>;
}

interface Env {
  SEND: SendEmail;
  /** Sender on a domain onboarded for Cloudflare sending (see README). */
  MAIL_FROM: string;
  MAIL_TO: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/send') return new Response(null, { status: 404 });

    let payload;
    try {
      payload = parsePayload(await request.json());
    } catch {
      payload = null;
    }
    if (!payload) return new Response(null, { status: 400 });

    try {
      await env.SEND.send(buildEmail(payload, { from: env.MAIL_FROM, fromName: 'apeLabs intake', to: env.MAIL_TO }));
    } catch (e) {
      // Log the error code only; the message itself holds personal data.
      const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : 'unknown';
      console.error('send failed:', code);
      return new Response(null, { status: 502 });
    }
    return new Response(null, { status: 204 });
  },
};
