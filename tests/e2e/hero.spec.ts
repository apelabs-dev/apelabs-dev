import { expect, test, type Locator, type Page } from '@playwright/test';
import { noConsoleErrors, noOverflow, reducedMotion } from './helpers';

const NAV = '[id="01-nav"]';
const HERO = '[id="02-hero"]';

const NAV_LINKS = [
  { label: 'Repair', href: '#04-journey' },
  { label: 'More services', href: '#05-services' },
  { label: 'Proof', href: '#06-proof' },
  { label: 'Process', href: '#jr-diagnostic' },
  { label: 'FAQ', href: '#07-faq' },
] as const;
const CTA = 'Request a free diagnostic';

type CircuitState = 'running' | 'paused' | 'still';

async function openHome(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** Wait until the hero canvas reports a state (set by src/scripts/hero/hero.ts). */
async function waitForState(page: Page, state: CircuitState): Promise<void> {
  await expect
    .poll(() => page.locator(HERO).getAttribute('data-circuit'), { message: `circuit state ${state}` })
    .toBe(state);
}

const frame = (page: Page): Promise<string> =>
  page.locator(`${HERO} .hero-canvas`).evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());

/** Two animation frames: lets a still redraw (fonts, resize) land before a screenshot. */
const settle = (page: Page): Promise<void> =>
  page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));

async function canvasInk(page: Page): Promise<number> {
  return page.locator(`${HERO} .hero-canvas`).evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let lit = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) lit++;
    return lit;
  });
}

const width = (page: Page): number => page.viewportSize()?.width ?? 0;

const H1_TEXT = 'We fix and build the business systems small teams run on.';
/** The `rt` state class on the hero root (not a substring of the scoped astro class). */
const RT = /(^|\s)rt(\s|$)/;

interface OverlayLog {
  overlays: number;
  maxBands: number;
  allInert: boolean;
  idsInOverlay: number;
  sawRise: boolean;
}

/** Record the hero's line-reveal overlays (and any travelling line) from before the first script runs. */
async function watchOverlays(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log = { overlays: 0, maxBands: 0, allInert: true, idsInOverlay: 0, sawRise: false };
    (window as unknown as { __rt: typeof log }).__rt = log;
    const tick = (): void => {
      for (const layer of document.querySelectorAll<HTMLElement>('[id="02-hero"] .rt-fx')) {
        const bands = layer.querySelectorAll('.rt-band').length;
        if (!(layer as { __seen?: boolean }).__seen) {
          (layer as { __seen?: boolean }).__seen = true;
          log.overlays++;
          if (layer.getAttribute('aria-hidden') !== 'true' || !layer.inert) log.allInert = false;
          log.idsInOverlay += layer.querySelectorAll('[id]').length;
        }
        log.maxBands = Math.max(log.maxBands, bands);
        for (const copy of layer.querySelectorAll<HTMLElement>('.rt-copy')) {
          const cs = getComputedStyle(copy);
          const ty = cs.transform === 'none' ? 0 : new DOMMatrixReadOnly(cs.transform).m42;
          if (ty > 0.5 && Number(cs.opacity) < 1) log.sawRise = true;
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** True when the element, or any ancestor, is inert. */
const isInert = (locator: Locator): Promise<boolean> => locator.evaluate((el) => el.closest('[inert]') !== null);

test.describe('@hero', () => {
  test('copy, anchors and ids are exact; no overflow; clean console', async ({ page }) => {
    const errors = noConsoleErrors(page);
    await openHome(page);

    await expect(page.locator(NAV)).toHaveCount(1);
    await expect(page.locator(HERO)).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);

    const hero = page.locator(HERO);
    await expect(hero.locator('.hero-eyebrow')).toHaveText('apeLabs / business system repair');
    await expect(hero.locator('h1')).toHaveText('We fix and build the business systems small teams run on.');
    await expect(hero.locator('.hero-sub')).toHaveText('When something stops working and nobody notices, start with a free diagnostic.');
    await expect(hero.locator('.hero-cta')).toHaveText(CTA);
    await expect(hero.locator('.hero-cta')).toHaveAttribute('href', '#08-contact');
    await expect(hero.locator('.hero-more')).toHaveText('See what you get back');
    await expect(hero.locator('.hero-more')).toHaveAttribute('href', '#jr-findings');
    await expect(hero.locator('.hero-micro')).toHaveText('Free. No passwords needed.');
    await expect(hero).toHaveAttribute('data-labels', JSON.stringify(['failed', 'diagnosed', 'patched', 'verified']));

    const nav = page.locator(NAV);
    await expect(nav.locator('.bar-logo')).toHaveAttribute('aria-label', 'apeLabs home');
    for (const scope of ['.bar-nav a', '.menu-list a']) {
      // textContent, so the check holds whether or not the list is shown at this width.
      expect(await nav.locator(scope).allTextContents(), scope).toEqual(NAV_LINKS.map((link) => link.label));
      expect(
        await nav.locator(scope).evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
        `${scope} hrefs`,
      ).toEqual(NAV_LINKS.map((link) => link.href));
    }
    for (const selector of ['.bar-cta', '.menu-cta']) {
      await expect(nav.locator(selector)).toHaveText(CTA);
      await expect(nav.locator(selector)).toHaveAttribute('href', '#08-contact');
    }
    await expect(nav.locator('.menu-mail')).toHaveText('hello@apelabs.dev');
    await expect(nav.locator('.menu-mail')).toHaveAttribute('href', 'mailto:hello@apelabs.dev');
    await expect(nav.locator('.bar-menu')).toHaveAttribute('href', '#09-footer');

    await noOverflow(page);
    errors.assertNone();
  });

  test('at rest: reduced motion draws one deterministic frame', async ({ page }) => {
    const errors = noConsoleErrors(page);
    await reducedMotion(page);
    await openHome(page);

    await waitForState(page, 'still');
    await expect(page.locator(HERO)).toHaveClass(/is-live/);
    await settle(page);
    expect(await canvasInk(page), 'the still frame has circuit on it').toBeGreaterThan(500);

    const first = await frame(page);
    await page.waitForTimeout(600);
    expect(await frame(page), 'reduced motion: the canvas does not move').toBe(first);

    await noOverflow(page);
    await expect(page).toHaveScreenshot('hero-rest.png');
    errors.assertNone();
  });

  test('motion: advances, pauses off-screen and when hidden, static under reduced motion', async ({ page }) => {
    const errors = noConsoleErrors(page);
    await openHome(page);

    // Normal motion: the loop runs and the picture changes.
    await waitForState(page, 'running');
    const before = await frame(page);
    await page.waitForTimeout(500);
    expect(await frame(page), 'the circuit advances').not.toBe(before);

    // Off-screen: scroll the hero away (a spacer guarantees room while other sections are stubs).
    await page.evaluate(() => {
      const spacer = document.createElement('div');
      spacer.id = 'hero-test-spacer';
      spacer.style.height = '3000px';
      document.body.append(spacer);
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await waitForState(page, 'paused');
    const offscreen = await frame(page);
    await page.waitForTimeout(500);
    expect(await frame(page), 'paused while off-screen').toBe(offscreen);

    await page.evaluate(() => window.scrollTo(0, 0));
    await waitForState(page, 'running');

    // Hidden document.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitForState(page, 'paused');
    const hidden = await frame(page);
    await page.waitForTimeout(500);
    expect(await frame(page), 'paused while the tab is hidden').toBe(hidden);

    await page.evaluate(() => {
      Reflect.deleteProperty(document, 'visibilityState');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitForState(page, 'running');

    // The reader switches reduced motion on mid-session, then off again.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await waitForState(page, 'still');
    const still = await frame(page);
    await page.waitForTimeout(500);
    expect(await frame(page), 'static under reduced motion').toBe(still);

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await waitForState(page, 'running');
    const resumed = await frame(page);
    await page.waitForTimeout(500);
    expect(await frame(page), 'the loop resumes').not.toBe(resumed);

    errors.assertNone();
  });

  test('resize re-routes the canvas to the new size and keeps running', async ({ page }) => {
    const errors = noConsoleErrors(page);
    await openHome(page);
    await waitForState(page, 'running');

    const canvasWidth = (): Promise<number> => page.locator(`${HERO} .hero-canvas`).evaluate((c) => (c as HTMLCanvasElement).width);
    const before = await canvasWidth();
    const view = page.viewportSize();
    if (!view) throw new Error('no viewport');
    await page.setViewportSize({ width: view.width - 40, height: view.height - 60 });

    await expect.poll(canvasWidth, { message: 'canvas follows the hero width' }).toBe(before - 40);
    await waitForState(page, 'running');
    await noOverflow(page);
    errors.assertNone();
  });

  test('entrance: lines rise through an inert overlay, text stays single, overlay is removed', async ({ page }) => {
    const errors = noConsoleErrors(page);
    await watchOverlays(page);
    await openHome(page);

    await expect.poll(() => page.locator(HERO).getAttribute('data-reveal'), { message: 'reveal settles' }).toBe('idle');
    const seen = await page.evaluate(() => (window as unknown as { __rt: OverlayLog }).__rt);
    expect(seen.overlays, 'overlays appeared for the h1 and sub').toBeGreaterThanOrEqual(2);
    expect(seen.maxBands, 'the headline is revealed per line').toBeGreaterThanOrEqual(2);
    expect(seen.allInert, 'every overlay is aria-hidden and inert').toBe(true);
    expect(seen.sawRise, 'lines travelled (translate and fade) rather than just fading').toBe(true);
    expect(seen.idsInOverlay, 'clones carry no ids').toBe(0);

    const hero = page.locator(HERO);
    await expect(hero.locator('.rt-fx')).toHaveCount(0);
    await expect(hero.locator('h1')).toHaveCount(1);
    await expect(hero.getByRole('heading', { level: 1, name: H1_TEXT })).toHaveCount(1);
    expect(
      await hero.evaluate((el, text) => (el.textContent ?? '').split(text).length - 1, H1_TEXT),
      'headline text appears once',
    ).toBe(1);
    for (const sel of ['.hero-eyebrow', '.hero-h1', '.hero-sub']) {
      await expect(hero.locator(sel), sel).toHaveClass(/rt-in/);
      await expect(hero.locator(sel), sel).toHaveCSS('opacity', '1');
    }
    // The action block reveals as one piece once it enters the viewport.
    await hero.locator('.hero-cta').scrollIntoViewIfNeeded();
    await expect(hero.locator('.hero-actions')).toHaveClass(/rt-in/);
    await expect(hero.locator('.hero-actions')).toHaveCSS('opacity', '1');
    errors.assertNone();
  });

  test('entrance: focus reaches a CTA that has not revealed yet', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator(`${HERO} .hero-cta`).focus();
    await expect(page.locator(`${HERO} .hero-actions`)).toHaveCSS('opacity', '1');
  });

  test('entrance: dropped (fail-open) when the scripts never arrive', async ({ page }) => {
    test.skip(width(page) !== 1280, 'one project is enough for the timer');
    await page.route('**/*.js', (route) => route.abort());
    await page.goto('/', { waitUntil: 'load' });
    await expect(page.locator(HERO)).toHaveClass(RT);
    await expect(page.locator(HERO)).not.toHaveClass(RT, { timeout: 5000 });
    await expect(page.locator(`${HERO} h1`)).toHaveCSS('opacity', '1');
  });

  test('entrance: reduced motion shows the final state, no overlay, nothing hidden', async ({ page }) => {
    await reducedMotion(page);
    await watchOverlays(page);
    await openHome(page);

    const hero = page.locator(HERO);
    await expect(hero).not.toHaveClass(RT);
    await expect(hero).not.toHaveAttribute('data-reveal', /.*/);
    for (const sel of ['.hero-eyebrow', '.hero-h1', '.hero-sub', '.hero-actions', '.hero-micro']) {
      await expect(hero.locator(sel), sel).toHaveCSS('opacity', '1');
    }
    await expect(hero.locator('.rt-fx')).toHaveCount(0);
    await page.waitForTimeout(300);
    const seen = await page.evaluate(() => (window as unknown as { __rt: OverlayLog }).__rt);
    expect(seen.overlays, 'no overlay was ever built').toBe(0);
  });

  test('entrance: switching to reduced motion mid-way drops overlays and shows everything', async ({ page }) => {
    await watchOverlays(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const hero = page.locator(HERO);
    await expect(hero).not.toHaveClass(RT);
    await expect(hero.locator('.rt-fx')).toHaveCount(0);
    await expect(hero.locator('h1')).toHaveCSS('opacity', '1');
    await expect(hero.locator('.hero-actions')).toHaveCSS('opacity', '1');
  });

  test('keyboard: the skip link is still the first stop', async ({ page }) => {
    await openHome(page);
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip')).toBeFocused();
  });

  test('desktop bar: links and CTA shown, menu button hidden', async ({ page }) => {
    test.skip(width(page) < 1024, 'bar links show from 1024px');
    await openHome(page);

    const nav = page.locator(NAV);
    await expect(nav.locator('.bar-nav a')).toHaveCount(NAV_LINKS.length);
    for (const link of await nav.locator('.bar-nav a').all()) await expect(link).toBeVisible();
    await expect(nav.locator('.bar-cta')).toBeVisible();
    await expect(nav.locator('.bar-menu')).toBeHidden();
    await expect(nav.locator('.menu')).toBeHidden();
  });

  test.describe('menu sheet (below 1024px)', () => {
    test.beforeEach(({ page }) => {
      test.skip(width(page) >= 1024, 'the sheet is for widths below 1024px');
    });

    const open = async (page: Page): Promise<void> => {
      await openHome(page);
      await page.locator(`${NAV} .bar-menu`).click();
      await expect(page.locator(`${NAV} .menu`)).toBeVisible();
    };
    const closed = async (page: Page): Promise<void> => {
      await expect(page.locator(`${NAV} .menu`)).toBeHidden();
      await expect(page.locator(`${NAV} .bar-menu`)).toHaveAttribute('aria-expanded', 'false');
      expect(await isInert(page.locator('main')), 'main is live again').toBe(false);
      expect(await isInert(page.locator(`${NAV} .bar-in`)), 'bar is live again').toBe(false);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe('hidden');
    };

    test('opens as a modal: focus on close, page inert, scroll locked, sheet live', async ({ page }, testInfo) => {
      const errors = noConsoleErrors(page);
      await reducedMotion(page);
      await open(page);

      const nav = page.locator(NAV);
      await expect(nav.locator('.bar-menu')).toHaveAttribute('aria-expanded', 'true');
      await expect(nav.locator('.menu-close')).toBeFocused();
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), 'scroll lock').toBe('hidden');

      // Everything outside the sheet is inert; the sheet and the bar element holding it are not.
      expect(await isInert(page.locator('main')), 'main inert').toBe(true);
      expect(await isInert(nav.locator('.bar-in')), 'bar row inert').toBe(true);
      expect(await isInert(page.locator('.skip')), 'skip link inert').toBe(true);
      expect(await isInert(nav.locator('.menu')), 'sheet live').toBe(false);
      expect(await isInert(nav), 'bar element live').toBe(false);
      expect(await isInert(nav.locator('.menu-close')), 'close button live').toBe(false);

      if (testInfo.project.name === 'mobile-375') await expect(page).toHaveScreenshot('hero-menu-open.png');
      errors.assertNone();
    });

    test('Tab and Shift+Tab wrap inside the sheet', async ({ page }) => {
      await open(page);
      const inSheet = (): Promise<boolean> => page.evaluate(() => document.activeElement?.closest('.menu') != null);

      // 8 stops: close, five links, CTA, email. Walk past the end twice.
      for (let i = 0; i < 18; i++) {
        await page.keyboard.press('Tab');
        expect(await inSheet(), `Tab ${i + 1} stays in the sheet`).toBe(true);
      }
      await page.locator(`${NAV} .menu-close`).focus();
      await page.keyboard.press('Shift+Tab');
      await expect(page.locator(`${NAV} .menu-mail`)).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.locator(`${NAV} .menu-close`)).toBeFocused();
    });

    test('Escape closes and returns focus to the menu button', async ({ page }) => {
      await open(page);
      await page.keyboard.press('Escape');
      await closed(page);
      await expect(page.locator(`${NAV} .bar-menu`)).toBeFocused();
    });

    test('Escape still closes after a click moved focus off the controls', async ({ page }) => {
      await open(page);
      await page.mouse.click(width(page) / 2, 700);
      await page.keyboard.press('Escape');
      await closed(page);
    });

    test('the close button closes and returns focus', async ({ page }) => {
      await open(page);
      await page.locator(`${NAV} .menu-close`).click();
      await closed(page);
      await expect(page.locator(`${NAV} .bar-menu`)).toBeFocused();
    });

    test('keyboard opens the sheet: Space and Enter on the menu button', async ({ page }) => {
      await openHome(page);
      const trigger = page.locator(`${NAV} .bar-menu`);
      await expect(trigger).toHaveAttribute('role', 'button');
      for (const key of ['Space', 'Enter']) {
        await trigger.focus();
        await page.keyboard.press(key);
        await expect(page.locator(`${NAV} .menu`), `${key} opens`).toBeVisible();
        await page.keyboard.press('Escape');
        await closed(page);
      }
    });

    test('following a link dismisses the sheet and lands on the section', async ({ page }) => {
      await open(page);
      await page.locator(`${NAV} .menu-list a[href="#06-proof"]`).click();
      await closed(page);
      await expect(page).toHaveURL(/#06-proof$/);
    });

    test('the sheet closes when the window grows to desktop width', async ({ page }) => {
      await open(page);
      await page.setViewportSize({ width: 1280, height: 900 });
      await closed(page);
      await expect(page.locator(`${NAV} .bar-nav`)).toBeVisible();
    });
  });

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('poster shows, menu is a link to the footer, copy is intact', async ({ page }) => {
      await page.goto('/', { waitUntil: 'load' });

      await expect(page.locator(HERO)).not.toHaveClass(/is-live/);
      await expect(page.locator(HERO)).not.toHaveClass(RT);
      await expect(page.locator(`${HERO} .rt-fx`)).toHaveCount(0);
      for (const sel of ['.hero-eyebrow', '.hero-h1', '.hero-sub', '.hero-actions', '.hero-micro']) {
        await expect(page.locator(`${HERO} ${sel}`), sel).toHaveCSS('opacity', '1');
      }
      await expect(page.locator(`${HERO} .hero-poster svg >> visible=true`)).toHaveCount(1);
      await expect(page.locator(`${HERO} h1`)).toHaveText('We fix and build the business systems small teams run on.');
      await expect(page.locator(`${NAV} .menu`)).toBeHidden();
      await expect(page.locator(`${NAV} .bar-menu`)).toHaveAttribute('href', '#09-footer');
      if (width(page) < 1024) await expect(page.locator(`${NAV} .bar-menu`)).toBeVisible();
    });
  });
});
