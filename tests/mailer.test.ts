// Unit tests for the intake-mailer Worker's pure message builder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_TEXT, buildEmail, parsePayload } from '../workers/intake-mailer/src/message.ts';

const addr = { from: 'intake@apelabs.dev', fromName: 'apeLabs intake', to: 'hello@apelabs.dev' };
const good = { subject: 'Diagnostic request: Harbor Plumbing', text: 'Name: Sam\nEmail: sam@example.com', replyTo: 'sam@example.com' };

test('a well-formed payload becomes one plain-text email with Reply-To', () => {
  const p = parsePayload(good)!;
  assert.deepEqual(buildEmail(p, addr), {
    from: { email: 'intake@apelabs.dev', name: 'apeLabs intake' },
    to: 'hello@apelabs.dev',
    replyTo: 'sam@example.com',
    subject: good.subject,
    text: good.text,
  });
});

test('header injection and malformed payloads are refused', () => {
  assert.equal(parsePayload({ ...good, subject: 'Hi\r\nBcc: x@y.z' }), null);
  assert.equal(parsePayload({ ...good, replyTo: 'sam@example.com\nBcc: x@y.z' }), null);
  assert.equal(parsePayload({ ...good, text: 'x'.repeat(MAX_TEXT + 1) }), null);
  assert.equal(parsePayload({ ...good, subject: '' }), null);
  assert.equal(parsePayload({ subject: 1, text: 'a', replyTo: 'b' }), null);
  assert.equal(parsePayload(null), null);
  assert.equal(parsePayload([good]), null);
});

test('a Reply-To that is not a plain ASCII address is left out', () => {
  const e = buildEmail(parsePayload({ ...good, replyTo: 'sām@exämple.com' })!, addr);
  assert.equal('replyTo' in e, false);
});
