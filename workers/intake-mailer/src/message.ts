// One intake request → one plain-text email, in the shape of the send_email binding's structured
// send() call. Pure, so it runs under `node --test`. The payload is checked again here (defence in
// depth): nothing with CR/LF reaches a header, and an odd Reply-To is dropped rather than passed on.

export interface IntakePayload {
  subject: string;
  text: string;
  replyTo: string;
}

export interface Addresses {
  from: string;
  fromName: string;
  to: string;
}

export interface OutgoingEmail {
  from: { email: string; name: string };
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
}

export const MAX_SUBJECT = 200;
export const MAX_TEXT = 12 * 1024;
const ASCII_EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

/** Validate what the Pages Function sent; null for anything malformed. */
export function parsePayload(data: unknown): IntakePayload | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const { subject, text, replyTo } = data as Record<string, unknown>;
  if (typeof subject !== 'string' || typeof text !== 'string' || typeof replyTo !== 'string') return null;
  if (!subject.trim() || !text.trim() || subject.length > MAX_SUBJECT || text.length > MAX_TEXT) return null;
  if (/[\r\n]/.test(subject) || /[\r\n]/.test(replyTo)) return null;
  return { subject, text, replyTo };
}

export function buildEmail(p: IntakePayload, a: Addresses): OutgoingEmail {
  return {
    from: { email: a.from, name: a.fromName },
    to: a.to,
    // A Reply-To that is not a plain ASCII address is left out; the address is in the body either way.
    ...(ASCII_EMAIL.test(p.replyTo) ? { replyTo: p.replyTo } : {}),
    subject: p.subject,
    text: p.text,
  };
}
