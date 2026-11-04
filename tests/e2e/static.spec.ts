import { expect, test, type Page } from '@playwright/test';
import { noConsoleErrors, reducedMotion } from './helpers';

// Tools strip, FAQ and footer (one card owns the three). Section ids are the contract and start
// with a digit, so they are selected by attribute.
const TOOLS = '[id="03-tools-strip"]';
const FAQ = '[id="07-faq"]';
const FOOTER = '[id="09-footer"]';

/**
 * The shared `noOverflow` helper scans every element's right edge, and that can never pass on this
 * page: the tools strip is a marquee, so its row is deliberately wider than the viewport and is
 * clipped by `.tools-track`. The acceptance is "no horizontal overflow", i.e. the page cannot be
 * scrolled sideways, so assert exactly that against the document and the body.
 */
async function noPageOverflow(page: Page): Promise<void> {
  const report = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    viewport: window.innerWidth,
  }));

  expect(report.document, `document scrollWidth ${report.document} > viewport ${report.viewport}`).toBeLessThanOrEqual(
    report.viewport + 1,
  );
  expect(report.body, `body scrollWidth ${report.body} > viewport ${report.viewport}`).toBeLessThanOrEqual(
    report.viewport + 1,
  );
}

test.describe('@static', () => {
  test('@static tools strip: one drifting row, no overflow, clean console', async ({ page }) => {
    const consoleErrors = noConsoleErrors(page);

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));

    const tools = page.locator(TOOLS);
    await tools.scrollIntoViewIfNeeded();

    // Eleven tool names, printed twice so the loop has no seam.
    await expect(tools.locator('.tools-list')).toHaveCount(2);
    await expect(tools.locator('.tools-list').first().locator('li')).toHaveCount(11);
    await expect(tools.locator('.tools-list').nth(1)).toHaveAttribute('aria-hidden', 'true');

    await expect(tools).toHaveScreenshot('tools-strip.png');

    await noPageOverflow(page);

    consoleErrors.assertNone();
  });

  test('@static faq: nine questions, first open, one opened by input', async ({ page }) => {
    const consoleErrors = noConsoleErrors(page);

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));

    const faq = page.locator(FAQ);
    await faq.scrollIntoViewIfNeeded();

    const items = faq.locator('details.fq');
    await expect(items).toHaveCount(9);

    // Every answer is in the markup; the island closes all but the first.
    await expect(items.first()).toHaveAttribute('open', '');
    await expect(items.nth(1)).not.toHaveAttribute('open', '');

    await expect(faq).toHaveScreenshot('faq.png');

    // Open a closed item with real input, then close the first one.
    await items.nth(2).locator('summary').click();
    await expect(items.nth(2)).toHaveAttribute('open', '');
    await expect(faq).toHaveScreenshot('faq-open.png');

    await items.first().locator('summary').click();
    await expect(items.first()).not.toHaveAttribute('open', '');

    await noPageOverflow(page);
    consoleErrors.assertNone();
  });

  test('@static footer: two lines, inert off-page links, no overflow', async ({ page }) => {
    const consoleErrors = noConsoleErrors(page);

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));

    const footer = page.locator(FOOTER);
    await footer.scrollIntoViewIfNeeded();

    await expect(footer.locator('.ft-nav li')).toHaveCount(6);
    await expect(footer.locator('.ft-mail a')).toHaveAttribute('href', 'mailto:hello@apelabs.dev');
    await expect(footer.locator('.ft-logo')).toHaveAttribute('href', '#top');

    // Privacy links to its page; Blog and GitHub lead off this page: shown, but never dead links.
    await expect(footer.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy/');
    const inert = footer.locator('.is-inert');
    await expect(inert).toHaveCount(2);
    const inertHrefs = await inert.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('href')),
    );
    expect(inertHrefs).toEqual([null, null]);

    await expect(footer).toHaveScreenshot('footer.png');

    await noPageOverflow(page);
    consoleErrors.assertNone();
  });

  test('@static reduced motion: the row holds still and the answers still disclose', async ({ page }) => {
    await reducedMotion(page);

    await page.goto('/', { waitUntil: 'networkidle' });

    const run = page.locator(`${TOOLS} .tools-run`);
    await expect(run).toHaveCSS('animation-name', 'none');

    const items = page.locator(`${FAQ} details.fq`);
    await expect(items).toHaveCount(9);
    await expect(items.first()).toHaveAttribute('open', '');

    await items.nth(3).locator('summary').click();
    await expect(items.nth(3)).toHaveAttribute('open', '');
  });
});
