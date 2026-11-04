// POST /api/diagnostic: the free diagnostic request form.
// Validation, Turnstile and response mapping live in src/lib/intake.ts (unit-tested); this file only
// wires the Cloudflare environment to it. Delivery goes over the INTAKE_MAILER service binding to the
// Worker in workers/intake-mailer, because Pages Functions cannot hold a send_email binding.
// Nothing is stored here: the request becomes one email or nothing.
import { handleIntake, type IntakeMessage, type Transport } from '../../src/lib/intake.ts';

interface ServiceBinding {
  fetch(input: string | Request, init?: RequestInit): Promise<Response>;
}

interface Env {
  /** Turnstile secret (Pages secret). Without it every post fails the spam check. */
  TURNSTILE_SECRET_KEY?: string;
  /** Service binding to the intake-mailer Worker. */
  INTAKE_MAILER?: ServiceBinding;
  /** "1" in local dev: log that a message would be sent instead of sending it. */
  FORM_DEV_SINK?: string;
  /**
   * "1": accept no-JS form posts that carry no Turnstile token (honeypot, origin and size checks
   * still apply; the email subject is marked). Off by default, so Turnstile cannot be skipped.
   */
  NOJS_FALLBACK?: string;
}

interface Context {
  request: Request;
  env: Env;
}

/** Dev sink: proves the flow end to end without sending mail. Logs sizes, not contents. */
const devSink: Transport = async (m: IntakeMessage) => {
  console.log(`[FORM_DEV_SINK] would send: subject ${m.subject.length} chars, body ${m.text.length} chars`);
};

function mailerTransport(mailer: ServiceBinding | undefined): Transport {
  return async (m: IntakeMessage) => {
    if (!mailer) throw new Error('INTAKE_MAILER binding missing');
    const res = await mailer.fetch('https://intake-mailer/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(m),
    });
    if (!res.ok) throw new Error(`mailer answered ${res.status}`);
  };
}

export const onRequest = async ({ request, env }: Context): Promise<Response> =>
  handleIntake(request, {
    turnstileSecret: env.TURNSTILE_SECRET_KEY,
    noJsFallback: env.NOJS_FALLBACK === '1',
    transport: env.FORM_DEV_SINK === '1' ? devSink : mailerTransport(env.INTAKE_MAILER),
  });
