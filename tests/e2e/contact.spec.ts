import { expect, test, type Page } from '@playwright/test';
import { handleIntake, fieldsFromForm, validate, LIMITS, TOOL_OPTIONS, NOTICED_OPTIONS } from '../../src/lib/intake';
import { noConsoleErrors, noOverflow } from './helpers';

// Keep fixed shell controls out of the contact section's visual baselines. Playwright's
// `style` screenshot option is a no-op in this version, and an element screenshot of a tall
// section repaints fixed elements at a scroll-dependent offset, so inject a real style tag.
// The landing nav is fixed too: once the section is taller than the viewport its bar painted
// into the capture at a different offset per run, which made the retry baseline flaky.
const HIDE_SKIP = 'body > .skip, [id="01-nav"] { visibility: hidden !important; }';
const section = (page: Page) => page.locator('[data-island="contact"]');
const send = (page: Page) => section(page).getByRole('button', { name: 'Send my request' });

async function open(page: Page) {
  await page.goto('/');
  await page.addStyleTag({ content: HIDE_SKIP });
  await section(page).scrollIntoViewIfNeeded();
  await expect(section(page)).toHaveAttribute('data-step', 'well');
  await page.evaluate(() => document.fonts.ready);
}
async function expand(page: Page) {
  await section(page).getByPlaceholder('Work email', { exact: true }).fill('owner@example.com');
  await section(page).getByPlaceholder('Work email', { exact: true }).press('Enter');
  await expect(page.locator('#contact-name')).toBeFocused();
  await expect(page.locator('#contact-email')).toHaveValue('owner@example.com');
  await expect.poll(() => page.evaluate(() => (window as any).__contactWidget?.renders ?? 0)).toBe(1);
}
async function qualify(page: Page) {
  await page.locator('#contact-business').fill('Example Studio');
  await section(page).getByRole('checkbox', { name: 'Zapier', exact: true }).check();
  await section(page).getByRole('checkbox', { name: 'HubSpot', exact: true }).check();
  await page.locator('#contact-problem').fill('Bookings should reach the CRM. Some records never arrive.');
}

// Every request is intercepted before navigation, including native no-JS submissions.
// Real intake parsing/validation runs in Node; verification and mail transport stay local.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/diagnostic', async (route) => {
    const request = route.request();
    const response = await handleIntake(new Request(request.url(), {
      method: request.method(), headers: request.headers(), body: request.postData(),
    }), {
      turnstileSecret: 'fixture-secret', noJsFallback: true,
      fetchImpl: async () => Response.json({ success: true }),
      transport: async () => {},
    });
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
  });
  await page.route('https://challenges.cloudflare.com/**', async (route) => {
    if (!route.request().url().includes('/turnstile/v0/api.js')) return route.abort();
    await route.fulfill({ contentType: 'application/javascript', body: `
      window.__contactWidget = { renders: 0, resets: 0, token: 'fixture-token', options: null };
      window.turnstile = {
        render(slot, options) {
          const state = window.__contactWidget;
          state.renders++; state.options = options;
          const label = document.createElement('p'); label.textContent = 'Spam check ready';
          label.style.cssText = 'font-size:14px;min-height:52px;display:flex;align-items:center';
          slot.append(label);
          options.callback?.('fixture-token');
          return 'contact-fixture';
        },
        getResponse() { return window.__contactWidget.token; },
        reset() { const s = window.__contactWidget; s.resets++; s.token = 'fixture-token'; s.options.callback?.(s.token); }
      };
    ` });
  });
});

test.describe('@contact', () => {
  test('email first, validation, keyboard, optional name and genuine success', async ({ page }) => {
    const console = noConsoleErrors(page);
    const payloads: URLSearchParams[] = [];
    page.on('request', (request) => { if (new URL(request.url()).pathname === '/api/diagnostic') payloads.push(new URLSearchParams(request.postData() ?? '')); });
    await open(page);
    expect(await page.evaluate(() => (window as any).__contactWidget)).toBeUndefined();
    await expect(section(page)).toHaveScreenshot('contact-initial.png');
    await noOverflow(page);
    const start = page.locator('#contact-start-email');
    await start.fill('invalid');
    await start.press('Enter');
    await expect(start).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#contact-start-error')).toHaveText(/email doesn't look right/);
    expect(payloads).toHaveLength(0);
    await expand(page);
    await expect(section(page)).toHaveScreenshot('contact-expanded.png');
    await noOverflow(page);
    await send(page).click();
    await expect(page.locator('#contact-business')).toBeFocused();
    await expect(page.locator('#contact-business')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#contact-business')).toHaveAttribute('aria-describedby', 'contact-business-error');
    await expect(page.locator('#contact-tools-error')).toBeVisible();
    await expect(section(page)).toHaveScreenshot('contact-validation.png');
    expect(payloads).toHaveLength(0);
    await qualify(page);
    await expect(page.locator('#contact-business-error')).toBeHidden();
    await expect(page.locator('#contact-tools-error')).toBeHidden();
    await page.locator('#contact-tools-other').fill('Scheduling app');
    await section(page).getByRole('radio', { name: 'This week', exact: true }).check();
    await page.locator('#contact-extra').fill('Started after a settings change.');
    // Native tab order reaches both checkbox and radio controls.
    await page.locator('#contact-business').focus();
    await page.keyboard.press('Tab');
    await expect(section(page).getByRole('checkbox', { name: 'Zapier', exact: true })).toBeFocused();
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    await page.locator('#contact-extra').press('Enter');
    await expect(section(page).locator('[data-confirm]')).toBeVisible();
    await expect(section(page).locator('[data-confirm]')).toBeFocused();
    expect(payloads).toHaveLength(1);
    const payload = payloads[0];
    expect(payload.get('name')).toBe('(not provided)');
    expect(payload.get('email')).toBe('owner@example.com');
    expect(payload.getAll('tools')).toEqual(['Zapier', 'HubSpot']);
    expect(payload.get('tools_other')).toBe('Scheduling app');
    expect(payload.get('noticed')).toBe('This week');
    expect(payload.get('extra')).toBe('Started after a settings change.');
    expect(payload.get('company_website')).toBe('');
    expect(payload.get('cf-turnstile-response')).toBe('fixture-token');
    expect(validate(fieldsFromForm(payload)).ok).toBe(true);
    const blank = new URLSearchParams(payload); blank.set('name', '');
    expect(validate(fieldsFromForm(blank))).toEqual({ ok: false, fields: { name: 'required' } });
    await expect(section(page)).toHaveScreenshot('contact-success.png');
    await noOverflow(page);
    await section(page).getByText('How we handle this', { exact: true }).click();
    await expect(section(page).getByText('90 days', { exact: false })).toBeVisible();
    console.assertNone();
  });

  test('failed send, busy state, retry, name and URL-encoded contract', async ({ page }) => {
    const console = noConsoleErrors(page);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let attempts = 0;
    await page.route('**/api/diagnostic', async (route) => {
      attempts++;
      expect(route.request().headers().accept).toBe('application/json');
      expect(route.request().headers()['content-type']).toContain('application/x-www-form-urlencoded');
      const params = new URLSearchParams(route.request().postData()!);
      expect(params.get('name')).toBe('Alex');
      expect(validate(fieldsFromForm(params)).ok).toBe(true);
      if (attempts === 1) { await gate; await route.fulfill({ json: { ok: false, error: 'send' } }); }
      else await route.fallback();
    });
    await open(page); await expand(page); await qualify(page);
    await page.locator('#contact-name').fill('Alex');
    await send(page).click();
    await expect(section(page).locator('[data-send]')).toBeDisabled();
    await expect(section(page).locator('form[data-contact-form]')).toHaveAttribute('aria-busy', 'true');
    await expect(section(page).locator('[data-confirm]')).toBeHidden();
    release();
    await expect(section(page).locator('[data-form-error="send"]')).toBeVisible();
    await expect(send(page)).toBeEnabled();
    await expect(section(page)).toHaveScreenshot('contact-retry.png');
    await noOverflow(page);
    expect(await page.evaluate(() => (window as any).__contactWidget.resets)).toBe(1);
    await send(page).click();
    await expect(section(page).locator('[data-confirm]')).toBeVisible();
    expect(attempts).toBe(2);
    console.assertNone();
  });

  test('reduced motion, limits, choices, expiry and widget errors', async ({ page }) => {
    const console = noConsoleErrors(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page); await expand(page);
    // The reduced-motion guard collapses every transition to 0.01ms, but a collapsed transition
    // still reports playState "running" for a frame, so assert the compressed duration, not a
    // zero count (a count is racy: expand touches width, border and focus transitions).
    const durations = await section(page).evaluate((el) =>
      el.getAnimations({ subtree: true }).map((a) => Number(a.effect?.getTiming().duration ?? 0)),
    );
    expect(Math.max(0, ...durations)).toBeLessThanOrEqual(1);
    for (const [name, limit] of [['name', LIMITS.name], ['email', LIMITS.email], ['business', LIMITS.business], ['tools_other', LIMITS.toolsOther], ['problem', LIMITS.problem], ['extra', LIMITS.extra]] as const) {
      await expect(section(page).locator(`[name="${name}"]`)).toHaveAttribute('maxlength', String(limit));
    }
    expect(await section(page).locator('[name="tools"]').evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value))).toEqual(TOOL_OPTIONS);
    expect(await section(page).locator('[name="noticed"]').evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value))).toEqual(NOTICED_OPTIONS);
    await page.evaluate(() => (window as any).__contactWidget.options['expired-callback']());
    expect(await page.evaluate(() => (window as any).__contactWidget.resets)).toBe(1);
    await page.evaluate(() => (window as any).__contactWidget.options['error-callback']());
    await expect(section(page).locator('[data-form-error="spam"]')).toBeVisible();
    await qualify(page);
    await send(page).click();
    await expect(section(page).locator('[data-confirm]')).toBeHidden();
    await expect(send(page)).toBeEnabled();
    await send(page).click();
    await expect(section(page).locator('[data-confirm]')).toBeVisible();
    await noOverflow(page);
    console.assertNone();
  });

  test('missing production key fails closed', async ({ page }) => {
    const console = noConsoleErrors(page);
    await page.goto('/');
    // Emulate a production build without its configured key (read when the widget is first needed).
    await section(page).locator('[data-contact-form]').evaluate((el) => { (el as HTMLElement).dataset.siteKey = ''; });
    await section(page).scrollIntoViewIfNeeded();
    await expect(section(page)).toHaveAttribute('data-step', 'well');
    await page.locator('#contact-start-email').fill('owner@example.com');
    await page.locator('#contact-start-email').press('Enter');
    await qualify(page);
    let requests = 0;
    await page.route('**/api/diagnostic', (route) => { requests++; return route.abort(); });
    await send(page).click();
    await expect(section(page).locator('[data-form-error="spam"]')).toBeVisible();
    expect(requests).toBe(0);
    expect(await page.evaluate(() => (window as any).__contactWidget)).toBeUndefined();
    console.assertNone();
  });

  test('server validation, malformed replies and unsuccessful responses never confirm', async ({ page }) => {
    const console = noConsoleErrors(page);
    let attempt = 0;
    await page.route('**/api/diagnostic', async (route) => {
      attempt++;
      if (attempt === 1) await route.fulfill({ json: { ok: false, fields: { email: 'email' } } });
      else if (attempt === 2) await route.fulfill({ contentType: 'application/json', body: '{' });
      else if (attempt === 3) await route.fulfill({ status: 300, json: { ok: true } });
      else await route.fallback();
    });
    await open(page); await expand(page); await qualify(page);
    await send(page).click();
    await expect(page.locator('#contact-email')).toBeFocused();
    await expect(page.locator('#contact-email')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#contact-email-error')).toBeVisible();
    for (let i = 0; i < 2; i++) {
      await send(page).click();
      await expect(section(page).locator('[data-form-error="send"]')).toBeVisible();
      await expect(section(page).locator('[data-confirm]')).toBeHidden();
      await expect(send(page)).toBeEnabled();
    }
    await send(page).click();
    await expect(section(page).locator('[data-confirm]')).toBeVisible();
    expect(attempt).toBe(4);
    console.assertNone();
  });

  test('spam script unavailable can retry without a real widget request', async ({ page }) => {
    const console = noConsoleErrors(page);
    let loads = 0;
    await page.route('https://challenges.cloudflare.com/**', async (route) => {
      loads++;
      if (loads === 1) await route.fulfill({ contentType: 'application/javascript', body: '' });
      else await route.fallback();
    });
    await open(page);
    await page.locator('#contact-start-email').fill('owner@example.com');
    await page.locator('#contact-start-email').press('Enter');
    await expect(section(page).locator('[data-form-error="spam"]')).toBeVisible();
    await qualify(page);
    await send(page).click();
    await expect(section(page).locator('[data-confirm]')).toBeVisible();
    expect(loads).toBe(2);
    console.assertNone();
  });

  test('native no-JS full form posts the omission marker to the existing endpoint', async ({ page }) => {
    const context = await page.context().browser()!.newContext({ javaScriptEnabled: false, viewport: page.viewportSize()! });
    const native = await context.newPage();
    const console = noConsoleErrors(native);
    try {
      let payload: URLSearchParams | undefined;
      await native.route('https://challenges.cloudflare.com/**', (route) => route.abort());
      await native.route('**/api/diagnostic', async (route) => {
        payload = new URLSearchParams(route.request().postData()!);
        const response = await handleIntake(new Request(route.request().url(), {
          method: 'POST', headers: route.request().headers(), body: route.request().postData(),
        }), { noJsFallback: true, transport: async () => {} });
        expect(response.status).toBe(303);
        expect(response.headers.get('location')).toContain('/diagnostic/thanks/');
        await route.fulfill({ contentType: 'text/html', body: '<p>Native request accepted by local fixture</p>' });
      });
      // The suite's own preview server; a fresh context does not inherit the page baseURL.
      await native.goto(test.info().project.use.baseURL ?? 'http://localhost:4321/');
      await expect(native.locator('#contact-email')).toBeVisible();
      await native.locator('#contact-email').fill('owner@example.com');
      await qualify(native);
      await send(native).click();
      await expect(native.getByText('Native request accepted by local fixture')).toBeVisible();
      expect(payload!.get('name')).toBe('(not provided)');
      expect(validate(fieldsFromForm(payload!)).ok).toBe(true);
      console.assertNone();
    } finally { await context.close(); }
  });
});
