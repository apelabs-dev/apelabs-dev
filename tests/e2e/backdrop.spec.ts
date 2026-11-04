import { expect, test, type Page } from '@playwright/test';
import { noConsoleErrors, reducedMotion } from './helpers';

// The page background: one static layer of circuit traces, first child of <main>, tiled from the top
// of main to its end. The hero's opaque ground masks it; it never takes a pointer.
const LAYER = 'main > .bgm-layer';
const HERO = '[id="02-hero"]';
const FAQ = '[id="07-faq"]';
const FOOTER = '[id="09-footer"]';

/** Tile per breakpoint, in units of the lattice: cell = --col / 4 (desktop) or --col / 2 (≤768px). */
function expected(width: number) {
  const frame = Math.min(1102, width - 32, Math.max(0.6966 * width + 86.3, 0.775 * width - 14));
  const mobile = width <= 768;
  const cell = frame / 6 / (mobile ? 2 : 4);
  return { file: mobile ? 'tile-a-m.svg' : 'tile-a.svg', w: cell * 24, h: cell * 18, x: (width - frame) / 2 };
}

async function layerStyle(page: Page) {
  return page.locator(LAYER).evaluate((el) => {
    const cs = getComputedStyle(el);
    const main = el.parentElement!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
      image: cs.backgroundImage,
      size: cs.backgroundSize.split(' ').map(parseFloat),
      pos: cs.backgroundPosition.split(' ').map(parseFloat),
      repeat: cs.backgroundRepeat,
      z: cs.zIndex,
      pointer: cs.pointerEvents,
      animation: cs.animationName,
      transition: cs.transitionProperty,
      first: el.parentElement!.firstElementChild === el,
      rect: [r.top - main.top, r.bottom - main.bottom, r.left - main.left, r.right - main.right],
    };
  });
}

async function assertTile(page: Page) {
  const width = page.viewportSize()!.width;
  const want = expected(width);
  const s = await layerStyle(page);
  expect(s.image).toContain(`/assets/bg/${want.file}`);
  expect(s.size[0]).toBeCloseTo(want.w, 1);
  expect(s.size[1]).toBeCloseTo(want.h, 1);
  expect(s.pos[0]).toBeCloseTo(want.x, 1);
  expect(s.pos[1]).toBe(0);
  expect(s.repeat).toBe('repeat');
  expect(s.z).toBe('-1');
  expect(s.pointer).toBe('none');
  expect(s.animation).toBe('none');
  expect(s.first).toBe(true);
  // Origin at the top of main, through to its end, full width.
  for (const d of s.rect) expect(Math.abs(d)).toBeLessThan(1);
  await expect(page.locator(LAYER)).toHaveAttribute('aria-hidden', 'true');
}

/** A section's pixels with the layer shown and hidden. */
async function withAndWithout(page: Page, selector: string): Promise<[Buffer, Buffer]> {
  const target = page.locator(selector);
  await target.scrollIntoViewIfNeeded();
  const on = await target.screenshot({ animations: 'disabled', caret: 'hide' });
  await page.locator(LAYER).evaluate((el: HTMLElement) => (el.style.visibility = 'hidden'));
  const off = await target.screenshot({ animations: 'disabled', caret: 'hide' });
  await page.locator(LAYER).evaluate((el: HTMLElement) => (el.style.visibility = ''));
  return [on, off];
}

test.describe('@static backdrop', () => {
  test('both approved tiles are served as SVG', async ({ request }) => {
    for (const file of ['tile-a.svg', 'tile-a-m.svg']) {
      const res = await request.get(`/assets/bg/${file}`);
      expect(res.status(), file).toBe(200);
      expect(res.headers()['content-type'], file).toContain('image/svg+xml');
      const body = await res.text();
      expect(body).toContain('viewBox="0 0 24 18"');
      expect(body).not.toMatch(/<script|<image|href=/);
    }
  });

  test('the tile for this width, from the top of main to its end, never over the hero or a control', async ({ page }) => {
    const consoleErrors = noConsoleErrors(page);
    const tile = page.waitForResponse((r) => r.url().includes('/assets/bg/tile-'));
    await page.goto('/', { waitUntil: 'load' });
    const res = await tile;
    expect(res.status()).toBe(200);
    expect(res.url()).toContain(`/assets/bg/${expected(page.viewportSize()!.width).file}`);
    await assertTile(page);

    // The hero's ground is opaque, so the texture begins where the hero ends.
    await expect(page.locator(HERO)).toHaveCSS('background-color', 'rgb(11, 11, 12)');

    // Hit testing passes through the layer to the content above it.
    for (const sel of [`${HERO} .hero-actions a`, `${FAQ} summary`, `${FOOTER} .ft-mail a`]) {
      const el = page.locator(sel).first();
      await el.scrollIntoViewIfNeeded();
      const hit = await el.evaluate((node) => {
        const r = node.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!top && (node === top || node.contains(top));
      });
      expect(hit, sel).toBe(true);
    }
    consoleErrors.assertNone();
  });

  test('reduced motion: the same still texture, hidden under the hero, painted behind the FAQ', async ({ page }) => {
    await reducedMotion(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await assertTile(page);

    const [heroOn, heroOff] = await withAndWithout(page, HERO);
    expect(heroOn.equals(heroOff), 'layer shows through the hero').toBe(true);
    const [faqOn, faqOff] = await withAndWithout(page, FAQ);
    expect(faqOn.equals(faqOff), 'layer paints nothing behind the FAQ').toBe(false);
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('the layer and its tile are plain markup and CSS', async ({ page }) => {
      await page.goto('/', { waitUntil: 'load' });
      await assertTile(page);
    });
  });
});
