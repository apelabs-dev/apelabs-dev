import { expect, test, type Page } from '@playwright/test';
import { noConsoleErrors, noOverflow, reducedMotion } from './helpers';

// The journey section (04): a board pinned by ScrollTrigger beside (desktop) or over (phones, tablets) seven
// steps; scrolling picks the step, and each step has its own scene on the board.
const ROOT = '[id="04-journey"]';
const SCENES = ['ok', 'broken', 'diag', 'find', 'quote', 'fix', 'done'];
// The longest scene moment (the board's GSAP timelines, the notes' placing polls and fades) is over by then.
const SETTLE_MS = 3600;

async function load(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // Keep the pointer off the board, so no note label shows on hover.
  await page.mouse.move(1, 200);
}

async function frames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
}

async function scrollIdle(page: Page): Promise<void> {
  let last = -1;
  for (let i = 0; i < 60; i++) {
    const y = await page.evaluate(() => window.scrollY);
    if (y === last) return;
    last = y;
    await page.waitForTimeout(50);
  }
}

type State = { live: boolean; step: number; scene: string; pinned: boolean };
const state = (page: Page): Promise<State> =>
  page.locator(ROOT).evaluate((el) => {
    const root = el as HTMLElement;
    const stage = root.querySelector<HTMLElement>('.jx-stage')!;
    return {
      live: root.classList.contains('jr-live'),
      step: Number(root.dataset.step),
      scene: root.dataset.scene ?? '',
      pinned: getComputedStyle(stage).position === 'fixed',
    };
  });

// Real scroll: wheel the page in 100px notches (shorter than any step) until step `n` is current, with the
// board pinned. Returns every scene the board showed on the way.
async function wheelTo(page: Page, n: number): Promise<string[]> {
  const seen: string[] = [];
  // One long wheel to just above the section, so its steps are still below the band.
  const gap = await page.locator(ROOT).evaluate((el) => el.getBoundingClientRect().top - innerHeight * 0.9);
  if (gap > 0) {
    await page.mouse.wheel(0, gap);
    await scrollIdle(page);
  }
  let s: State | null = null;
  for (let i = 0; i < 300; i++) {
    s = await state(page);
    if (s.live && seen.at(-1) !== s.scene) seen.push(s.scene);
    if (s.live && s.step === n && s.pinned) {
      await scrollIdle(page);
      return seen;
    }
    await page.mouse.wheel(0, s.live && s.step > n ? -100 : 100);
    await frames(page);
    await page.waitForTimeout(20);
  }
  const y = await page.evaluate(() => window.scrollY);
  throw new Error(`step ${n} never became current with the board pinned (last ${JSON.stringify(s)}, scrollY ${y})`);
}

const stageTop = (page: Page) => page.locator(`${ROOT} .jx-stage`).evaluate((el) => el.getBoundingClientRect().top);
const isDesk = (page: Page) => page.evaluate(() => matchMedia('(min-width: 1024px)').matches);

test.describe('@journey', () => {
  test.describe.configure({ timeout: 120_000 });

  test('story: real scroll through 00, 03 and 06 on a pinned board, the seal stamp, no overflow', async ({ page }) => {
    const consoleErrors = noConsoleErrors(page);
    await load(page);
    const root = page.locator(ROOT);

    // 00: the board pins (ScrollTrigger: position fixed inside its pin-spacer, not CSS sticky).
    const firstScenes = await wheelTo(page, 0);
    expect(firstScenes).toEqual(['ok']);
    const pin = await page.locator(`${ROOT} .jx-stage`).evaluate((el) => ({
      position: getComputedStyle(el).position,
      spacer: el.parentElement?.classList.contains('pin-spacer') ?? false,
    }));
    expect(pin).toEqual({ position: 'fixed', spacer: true });
    const top = await stageTop(page);
    // Under the bar (not fixed here, so 0) plus 24px on desktop; right at the top on phones and tablets.
    expect(top).toBeCloseTo((await isDesk(page)) ? 24 : 0, 0);
    await expect(root.locator('button[data-jr-go="0"]')).toHaveAttribute('aria-current', 'step');
    await expect(root.locator('#jr-works')).toHaveClass(/is-active/);
    await page.waitForTimeout(SETTLE_MS);
    await noOverflow(page);
    await expect(page).toHaveScreenshot('journey-00.png');

    // 03: every step on the way showed its own scene, in order.
    const midScenes = await wheelTo(page, 3);
    expect(['ok', ...midScenes].filter((s, i, a) => s !== a[i - 1])).toEqual(SCENES.slice(0, 4));

    // The stamp, sampled on the live CSS animations: entry 0–260 ms, the seal falls 520–820 and lands at 820
    // (seal 0.96, card pressed to 0.98, thump at its peak), the thump is gone by 980, all at rest at 1020.
    const stamp = await root.evaluate((el) => {
      const svg = el.querySelector('.jx-screen .jx-seal-svg') as SVGElement;
      const screen = el.querySelector('.jx-view .jx-screen') as HTMLElement;
      const pick = (t: Element, name: string) => t.getAnimations().find((a) => (a as CSSAnimation).animationName === name)!;
      const seal = pick(svg, 'jx-seal-in');
      const press = pick(screen, 'jx-stamp');
      const thump = pick(screen, 'jx-thump');
      const entry = pick(screen, 'jx-screen-in');
      const all = [seal, press, thump, entry];
      const timing = (a: Animation) => {
        const c = a.effect!.getComputedTiming();
        return { delay: c.delay, duration: c.duration, end: c.endTime };
      };
      const at = (ms: number) => {
        all.forEach((a) => {
          a.pause();
          a.currentTime = ms;
        });
        const s = getComputedStyle(svg);
        const c = getComputedStyle(screen);
        return { sealOpacity: s.opacity, sealScale: s.scale, sealRotate: s.rotate, cardScale: c.scale, thump: c.boxShadow !== 'none' };
      };
      const out = {
        timing: { seal: timing(seal), press: timing(press), thump: timing(thump), entry: timing(entry) },
        before: at(519),
        impact: at(820),
        thumpOver: at(981),
        rest: at(1021),
      };
      all.forEach((a) => a.finish());
      return out;
    });
    expect(stamp.timing).toEqual({
      seal: { delay: 520, duration: 500, end: 1020 },
      press: { delay: 820, duration: 200, end: 1020 },
      thump: { delay: 820, duration: 160, end: 980 },
      entry: { delay: 0, duration: 260, end: 260 },
    });
    expect(stamp.before.sealOpacity).toBe('0');
    expect(stamp.impact).toEqual({ sealOpacity: '1', sealScale: '0.96', sealRotate: '-9deg', cardScale: '0.98', thump: true });
    expect(stamp.thumpOver.thump).toBe(false);
    expect(stamp.rest).toEqual({ sealOpacity: '1', sealScale: '1', sealRotate: '-9deg', cardScale: 'none', thump: false });

    await page.waitForTimeout(SETTLE_MS);
    // The board stayed put while the page scrolled under it.
    expect(await stageTop(page)).toBeCloseTo(top, 0);
    // The seal rests at −9° in the findings' top-right corner, and the report's words wrap around it.
    const seal = await root.evaluate((el) => {
      const box = el.querySelector('.jx-screen .jx-seal')!.getBoundingClientRect();
      const card = el.querySelector('.jx-card-note')!.getBoundingClientRect();
      const title = el.querySelector('.jx-card-note .jx-card-title')!;
      const range = document.createRange();
      range.selectNodeContents(title);
      const hit = [...range.getClientRects()].some(
        (r) => r.right > box.left && r.left < box.right && r.bottom > box.top && r.top < box.bottom,
      );
      const svg = getComputedStyle(el.querySelector('.jx-screen .jx-seal-svg')!);
      return { rotate: svg.rotate, scale: svg.scale, right: card.right - box.right, topGap: box.top - card.top, w: box.width, hit };
    });
    expect(seal.rotate).toBe('-9deg');
    expect(seal.scale).toBe('1');
    expect(seal.w).toBeGreaterThan(70);
    expect(seal.right).toBeGreaterThanOrEqual(0);
    expect(seal.right).toBeLessThan(24);
    expect(seal.topGap).toBeLessThan(80);
    expect(seal.hit).toBe(false);
    await noOverflow(page);
    await expect(page).toHaveScreenshot('journey-03.png');

    // 06: the verified board, still pinned.
    const lastScenes = await wheelTo(page, 6);
    expect(lastScenes.filter((s, i, a) => s !== a[i - 1])).toEqual(SCENES.slice(3));
    await page.waitForTimeout(SETTLE_MS);
    expect(await stageTop(page)).toBeCloseTo(top, 0);
    await expect(root.locator('.jx-card-check')).toBeVisible();
    await expect(root.locator('[data-jx-where]')).toHaveText('Warranty');
    await noOverflow(page);
    await expect(page).toHaveScreenshot('journey-06.png');

    consoleErrors.assertNone();
  });

  test('notes: one pin per step, 44px target, pulse, keyboard and pointer open/close', async ({ page }) => {
    const consoleErrors = noConsoleErrors(page);
    await load(page);
    const root = page.locator(ROOT);
    await wheelTo(page, 6);
    await page.waitForTimeout(SETTLE_MS);

    // Only the current step's pin shows (the others are hidden), and it is a 44×44 target on the board.
    const pins = root.locator('.cx-pin:not([hidden])');
    await expect(pins).toHaveCount(1);
    const pin = root.locator('.cx-pin[data-cx-pin="verified"]');
    await expect(pin).toBeVisible();
    await expect(pin).toHaveAttribute('aria-expanded', 'false');
    await expect(pin).toHaveAttribute('aria-controls', 'cx-plate-verified');
    const box = (await pin.boundingBox())!;
    const view = (await root.locator('.jx-view').boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    expect(cx).toBeGreaterThan(view.x);
    expect(cx).toBeLessThan(view.x + view.width);
    expect(cy).toBeGreaterThan(view.y);
    expect(cy).toBeLessThan(view.y + view.height);
    // The ring round the dot breathes while the note is closed and goes when it opens.
    const ring = () =>
      pin.locator('.cx-pin-mark').evaluate((m) => {
        const r = getComputedStyle(m, '::after');
        return r.display === 'none' ? 'gone' : r.animationName;
      });
    expect(await ring()).toBe('note-breathe');

    // Where a pointer can hover, the hint waits for hover or keyboard focus.
    const label = pin.locator('.cx-pin-label');
    const hover = await page.evaluate(() => matchMedia('(hover: hover)').matches);
    if (hover) {
      await expect(label).toBeHidden();
      await pin.hover();
      await expect(label).toBeVisible();
      await page.mouse.move(1, 200);
      await expect(label).toBeHidden();
    }

    // Keyboard: Tab from the rail reaches the pin; Enter opens, Escape closes and keeps focus on the pin,
    // Space opens again.
    await root.locator('button[data-jr-go="6"]').focus();
    await page.keyboard.press('Tab');
    await expect(pin).toBeFocused();
    await expect(label).toBeVisible();
    const plate = root.locator('#cx-plate-verified');
    await page.keyboard.press('Enter');
    await expect(pin).toHaveAttribute('aria-expanded', 'true');
    await expect(plate).toHaveClass(/is-on/);
    await expect(plate).not.toHaveAttribute('aria-hidden', 'true');
    await expect.poll(() => plate.evaluate((p) => getComputedStyle(p).opacity)).toBe('1');
    expect(await root.locator('.cx-lead-line path').getAttribute('d')).toMatch(/^M[\d.\- L]+$/);
    await expect(label).toBeHidden();
    expect(await ring()).toBe('gone');
    const plateBox = (await plate.boundingBox())!;
    expect(plateBox.x).toBeGreaterThanOrEqual(view.x - 1);
    expect(plateBox.x + plateBox.width).toBeLessThanOrEqual(view.x + view.width + 1);
    await page.keyboard.press('Escape');
    await expect(pin).toHaveAttribute('aria-expanded', 'false');
    await expect(pin).toBeFocused();
    await expect(plate).not.toHaveClass(/is-on/);
    await page.keyboard.press('Space');
    await expect(pin).toHaveAttribute('aria-expanded', 'true');

    // Pointer: a press away from the pin and its plate closes it; pressing the pin toggles it.
    const open = (await plate.boundingBox())!;
    const away = [
      [view.x + 4, view.y + 4],
      [view.x + view.width - 4, view.y + 4],
      [view.x + 4, view.y + view.height - 4],
    ].find(([x, y]) => {
      const inside = (b: { x: number; y: number; width: number; height: number }) =>
        x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
      return !inside(open) && !inside(box);
    })!;
    await page.mouse.click(away[0], away[1]);
    await expect(pin).toHaveAttribute('aria-expanded', 'false');
    await pin.click();
    await expect(pin).toHaveAttribute('aria-expanded', 'true');
    await pin.click();
    await expect(pin).toHaveAttribute('aria-expanded', 'false');

    consoleErrors.assertNone();
  });

  test('rail buttons scroll the page to their step', async ({ page }) => {
    const consoleErrors = noConsoleErrors(page);
    await load(page);
    const root = page.locator(ROOT);
    await wheelTo(page, 0);
    const before = await page.evaluate(() => window.scrollY);
    await root.locator('button[data-jr-go="4"]').click();
    await expect(root).toHaveAttribute('data-step', '4');
    await expect(root).toHaveAttribute('data-scene', 'quote');
    // The board shows the step first and holds it a beat; the page scrolls after.
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).toBeGreaterThan(before + 200);
    await scrollIdle(page);
    await expect(root.locator('#jr-quote .jr-name')).toBeFocused();
    await expect(root.locator('#jr-quote .jr-name')).toBeInViewport();
    await page.waitForTimeout(600);
    await expect(root).toHaveAttribute('data-step', '4');
    consoleErrors.assertNone();
  });

  test('reduced motion: states land at once, no pulse, no stamp', async ({ page }) => {
    const consoleErrors = noConsoleErrors(page);
    await reducedMotion(page);
    await load(page);
    const root = page.locator(ROOT);

    await wheelTo(page, 3);
    const find = await root.evaluate((el) => {
      const svg = el.querySelector('.jx-screen .jx-seal-svg')!;
      const screen = el.querySelector('.jx-view .jx-screen')!;
      const s = getComputedStyle(svg);
      return {
        animations: svg.getAnimations().length + screen.getAnimations().length,
        rotate: s.rotate,
        scale: s.scale,
        opacity: getComputedStyle(el.querySelector('.jx-card-note')!).opacity,
        flags: [...el.querySelector('.jx-view')!.classList].filter((c) => c.startsWith('u-')),
      };
    });
    expect(find).toEqual({ animations: 0, rotate: '-9deg', scale: 'none', opacity: '1', flags: [] });

    await wheelTo(page, 6);
    const pin = root.locator('.cx-pin[data-cx-pin="verified"]');
    await expect(pin).toBeVisible();
    expect(await pin.evaluate((p) => getComputedStyle(p).opacity)).toBe('1');
    expect(await pin.locator('.cx-pin-mark').evaluate((m) => getComputedStyle(m, '::after').animationName)).toBe('none');

    // The rail scrolls instantly.
    await root.locator('button[data-jr-go="2"]').click();
    await expect(root).toHaveAttribute('data-scene', 'diag');
    await expect(root.locator('#jr-diagnostic .jr-name')).toBeInViewport();
    // Still current once the hold is over: the step it landed on covers the band.
    await page.waitForTimeout(400);
    await expect(root).toHaveAttribute('data-scene', 'diag');
    await noOverflow(page);
    consoleErrors.assertNone();
  });

  test.describe('without JS', () => {
    test.use({ javaScriptEnabled: false });

    test('the final scene and every note show as static content', async ({ page }) => {
      await page.goto('/', { waitUntil: 'networkidle' });
      const root = page.locator(ROOT);
      await expect(root).toHaveAttribute('data-scene', 'done');
      await expect(root.locator('.jx-rail')).toBeHidden();
      await expect(root.locator('.jx-card-check')).toBeVisible();
      await expect(root.locator('.ui-n-test').first()).toBeVisible();
      await expect(root.locator('.cx-notes')).toHaveCount(4);
      for (const notes of await root.locator('.cx-notes').all()) await expect(notes).toBeVisible();
      await expect(root.locator('.cx-layer')).toBeHidden();
      await expect(root.locator('.jx-step')).toHaveCount(7);
      // Rows the CRM window has no room for wrap into a second column its .ui-rows clips (rows.ts hides them when
      // JS runs). So: the page doesn't scroll sideways, and nothing outside a clipping box crosses the edge.
      const over = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const clipped = (el: Element) => {
          for (let a = el.parentElement; a; a = a.parentElement) {
            if (getComputedStyle(a).overflowX !== 'visible' && a.getBoundingClientRect().right <= vw + 1) return true;
          }
          return false;
        };
        const out = [...document.querySelectorAll('body *')].filter((el) => {
          const s = getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden') return false;
          return el.getBoundingClientRect().right > vw + 1 && !clipped(el);
        });
        return { scroll: document.documentElement.scrollWidth - vw, out: out.map((el) => `${el.tagName}.${el.getAttribute('class')}`).slice(0, 3) };
      });
      expect(over).toEqual({ scroll: 0, out: [] });
    });
  });

  test.describe('phone', () => {
    test.use({ hasTouch: true, isMobile: true });

    test('the hint shows while closed and clears the board windows', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-375', 'phones only');
      const consoleErrors = noConsoleErrors(page);
      await load(page);
      expect(await page.evaluate(() => matchMedia('(hover: none)').matches)).toBe(true);
      const root = page.locator(ROOT);
      await wheelTo(page, 1);
      await page.waitForTimeout(SETTLE_MS);

      await expect(root.locator('.cx-pin:not([hidden])')).toHaveCount(1);
      const pin = root.locator('.cx-pin[data-cx-pin="fails"]');
      await expect(pin).toBeVisible();
      const label = pin.locator('.cx-pin-label');
      await expect(label).toBeVisible();
      const hit = (await pin.boundingBox())!;
      expect(Math.min(hit.width, hit.height)).toBeGreaterThanOrEqual(44);

      // The hint never straddles a window's edge (the CRM's in particular): wholly inside or wholly clear.
      const straddles = await root.evaluate((el) => {
        const lab = el.querySelector('.cx-pin[data-cx-pin="fails"] .cx-pin-label')!.getBoundingClientRect();
        return [...el.querySelectorAll<HTMLElement>('.jx-view .ui-win, .jx-view .ui-phone')]
          .filter((w) => w.checkVisibility())
          .map((w) => {
            const b = w.getBoundingClientRect();
            const inside = lab.left >= b.left + 2 && lab.right <= b.right - 2 && lab.top >= b.top + 2 && lab.bottom <= b.bottom - 2;
            const clear = lab.right <= b.left - 2 || lab.left >= b.right + 2 || lab.bottom <= b.top - 2 || lab.top >= b.bottom + 2;
            return inside || clear ? null : w.className;
          })
          .filter(Boolean);
      });
      expect(straddles).toEqual([]);
      const view = (await root.locator('.jx-view').boundingBox())!;
      const lab = (await label.boundingBox())!;
      expect(lab.x).toBeGreaterThanOrEqual(view.x);
      expect(lab.x + lab.width).toBeLessThanOrEqual(view.x + view.width);

      await expect(page).toHaveScreenshot('journey-01-hint.png');
      // Opening it hides the hint and docks the plate under the board.
      await pin.tap();
      await expect(pin).toHaveAttribute('aria-expanded', 'true');
      await expect(label).toBeHidden();
      await expect(root.locator('#cx-plate-fails')).toHaveClass(/is-dock/);
      consoleErrors.assertNone();
    });
  });

  test('resize: the pin follows the layout across the desktop breakpoint', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1280', 'desktop start only');
    const consoleErrors = noConsoleErrors(page);
    await load(page);
    const root = page.locator(ROOT);
    await wheelTo(page, 3);
    expect(await stageTop(page)).toBeCloseTo(24, 0);

    // Narrow to a tablet width: the board pins over the steps, flush with the top.
    await page.setViewportSize({ width: 900, height: 900 });
    await page.waitForTimeout(800);
    await page.mouse.wheel(0, 100);
    await scrollIdle(page);
    const narrow = await state(page);
    expect(narrow.live).toBe(true);
    expect(narrow.scene).toBe(SCENES[narrow.step]);
    if (narrow.pinned) expect(await stageTop(page)).toBeCloseTo(0, 0);
    await noOverflow(page);

    // Back to desktop: pinned 24px down again, beside the steps.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(800);
    await wheelTo(page, 4);
    expect(await stageTop(page)).toBeCloseTo(24, 0);
    await noOverflow(page);
    consoleErrors.assertNone();
  });
});
