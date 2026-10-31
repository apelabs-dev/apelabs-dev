// Diagnostic intake: parsing, validation, spam checks and the result the endpoint maps to a
// response. Pure and platform-free (fetch and the mail transport are injected), so the same
// module runs in the Pages Function and under `node --test`. Nothing here stores anything.
import { FORM_COPY } from './copy.ts';

export const HONEYPOT_FIELD = 'company_website';
export const TURNSTILE_FIELD = 'cf-turnstile-response';
export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Whole request body cap. The longest legitimate post is well under half of this. */
export const MAX_BODY_BYTES = 16 * 1024;
export const LIMITS = {
  name: 120,
  email: 254,
  business: 200,
  toolsOther: 200,
  problem: 4000,
  extra: 500,
  /** Tool checkboxes; there are 12, so 13 leaves no room for padding. */
  tools: 13,
  token: 2048,
} as const;

export const TOOL_OPTIONS: readonly string[] = FORM_COPY.tools.options;
export const NOTICED_OPTIONS: readonly string[] = FORM_COPY.noticed.options;

export type FieldName = 'name' | 'email' | 'business' | 'tools' | 'problem';
export type FieldError = 'required' | 'email';
/** Form-level states. `spam` and `send` are the deck's two messages; the rest map onto `send`. */
export type FormError = 'spam' | 'send' | 'too_large' | 'bad_request';

export interface Submission {
  name: string;
  email: string;
  business: string;
  tools: string[];
  toolsOther: string;
  problem: string;
  noticed: string;
  extra: string;
}

/** Raw fields: every value as a list, the way form posts arrive. */
export type RawFields = Map<string, string[]>;

export type Outcome =
  | { kind: 'sent' }
  /** Honeypot filled: answer like a success, send nothing. */
  | { kind: 'dropped' }
  | { kind: 'invalid'; fields: Partial<Record<FieldName, FieldError>> }
  | { kind: 'error'; error: FormError };

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export function fieldsFromForm(params: URLSearchParams | FormData): RawFields {
  const out: RawFields = new Map();
  for (const [key, value] of params as Iterable<[string, FormDataEntryValue]>) {
    if (typeof value !== 'string') continue; // files are never accepted
    const list = out.get(key);
    if (list) list.push(value);
    else out.set(key, [value]);
  }
  return out;
}

export function fieldsFromJson(data: unknown): RawFields | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const out: RawFields = new Map();
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (typeof value === 'string') out.set(key, [value]);
    else if (Array.isArray(value) && value.every((v) => typeof v === 'string')) out.set(key, value as string[]);
    else if (value != null) return null;
  }
  return out;
}

/** Parse a body by content type. Returns null for anything that is not a form or JSON object. */
export function parseBody(contentType: string, body: string): RawFields | null {
  const type = contentType.split(';')[0].trim().toLowerCase();
  if (type === 'application/x-www-form-urlencoded') return fieldsFromForm(new URLSearchParams(body));
  if (type === 'application/json') {
    try {
      return fieldsFromJson(JSON.parse(body));
    } catch {
      return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

// Control characters other than tab and newline are dropped; CRLF becomes LF.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const clean = (s: string) => s.replace(/\r\n?/g, '\n').replace(CONTROL, '').trim();
/** Single-line fields cannot carry newlines (they end up in mail headers or subject lines). */
const oneLine = (s: string) => clean(s).replace(/\s+/g, ' ');

// Deliberately plain: one @, no spaces or header-significant characters, a dotted domain.
const EMAIL = /^[^\s@<>()[\],;:"\\]+@[^\s@<>()[\],;:"\\]+\.[^\s@<>()[\],;:"\\]{2,}$/;
export const isEmail = (s: string) => s.length <= LIMITS.email && EMAIL.test(s);

export function honeypotTripped(raw: RawFields): boolean {
  return (raw.get(HONEYPOT_FIELD) ?? []).some((v) => v.trim() !== '');
}

type Validated =
  | { ok: true; value: Submission }
  | { ok: false; fields: Partial<Record<FieldName, FieldError>> }
  | { ok: false; error: 'too_large' | 'bad_request' };

export function validate(raw: RawFields): Validated {
  const one = (key: string) => (raw.get(key) ?? [])[0] ?? '';
  // More than one value for a single-value field is not something our form sends.
  for (const key of ['name', 'email', 'business', 'tools_other', 'problem', 'noticed', 'extra']) {
    if ((raw.get(key) ?? []).length > 1) return { ok: false, error: 'bad_request' };
  }

  const value: Submission = {
    name: oneLine(one('name')),
    email: oneLine(one('email')),
    business: oneLine(one('business')),
    tools: (raw.get('tools') ?? []).map(oneLine).filter(Boolean),
    toolsOther: oneLine(one('tools_other')),
    problem: clean(one('problem')),
    noticed: oneLine(one('noticed')),
    extra: oneLine(one('extra')),
  };

  const tooLong =
    value.name.length > LIMITS.name ||
    value.email.length > LIMITS.email ||
    value.business.length > LIMITS.business ||
    value.toolsOther.length > LIMITS.toolsOther ||
    value.problem.length > LIMITS.problem ||
    value.extra.length > LIMITS.extra ||
    value.tools.length > LIMITS.tools;
  if (tooLong) return { ok: false, error: 'too_large' };

  if (value.tools.some((t) => !TOOL_OPTIONS.includes(t))) return { ok: false, error: 'bad_request' };
  if (value.noticed && !NOTICED_OPTIONS.includes(value.noticed)) return { ok: false, error: 'bad_request' };
  value.tools = [...new Set(value.tools)];

  const fields: Partial<Record<FieldName, FieldError>> = {};
  if (!value.name) fields.name = 'required';
  if (!value.email) fields.email = 'required';
  else if (!isEmail(value.email)) fields.email = 'email';
  if (!value.business) fields.business = 'required';
  if (value.tools.length === 0 && !value.toolsOther) fields.tools = 'required';
  if (!value.problem) fields.problem = 'required';

  return Object.keys(fields).length ? { ok: false, fields } : { ok: true, value };
}

// ---------------------------------------------------------------------------
// Turnstile
// ---------------------------------------------------------------------------

export interface TurnstileCheck {
  token: string;
  secret: string;
  remoteip?: string;
  /** Lets siteverify be retried without the token counting as reused. */
  idempotencyKey?: string;
  fetchImpl?: typeof fetch;
}

/** True only when siteverify answers success. Network or parse failures count as a failed check. */
export async function verifyTurnstile({ token, secret, remoteip, idempotencyKey, fetchImpl = fetch }: TurnstileCheck) {
  if (!token || !secret || token.length > LIMITS.token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (remoteip) body.set('remoteip', remoteip);
  if (idempotencyKey) body.set('idempotency_key', idempotencyKey);
  try {
    const res = await fetchImpl(SITEVERIFY_URL, { method: 'POST', body });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: unknown };
    return data.success === true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Message
// ---------------------------------------------------------------------------

export interface IntakeMessage {
  subject: string;
  text: string;
  replyTo: string;
}

export function formatMessage(s: Submission, receivedAt: Date): IntakeMessage {
  const tools = [...s.tools, ...(s.toolsOther ? [`Other: ${s.toolsOther}`] : [])].join(', ');
  const lines = [
    'New free diagnostic request from apelabs.dev',
    '',
    `Name: ${s.name}`,
    `Email: ${s.email}`,
    `Business: ${s.business}`,
    `Tools: ${tools}`,
    `First noticed: ${s.noticed || '(not given)'}`,
    `Anything else: ${s.extra || '(not given)'}`,
    '',
    'What should happen, and what happens instead:',
    s.problem,
    '',
    `Received: ${receivedAt.toISOString()}`,
    'Retention: delete after 90 days unless we work together (privacy note).',
  ];
  return {
    subject: `Diagnostic request: ${s.business}`.slice(0, 160),
    text: lines.join('\n'),
    replyTo: s.email,
  };
}

// ---------------------------------------------------------------------------
// The whole flow
// ---------------------------------------------------------------------------

export type Transport = (message: IntakeMessage) => Promise<void>;

export interface IntakeRequest {
  contentType: string;
  /** Declared Content-Length, when present. */
  contentLength?: number | null;
  body: string;
  remoteip?: string;
  idempotencyKey?: string;
  turnstileSecret?: string;
  transport: Transport;
  fetchImpl?: typeof fetch;
  now?: Date;
}

export async function processIntake(req: IntakeRequest): Promise<Outcome> {
  const declared = req.contentLength ?? 0;
  if (declared > MAX_BODY_BYTES || new TextEncoder().encode(req.body).length > MAX_BODY_BYTES) {
    return { kind: 'error', error: 'too_large' };
  }
  const raw = parseBody(req.contentType, req.body);
  if (!raw) return { kind: 'error', error: 'bad_request' };
  if (honeypotTripped(raw)) return { kind: 'dropped' };

  const checked = validate(raw);
  if (!checked.ok) {
    return 'fields' in checked ? { kind: 'invalid', fields: checked.fields } : { kind: 'error', error: checked.error };
  }

  const human = await verifyTurnstile({
    token: (raw.get(TURNSTILE_FIELD) ?? [])[0] ?? '',
    secret: req.turnstileSecret ?? '',
    remoteip: req.remoteip,
    idempotencyKey: req.idempotencyKey,
    fetchImpl: req.fetchImpl,
  });
  if (!human) return { kind: 'error', error: 'spam' };

  try {
    await req.transport(formatMessage(checked.value, req.now ?? new Date()));
  } catch {
    return { kind: 'error', error: 'send' };
  }
  return { kind: 'sent' };
}

// ---------------------------------------------------------------------------
// Mapping an outcome to responses
// ---------------------------------------------------------------------------

/** The deck message shown for a form-level error. */
export const visibleError = (e: FormError): 'spam' | 'send' => (e === 'spam' ? 'spam' : 'send');

export function statusFor(o: Outcome): number {
  switch (o.kind) {
    case 'sent':
    case 'dropped':
      return 200;
    case 'invalid':
      return 422;
    case 'error':
      return o.error === 'spam' ? 403 : o.error === 'too_large' ? 413 : o.error === 'send' ? 502 : 400;
  }
}

/** JSON body for script clients. Only fixed codes, never submitted values. */
export function jsonFor(o: Outcome) {
  if (o.kind === 'sent' || o.kind === 'dropped') return { ok: true };
  if (o.kind === 'invalid') return { ok: false, fields: o.fields };
  return { ok: false, error: visibleError(o.error) };
}

export const THANKS_PATH = '/diagnostic/thanks/';
export const FORM_PATH = '/diagnostic/';

/** 303 target for no-JS posts. The query only ever holds fixed codes and field names. */
export function redirectFor(o: Outcome): string {
  if (o.kind === 'sent' || o.kind === 'dropped') return THANKS_PATH;
  if (o.kind === 'invalid') {
    const list = Object.entries(o.fields).map(([f, e]) => `${f}.${e}`);
    return `${FORM_PATH}?error=fields&fields=${list.join(',')}#diagnostic`;
  }
  return `${FORM_PATH}?error=${visibleError(o.error)}#diagnostic`;
}

/** Parse a redirect query back into known codes; anything unknown is ignored. */
export function errorsFromQuery(params: URLSearchParams) {
  const form = params.get('error');
  const fields: Partial<Record<FieldName, FieldError>> = {};
  const known: FieldName[] = ['name', 'email', 'business', 'tools', 'problem'];
  for (const pair of (params.get('fields') ?? '').split(',').slice(0, known.length)) {
    const [f, e] = pair.split('.');
    if (known.includes(f as FieldName) && (e === 'required' || e === 'email')) fields[f as FieldName] = e;
  }
  return {
    form: form === 'spam' || form === 'send' ? form : null,
    fields,
  };
}
