import { expect, test } from '@playwright/test';
import { noConsoleErrors, noOverflow, reducedMotion } from './helpers';

// The nine landing blocks, in the deck's document order (ids are the section contract).
const SECTIONS = [
  '01-nav',
  '02-hero',
  '03-tools-strip',
  '04-journey',
  '05-services',
  '06-proof',
  '07-faq',
  '08-contact',
  '09-footer',
] as const;

test.describe('@shell', () => {
  test('landing shell: nine sections in order, no overflow, clean console', async ({ page }) => {
    const consoleErrors = noConsoleErrors(page);
    // The full-page baseline needs the static layout: with motion on, the hero and journey pinning
    // change the document height between captures. Their motion paths are covered by their own specs.
    await reducedMotion(page);

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    // networkidle and fonts.ready leave offscreen loading="lazy" images unrequested, and the fullPage
    // capture's viewport resize only sometimes triggers them, so a photo could land in the baseline
    // on one run and its card fallback on the next. Force every image eager in this test's DOM (the
    // shipped markup stays lazy) and wait until each one is decoded; a broken asset fails here.
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.images, (img) => {
          img.loading = 'eager';
          return img.decode().catch(() => {
            throw new Error(`image failed to load or decode: ${img.currentSrc || img.src}`);
          });
        }),
      ).then(() => undefined),
    );

    for (const id of SECTIONS) {
      await expect(page.locator(`[id="${id}"]`), `missing section #${id}`).toHaveCount(1);
    }

    const inOrder = await page.evaluate((ids) => {
      const elements = ids.map((id) => document.getElementById(id));
      return elements.every((element, index) => {
        if (!element) return false;
        if (index === 0) return true;
        const previous = elements[index - 1];
        return (
          previous !== null &&
          (previous.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
        );
      });
    }, SECTIONS);

    expect(inOrder, 'sections are not in the deck order').toBe(true);
    await expect(page.locator('h1')).toHaveCount(1);

    await noOverflow(page);

    await expect(page).toHaveScreenshot('landing-shell.png', { fullPage: true });

    consoleErrors.assertNone();
  });
});
