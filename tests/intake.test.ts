// Unit tests for the diagnostic intake (node --test; Node runs the .ts sources directly).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  HONEYPOT_FIELD,
  LIMITS,
  MAX_BODY_BYTES,
  SITEVERIFY_URL,
  TURNSTILE_FIELD,
  UNVERIFIED_PREFIX,
  errorsFromQuery,
  formatMessage,
  handleIntake,
  isEmail,
  jsonFor,
  parseBody,
  processIntake,
  readBodyLimited,
  redirectFor,
  statusFor,
  validate,
  type IntakeMessage,
  type Transport,
} from '../src/lib/intake.ts';

const ORIGIN = 'https://apelabs.dev';
const SECRET = '1x0000000000000000000000000000000AA';

const valid = {
  name: 'Sam Rivera',
  email: 'sam@example.com',
  business: 'Harbor Plumbing',
  tools: ['Zapier', 'HubSpot'],
  problem: 'Bookings should create a CRM contact. Some do not.',
  noticed: 'This month',
  extra: '',
  [TURNSTILE_FIELD]: 'token-ok',
};

function formBody(fields: Record<string, string | string[]>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) for (const one of [v].flat()) p.append(k, one);
  return p.toString();
}

/** A fetch stand-in for siteverify; records what it was sent. */
function siteverify(success: boolean | 'throw' | 500) {
  const calls: { url: string; body: URLSearchParams }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), body: new URLSearchParams(init.body as URLSearchParams) });
    if (success === 'throw') throw new Error('network down');
    if (success === 500) return new Response('oops', { status: 500 });
    return Response.json({ success });
  }) as typeof fetch;
  return { impl, calls };
}

function recorder(fail = false) {
  const sent: IntakeMessage[] = [];
  const transport: Transport = async (m) => {
    if (fail) throw new Error('mailer down');
    sent.push(m);
  };
  return { sent, transport };
}

const run = (body: string, opts: { type?: string; verify?: ReturnType<typeof siteverify>; fail?: boolean } = {}) => {
  const verify = opts.verify ?? siteverify(true);
  const rec = recorder(opts.fail);
  return processIntake({
    contentType: opts.type ?? 'application/x-www-form-urlencoded',
    body,
    remoteip: '203.0.113.7',
    idempotencyKey: 'idem-1',
    turnstileSecret: SECRET,
    transport: rec.transport,
    fetchImpl: verify.impl,
    now: new Date('2026-10-30T12:00:00Z'),
  }).then((outcome) => ({ outcome, sent: rec.sent, verify }));
};

describe('parsing', () => {
  test('form-encoded posts keep repeated keys as lists', () => {
    const raw = parseBody('application/x-www-form-urlencoded; charset=UTF-8', formBody(valid))!;
    assert.deepEqual(raw.get('tools'), ['Zapier', 'HubSpot']);
    assert.deepEqual(raw.get('name'), ['Sam Rivera']);
  });

  test('JSON posts accept strings and string arrays only', () => {
    assert.deepEqual(parseBody('application/json', JSON.stringify(valid))!.get('tools'), ['Zapier', 'HubSpot']);
    assert.equal(parseBody('application/json', JSON.stringify({ name: { nested: true } })), null);
    assert.equal(parseBody('application/json', JSON.stringify(['a'])), null);
    assert.equal(parseBody('application/json', '{not json'), null);
  });

  test('other content types are refused', () => {
    assert.equal(parseBody('multipart/form-data; boundary=x', 'x'), null);
    assert.equal(parseBody('text/plain', 'name=a'), null);
  });
});

describe('validation', () => {
  const v = (fields: Record<string, string | string[]>) =>
    validate(parseBody('application/x-www-form-urlencoded', formBody(fields))!);

  test('a complete request passes', () => {
    const r = v(valid);
    assert.equal(r.ok, true);
  });

  test('every required field reports required', () => {
    const r = v({});
    assert.deepEqual(r, {
      ok: false,
      fields: { name: 'required', email: 'required', business: 'required', tools: 'required', problem: 'required' },
    });
  });

  test('a bad email reports email, not required', () => {
    for (const email of ['sam', 'sam@', 'sam@example', 'a b@example.com', 'sam@example.com\nBcc: x@y.z']) {
      const r = v({ ...valid, email });
      assert.deepEqual('fields' in r && r.fields, { email: 'email' }, email);
    }
    assert.equal(isEmail('sam.rivera+ops@harbor-plumbing.co'), true);
  });

  test('the "Other" text satisfies the tools question on its own', () => {
    const { tools, ...rest } = valid;
    assert.equal(v({ ...rest, tools_other: 'Calendly' }).ok, true);
  });

  test('values outside the offered options are refused', () => {
    assert.deepEqual(v({ ...valid, tools: ['Zapier', 'Salesforce'] }), { ok: false, error: 'bad_request' });
    assert.deepEqual(v({ ...valid, noticed: 'Yesterday' }), { ok: false, error: 'bad_request' });
  });

  test('a single-value field sent twice is refused', () => {
    assert.deepEqual(v({ ...valid, name: ['a', 'b'] }), { ok: false, error: 'bad_request' });
  });

  test('over-long fields are refused as too large', () => {
    assert.deepEqual(v({ ...valid, problem: 'x'.repeat(LIMITS.problem + 1) }), { ok: false, error: 'too_large' });
    assert.deepEqual(v({ ...valid, name: 'x'.repeat(LIMITS.name + 1) }), { ok: false, error: 'too_large' });
  });

  test('single-line fields lose newlines and control characters; duplicates collapse', () => {
    const r = v({ ...valid, business: 'Harbor\r\nBcc: x@y.z\u0007', tools: ['Zapier', 'Zapier'] });
    assert.ok(r.ok);
    assert.equal(r.value.business, 'Harbor Bcc: x@y.z');
    assert.deepEqual(r.value.tools, ['Zapier']);
  });
});

describe('the whole flow', () => {
  test('a valid request is verified and handed to the transport once', async () => {
    const { outcome, sent, verify } = await run(formBody(valid));
    assert.deepEqual(outcome, { kind: 'sent' });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].replyTo, 'sam@example.com');
    assert.equal(sent[0].subject, 'Diagnostic request: Harbor Plumbing');
    assert.match(sent[0].text, /Tools: Zapier, HubSpot/);
    assert.equal(verify.calls.length, 1);
    const call = verify.calls[0];
    assert.equal(call.url, SITEVERIFY_URL);
    assert.equal(call.body.get('secret'), SECRET);
    assert.equal(call.body.get('response'), 'token-ok');
    assert.equal(call.body.get('remoteip'), '203.0.113.7');
    assert.equal(call.body.get('idempotency_key'), 'idem-1');
  });

  test('JSON posts take the same path', async () => {
    const { outcome } = await run(JSON.stringify(valid), { type: 'application/json' });
    assert.deepEqual(outcome, { kind: 'sent' });
  });

  test('honeypot: answers like a success, sends nothing, skips siteverify', async () => {
    const { outcome, sent, verify } = await run(formBody({ ...valid, [HONEYPOT_FIELD]: 'https://spam.example' }));
    assert.deepEqual(outcome, { kind: 'dropped' });
    assert.equal(sent.length, 0);
    assert.equal(verify.calls.length, 0);
    assert.deepEqual(jsonFor(outcome), { ok: true });
    assert.equal(redirectFor(outcome), '/diagnostic/thanks/');
  });

  test('oversize body: refused before parsing', async () => {
    const { outcome, sent } = await run('x'.repeat(MAX_BODY_BYTES + 1));
    assert.deepEqual(outcome, { kind: 'error', error: 'too_large' });
    assert.equal(sent.length, 0);
    assert.equal(statusFor(outcome), 413);
  });

  test('Turnstile failure → the spam state, nothing sent', async () => {
    for (const verdict of [false, 'throw', 500] as const) {
      const { outcome, sent } = await run(formBody(valid), { verify: siteverify(verdict) });
      assert.deepEqual(outcome, { kind: 'error', error: 'spam' }, String(verdict));
      assert.equal(sent.length, 0);
    }
  });

  test('missing token or secret → spam without calling siteverify', async () => {
    const { [TURNSTILE_FIELD]: _token, ...noToken } = valid;
    const a = await run(formBody(noToken));
    assert.deepEqual(a.outcome, { kind: 'error', error: 'spam' });
    assert.equal(a.verify.calls.length, 0);

    const verify = siteverify(true);
    const b = await processIntake({
      contentType: 'application/x-www-form-urlencoded',
      body: formBody(valid),
      transport: recorder().transport,
      fetchImpl: verify.impl,
    });
    assert.deepEqual(b, { kind: 'error', error: 'spam' });
    assert.equal(verify.calls.length, 0);
  });

  test('invalid fields are reported before siteverify is spent', async () => {
    const { outcome, verify } = await run(formBody({ ...valid, email: 'nope' }));
    assert.deepEqual(outcome, { kind: 'invalid', fields: { email: 'email' } });
    assert.equal(verify.calls.length, 0);
    assert.equal(statusFor(outcome), 422);
  });

  test("transport failure → the deck's send error state", async () => {
    const { outcome } = await run(formBody(valid), { fail: true });
    assert.deepEqual(outcome, { kind: 'error', error: 'send' });
    assert.deepEqual(jsonFor(outcome), { ok: false, error: 'send' });
    assert.equal(statusFor(outcome), 502);
    assert.equal(redirectFor(outcome), '/diagnostic/?error=send#diagnostic');
  });
});

describe('message', () => {
  test('plain text with every field, subject capped', () => {
    const r = validate(parseBody('application/x-www-form-urlencoded', formBody({ ...valid, tools_other: 'Calendly' }))!);
    assert.ok(r.ok);
    const m = formatMessage({ ...r.value, business: 'B'.repeat(400) }, new Date('2026-10-30T12:00:00Z'));
    assert.equal(m.subject.length, 160);
    assert.match(m.text, /Tools: Zapier, HubSpot, Other: Calendly/);
    assert.match(m.text, /First noticed: This month/);
    assert.match(m.text, /Anything else: \(not given\)/);
    assert.match(m.text, /Received: 2026-10-30T12:00:00.000Z/);
  });
});

describe('HTTP handler', () => {
  const post = (body: string, headers: Record<string, string>) =>
    new Request(`${ORIGIN}/api/diagnostic`, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: ORIGIN, ...headers },
    });
  const deps = (fail = false) => ({
    turnstileSecret: SECRET,
    transport: recorder(fail).transport,
    fetchImpl: siteverify(true).impl,
  });

  test('script clients get JSON', async () => {
    const res = await handleIntake(post(formBody(valid), { Accept: 'application/json' }), deps());
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await res.json(), { ok: true });
  });

  test('no-JS posts get a 303 to the thanks page', async () => {
    const res = await handleIntake(post(formBody(valid), { Accept: 'text/html' }), deps());
    assert.equal(res.status, 303);
    assert.equal(res.headers.get('Location'), `${ORIGIN}/diagnostic/thanks/`);
  });

  test('no-JS invalid posts go back to the form with codes only, never the input', async () => {
    const marker = '<script>alert(1)</script>';
    const res = await handleIntake(post(formBody({ ...valid, email: marker }), { Accept: 'text/html' }), deps());
    assert.equal(res.status, 303);
    const loc = res.headers.get('Location')!;
    assert.equal(loc, `${ORIGIN}/diagnostic/?error=fields&fields=email.email#diagnostic`);
    assert.ok(!loc.includes('script') && !loc.includes('alert'));
  });

  test('JSON error bodies never echo input', async () => {
    const marker = 'UNIQUE-MARKER-123';
    const res = await handleIntake(
      post(formBody({ ...valid, email: marker, name: marker }), { Accept: 'application/json' }),
      deps(),
    );
    const text = await res.text();
    assert.equal(res.status, 422);
    assert.ok(!text.includes(marker));
  });

  test('no-JS transport failure redirects to the send error', async () => {
    const res = await handleIntake(post(formBody(valid), {}), deps(true));
    assert.equal(res.headers.get('Location'), `${ORIGIN}/diagnostic/?error=send#diagnostic`);
  });

  test('NOJS_FALLBACK: off by default, a tokenless no-JS post gets the spam state', async () => {
    const { [TURNSTILE_FIELD]: _t, ...noToken } = valid;
    const res = await handleIntake(post(formBody(noToken), { Accept: 'text/html' }), deps());
    assert.equal(res.headers.get('Location'), `${ORIGIN}/diagnostic/?error=spam#diagnostic`);
  });

  test('NOJS_FALLBACK on: a tokenless no-JS post is sent, marked unverified', async () => {
    const { [TURNSTILE_FIELD]: _t, ...noToken } = valid;
    const rec = recorder();
    const verify = siteverify(true);
    const res = await handleIntake(post(formBody(noToken), { Accept: 'text/html' }), {
      turnstileSecret: SECRET,
      noJsFallback: true,
      transport: rec.transport,
      fetchImpl: verify.impl,
    });
    assert.equal(res.headers.get('Location'), `${ORIGIN}/diagnostic/thanks/`);
    assert.equal(verify.calls.length, 0);
    assert.equal(rec.sent.length, 1);
    assert.ok(rec.sent[0].subject.startsWith(UNVERIFIED_PREFIX));
    assert.match(rec.sent[0].text, /Spam check: none/);
  });

  test('NOJS_FALLBACK never covers JSON clients or a failing token', async () => {
    const { [TURNSTILE_FIELD]: _t, ...noToken } = valid;
    const on = { ...deps(), noJsFallback: true };
    const json = await handleIntake(post(formBody(noToken), { Accept: 'application/json' }), on);
    assert.deepEqual(await json.json(), { ok: false, error: 'spam' });
    const bad = await handleIntake(post(formBody(valid), { Accept: 'text/html' }), {
      ...on,
      fetchImpl: siteverify(false).impl,
    });
    assert.equal(bad.headers.get('Location'), `${ORIGIN}/diagnostic/?error=spam#diagnostic`);
  });

  test('cross-site posts are refused', async () => {
    const res = await handleIntake(
      post(formBody(valid), { Origin: 'https://evil.example', Accept: 'application/json' }),
      deps(),
    );
    assert.equal(res.status, 400);
  });

  test('a declared oversize body is refused without reading it', async () => {
    const req = post('x', { Accept: 'application/json', 'Content-Length': String(MAX_BODY_BYTES + 1) });
    const res = await handleIntake(req, deps());
    assert.equal(res.status, 413);
  });

  test('only POST is allowed', async () => {
    const res = await handleIntake(new Request(`${ORIGIN}/api/diagnostic`), deps());
    assert.equal(res.status, 405);
    assert.equal(res.headers.get('Allow'), 'POST');
  });
});

describe('body reader', () => {
  const stream = (chunks: number[]) =>
    new ReadableStream<Uint8Array>({
      start(c) {
        for (const n of chunks) c.enqueue(new Uint8Array(n).fill(97));
        c.close();
      },
    });

  test('reads bodies up to the cap and stops past it', async () => {
    assert.equal((await readBodyLimited(stream([10, 10]), 20))!.length, 20);
    assert.equal(await readBodyLimited(stream([10, 11]), 20), null);
    assert.equal(await readBodyLimited(null), '');
  });
});

describe('error query', () => {
  test('only known codes survive', () => {
    const q = new URLSearchParams('error=<b>x</b>&fields=email.email,name.required,evil.required,name.<script>');
    assert.deepEqual(errorsFromQuery(q), { form: null, fields: { email: 'email', name: 'required' } });
    assert.deepEqual(errorsFromQuery(new URLSearchParams('error=spam')), { form: 'spam', fields: {} });
  });
});
