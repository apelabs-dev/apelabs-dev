import { expect, test, type Page } from '@playwright/test';
import { noConsoleErrors, reducedMotion } from './helpers';

const SECTION = '[id="06-proof"]';
const CHIP_LABELS = ['The problem', 'What we built', 'Key features', "Who it's for"];

interface SparkState {
  speed: number;
  rails: Array<{ spans: Array<{ a: number; b: number }> }>;
}

/** Wait for fonts and every image the section renders (the phone-only crop stays lazy behind display: none). */
async function assetsReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const images = Array.from(document.querySelectorAll<HTMLImageElement>('[id="06-proof"] img'));
    for (const img of images) {
      if (img.complete) continue;
      img.loading = 'eager';
      const src = img.src;
      img.src = src;
    }
    await Promise.race([
      Promise.all(
        images.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener('load', () => resolve(), { once: true });
                img.addEventListener('error', () => resolve(), { once: true });
              }),
        ),
      ),
      new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
    ]);
  });
}

/** Scroll the section into view and wait for its island to mount. */
async function mountSection(page: Page): Promise<void> {
  await page.locator(SECTION).scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const root = document.querySelector('[data-island="proof"]');
    return (
      root?.getAttribute('data-proof-mounted') === 'true' &&
      Boolean((window as unknown as { __proofSpark?: unknown }).__proofSpark)
    );
  });
}

/** Split a computed colour into sRGB channels (handles rgb() and color(srgb …)). */
function channels(value: string): number[] {
  const nums = (value.match(/[\d.]+/g) ?? []).map(Number).slice(0, 3);
  return value.startsWith('color(') ? nums.map((n) => Math.round(n * 255)) : nums.map(Math.round);
}

test.describe('@proof', () => {
  test('@proof both rows, spark on card 2 lit', async ({ page }) => {
    const consoleErrors = noConsoleErrors(page);

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: '.skip { display: none !important; }' });
    await mountSection(page);
    await assetsReady(page);

    const section = page.locator(SECTION);
    await expect(section).toHaveCount(1);

    const rows = section.locator('article.pr3-a');
    await expect(rows).toHaveCount(2);
    expect(await rows.evaluateAll((elements) => elements.map((el) => el.getAttribute('data-key')))).toEqual([
      'sur9e',
      'hf',
    ]);

    for (let row = 0; row < 2; row += 1) {
      const facts = rows.nth(row).locator('.pf-fact');
      await expect(facts).toHaveCount(4);
      expect(await facts.locator('dt .pf-l').allTextContents()).toEqual(CHIP_LABELS);
    }

    const claims = section.locator('.pf-fact dd');
    await expect(claims).toHaveCount(8);
    const allClaimsVisible = await claims.evaluateAll((elements) =>
      elements.every(
        (el) =>
          (el as HTMLElement).checkVisibility({ checkVisibilityCSS: true, checkOpacity: true }) &&
          (el.textContent ?? '').trim().length > 0,
      ),
    );
    expect(allClaimsVisible).toBe(true);

    await expect(section.locator('[hidden], [aria-expanded], details, [title]')).toHaveCount(0);

    const lit = await page.evaluate(() => {
      const controller = (window as unknown as { __proofSpark: { seek(t: number | null): void; state(): SparkState } })
        .__proofSpark;
      const state = controller.state();
      const span = state.rails[0].spans[1];
      controller.seek((span.a + span.b) / 2 / state.speed);

      const article = document.querySelectorAll<HTMLElement>('[id="06-proof"] article.pr3-a')[0];
      const facts = Array.from(article.querySelectorAll<HTMLElement>('.pf-fact'));
      const litIndex = facts.findIndex((fact) => fact.classList.contains('is-spark'));
      const litFact = facts[litIndex];
      const chip = litFact.querySelector('dt') as HTMLElement;
      const unlitChip = facts.find((_, index) => index !== litIndex)?.querySelector('dt') as HTMLElement;
      const hl = Number.parseFloat(getComputedStyle(litFact).getPropertyValue('--pf-hl'));
      return {
        litIndex,
        hl,
        litCount: facts.filter((fact) => fact.classList.contains('is-spark')).length,
        border: getComputedStyle(chip).borderTopColor,
        unlitBorder: getComputedStyle(unlitChip).borderTopColor,
        span,
      };
    });

    expect(lit.litIndex).toBe(1);
    expect(lit.hl).toBeGreaterThan(0.5);
    expect(lit.litCount).toBe(1);
    expect(lit.border).not.toBe(lit.unlitBorder);
    const [r, g, b] = channels(lit.border);
    expect(r).toBeGreaterThanOrEqual(200);
    expect(g).toBeLessThanOrEqual(170);
    expect(b).toBeLessThanOrEqual(120);

    await expect(section).toHaveScreenshot('proof.png');

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.viewport + 1);

    consoleErrors.assertNone();
  });

  test('@proof reduced motion: still rail, no spark, no highlight', async ({ page }) => {
    const consoleErrors = noConsoleErrors(page);
    await reducedMotion(page);

    await page.goto('/', { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: '.skip { display: none !important; }' });
    await mountSection(page);
    await assetsReady(page);

    const section = page.locator(SECTION);

    const sparkDisplay = await section.locator('.pf-spark').first().evaluate((el) => getComputedStyle(el).display);
    expect(sparkDisplay).toBe('none');

    const rows = section.locator('article.pr3-a');
    await expect(rows).toHaveCount(2);
    await expect(section.locator('.pf-fact')).toHaveCount(8);

    const claims = section.locator('.pf-fact dd');
    await expect(claims).toHaveCount(8);
    const allClaimsVisible = await claims.evaluateAll((elements) =>
      elements.every((el) => (el as HTMLElement).checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })),
    );
    expect(allClaimsVisible).toBe(true);

    await expect(section.locator('.is-spark')).toHaveCount(0);
    await expect(section.locator('.pf-fact[style*="--pf-hl"]')).toHaveCount(0);

    await expect(section).toHaveScreenshot('proof-reduced.png');

    consoleErrors.assertNone();
  });
});
