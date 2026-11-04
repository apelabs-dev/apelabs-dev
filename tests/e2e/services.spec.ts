import { expect, test, type Page } from '@playwright/test';
import { noConsoleErrors, noOverflow, reducedMotion } from './helpers';

// Deck order, copy and prices are the approved deck's; photos are the four approved files.
const SERVICES = [
  { id: 'setup', name: 'AI systems setup', price: 'from $300', photo: 'services-ai-systems-setup.jpg' },
  { id: 'opinion', name: 'Second opinion', price: '$250', photo: 'services-second-opinion.jpg' },
  { id: 'build', name: 'Custom builds', price: 'quote only', photo: 'services-custom-builds.jpg' },
  { id: 'workshop', name: 'AI workshop', price: '$400', photo: 'services-ai-workshop.jpg' },
] as const;
const FRAMES = [0, 0.2, 0.4, 0.6, 0.8, 1];
const ROOT = '[id="05-services"]';
const TOOLS: Record<string, string> = { HubSpot: 'hubspot', 'Google Sheets': 'googlesheets', Zapier: 'zapier', QuickBooks: 'quickbooks' };

type Api = {
  open(i: number): void;
  seek(p: number): void;
  destroy(): void;
  state(): {
    open: number;
    running: boolean;
    framePending: boolean;
    reduced: boolean;
    openProgress: number | null;
    layout: 'wide' | 'narrow' | null;
    progress: number[];
    paintCounts: number[];
  };
};
declare global {
  interface Element {
    __services?: Api;
  }
}

const state = (page: Page) => page.evaluate(() => document.querySelector('[id="05-services"]')!.__services!.state());
const open = (page: Page, i: number) => page.evaluate((n) => document.querySelector('[id="05-services"]')!.__services!.open(n), i);
const seek = (page: Page, p: number) => page.evaluate((n) => document.querySelector('[id="05-services"]')!.__services!.seek(n), p);
const frames = (page: Page, n = 2) =>
  page.evaluate(
    (count) => new Promise<void>((done) => { let left = count; const step = () => (--left <= 0 ? done() : requestAnimationFrame(step)); requestAnimationFrame(step); }),
    n,
  );

/** Wait until the open card's geometry stops changing (the grow-in-place transition has landed). */
async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        let last = '';
        let same = 0;
        let guard = 240;
        const step = () => {
          const key = [...document.querySelectorAll('[id="05-services"] .sr3-panel')].map((p) => p.getBoundingClientRect().width.toFixed(2) + 'x' + p.getBoundingClientRect().height.toFixed(2)).join('|');
          same = key === last ? same + 1 : 0;
          last = key;
          if (same >= 4 || --guard <= 0) done();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
  );
}

/** Load the landing page, wait for the deck to be wired and its photos to load, and bring it into view. */
async function ready(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.locator(ROOT).scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !!document.querySelector('[id="05-services"]')?.__services);
  await page.evaluate(() => document.querySelector('[id="05-services"]')!.scrollIntoView({ block: 'start' }));
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('[id="05-services"] img')].every((img) => img.complete && img.naturalWidth > 0));
  await settle(page);
}

const panel = (page: Page, id: string) => page.locator(`${ROOT} [data-service="${id}"]`);

test.describe('@services', () => {
  test('closed deck: four photo cards in deck order, copy and prices', async ({ page }) => {
    const errors = noConsoleErrors(page);
    await ready(page);

    await expect(page.locator(ROOT)).toHaveAttribute('data-island', 'services');
    await expect(page.locator(`${ROOT} .sr3-panel`)).toHaveCount(4);
    for (const [i, s] of SERVICES.entries()) {
      const p = page.locator(`${ROOT} .sr3-panel`).nth(i);
      await expect(p).toHaveAttribute('data-service', s.id);
      await expect(p.locator('.sr3-service-name')).toHaveText(s.name);
      await expect(p.locator('.sr3-price')).toHaveText(s.price);
      await expect(p.locator('.sr3-toggle')).toHaveAttribute('aria-expanded', 'false');
      await expect(p.locator('.sr3-body')).toBeHidden();
      await expect(p.locator('img')).toHaveAttribute('src', `/images/services/${s.photo}`);
      expect(await p.locator('img').evaluate((img: HTMLImageElement) => [img.complete, img.naturalWidth > 0])).toEqual([true, true]);
    }
    expect((await state(page)).open).toBe(-1);
    await noOverflow(page);
    await expect(page.locator(ROOT)).toHaveScreenshot('services-closed.png');
    errors.assertNone();
  });

  for (const s of SERVICES) {
    test(`final frame: ${s.id}`, async ({ page }) => {
      const errors = noConsoleErrors(page);
      await ready(page);
      await open(page, SERVICES.indexOf(s));
      await seek(page, 1);
      await settle(page);
      // Only this card's finite animations; the rest of the page ships its own looping motion.
      await page.evaluate(() => {
        const root = document.querySelector('[id="05-services"]')!;
        return Promise.all(root.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => undefined))).then(() => undefined);
      });
      await frames(page, 3);

      const st = await state(page);
      expect(st.open).toBe(SERVICES.indexOf(s));
      expect(st.openProgress).toBe(1);
      expect(st.running).toBe(false);
      await expect(panel(page, s.id)).toHaveClass(/is-open/);
      await expect(panel(page, s.id).locator('.sr3-play')).toHaveAttribute('data-mode', 'replay');
      await expect(panel(page, s.id).locator('.sr3-progress')).toHaveText('100%');
      await expect(panel(page, s.id).locator('.sr3-note')).toHaveText('Illustration · sample data');
      await noOverflow(page);
      // HTML text over the filtered, scaled photo is composited; its anti-aliasing varies run to run
      // (identical geometry), so allow a sliver of pixels. Any layout or colour regression exceeds it.
      await expect(panel(page, s.id)).toHaveScreenshot(`services-card-${s.id}.png`, { maxDiffPixelRatio: 0.005 });
      errors.assertNone();
    });
  }

  test('renderer fills its window: stretch, exact box, wide/narrow switch', async ({ page }, info) => {
    await ready(page);
    const desktop = info.project.name === 'desktop-1280';
    for (const [i, s] of SERVICES.entries()) {
      await open(page, i);
      await seek(page, 1);
      await settle(page);
      const m = await panel(page, s.id).evaluate((el) => {
        const art = el.querySelector<HTMLElement>('.sr3-artifact')!;
        const stages = el.querySelector<HTMLElement>('.sr3-stages')!;
        const svgs = [...el.querySelectorAll<SVGSVGElement>('.sr3-svg')];
        const shown = svgs.filter((v) => getComputedStyle(v).display !== 'none');
        const a = art.getBoundingClientRect();
        const w = stages.getBoundingClientRect();
        const cs = getComputedStyle(stages);
        const v = shown[0].getBoundingClientRect();
        return {
          // The window is the artifact's padding box: its border is not drawing space.
          window: { x: a.left + art.clientLeft, y: a.top + art.clientTop, w: art.clientWidth, h: art.clientHeight },
          stages: { x: w.left, y: w.top, w: w.width, h: w.height },
          svg: { x: v.left, y: v.top, w: v.width, h: v.height },
          alignSelf: cs.alignSelf,
          justifySelf: cs.justifySelf,
          shown: shown.map((x) => x.dataset.layout),
          viewBox: shown[0].getAttribute('viewBox'),
          all: svgs.map((x) => x.getAttribute('viewBox')),
          artifactWidth: art.clientWidth,
          border: [art.clientLeft, art.clientTop],
        };
      });
      expect(m.shown, `${s.id}: exactly one drawing shows`).toHaveLength(1);
      expect(m.all).toEqual(['0 0 480 360', '0 0 340 440']);
      const narrow = m.artifactWidth < 440;
      expect(m.shown[0], `${s.id}: ${m.artifactWidth}px window`).toBe(narrow ? 'narrow' : 'wide');
      expect(m.viewBox).toBe(narrow ? '0 0 340 440' : '0 0 480 360');
      expect((await state(page)).layout).toBe(narrow ? 'narrow' : 'wide');
      if (info.project.name === 'mobile-375') expect(narrow).toBe(true);
      else expect(narrow).toBe(false);
      if (desktop) {
        expect(m.border, 'the open window carries a 1px border').toEqual([1, 1]);
        expect(m.alignSelf).toBe('stretch');
        expect(m.justifySelf).toBe('stretch');
        expect(Math.abs(m.stages.w - m.window.w), `${s.id} stages width`).toBeLessThanOrEqual(1);
        expect(Math.abs(m.stages.h - m.window.h), `${s.id} stages height`).toBeLessThanOrEqual(1);
        expect(Math.abs(m.stages.x - m.window.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(m.stages.y - m.window.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(m.svg.w - m.window.w), `${s.id} svg width`).toBeLessThanOrEqual(1);
        expect(Math.abs(m.svg.h - m.window.h), `${s.id} svg height`).toBeLessThanOrEqual(1);
      }
    }
  });

  test('icons: Lucide 16 at stroke 1.5, one-colour tool marks, from the build-time sprite', async ({ page }) => {
    await ready(page);
    const lucideNames = new Set<string>();
    const logoSlugs = new Set<string>();
    for (const [i, s] of SERVICES.entries()) {
      await open(page, i);
      await seek(page, 1);
      const report = await panel(page, s.id).evaluate((el, tools) => {
        const out: string[] = [];
        const lucide: string[] = [];
        const logos: string[] = [];
        for (const svg of el.querySelectorAll<SVGSVGElement>('.sr3-svg')) {
          const shown = getComputedStyle(svg).display !== 'none';
          const vb = svg.viewBox.baseVal;
          const r = svg.getBoundingClientRect();
          const scale = Math.min(r.width / vb.width, r.height / vb.height);
          for (const use of svg.querySelectorAll<SVGUseElement>('use')) {
            const href = use.getAttribute('href')!;
            const sym = document.querySelector(href);
            const inner = sym?.querySelector('svg');
            if (!inner) { out.push(`${href}: no sprite symbol`); continue; }
            const isLucide = use.classList.contains('lu');
            const is = (k: string) => inner.getAttribute(k);
            if (is('width') !== '16' || is('height') !== '16') out.push(`${href}: size ${is('width')}x${is('height')}`);
            if (isLucide) {
              lucide.push(use.dataset.lucide!);
              if (href !== `#sr3-i-lucide-${use.dataset.lucide}`) out.push(`${href}: wrong set`);
              if (is('stroke-width') !== '1.5' || is('stroke') !== 'currentColor' || is('fill') !== 'none') out.push(`${href}: stroke ${is('stroke-width')} ${is('stroke')} ${is('fill')}`);
            } else {
              logos.push(use.dataset.logo!);
              if (href !== `#sr3-i-simple-${use.dataset.logo}`) out.push(`${href}: wrong set`);
              if (is('fill') !== 'currentColor' || is('stroke')) out.push(`${href}: not a one-colour mark`);
              // Tool marks are paper, never the brand colour.
              if (shown && getComputedStyle(use).color !== 'rgb(243, 241, 234)') out.push(`${href}: colour ${getComputedStyle(use).color}`);
            }
            // A <use> reports its ink box: it must sit inside the 16-unit icon square and actually draw.
            if (shown && getComputedStyle(use).display !== 'none') {
              const b = use.getBoundingClientRect();
              const box = 16 * scale;
              if (b.width > box + 1.5 || b.height > box + 1.5 || b.width < box * 0.4 || b.height < box * 0.4) out.push(`${href}: ink ${b.width.toFixed(1)}x${b.height.toFixed(1)} in a ${box.toFixed(1)} square`);
            }
          }
          // Every named tool card carries its own mark.
          for (const card of svg.querySelectorAll('.sr3-card')) {
            const name = card.querySelector('.sr3-name')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
            if (name in tools && !card.querySelector(`use[data-logo="${tools[name]}"]`)) out.push(`${name}: no ${tools[name]} mark`);
          }
        }
        return { out, lucide, logos };
      }, TOOLS);
      expect(report.out, `${s.id} icon problems`).toEqual([]);
      report.lucide.forEach((n) => lucideNames.add(n));
      report.logos.forEach((n) => logoSlugs.add(n));
    }
    expect([...logoSlugs].sort()).toEqual(['googlesheets', 'hubspot', 'quickbooks', 'zapier']);
    expect(lucideNames.size).toBeGreaterThanOrEqual(15);
    // The HTML controls come through Icon.astro too: 16 × 16, stroke 1.5.
    const html = await page.locator(ROOT).evaluate((root) =>
      [...root.querySelectorAll<SVGSVGElement>('.sr3-plus svg, .sr3-play svg')].map((s) => [s.getAttribute('width'), s.getAttribute('stroke-width'), s.getAttribute('stroke')]),
    );
    expect(html.length).toBe(16);
    for (const row of html) expect(row).toEqual(['16', '1.5', 'currentColor']);
  });

  test('no text leaves its node or the drawing at any frame', async ({ page }) => {
    await ready(page);
    const sweep = Array.from({ length: 41 }, (_, i) => i / 40);
    for (const [i, s] of SERVICES.entries()) {
      await open(page, i);
      await settle(page);
      const bad = await panel(page, s.id).evaluate((el, list) => {
        const root = document.querySelector('[id="05-services"]')!;
        const api = root.__services!;
        const svg = [...el.querySelectorAll<SVGSVGElement>('.sr3-svg')].find((v) => getComputedStyle(v).display !== 'none')!;
        const vb = svg.viewBox.baseVal;
        const out: string[] = [];
        const hidden = (n: Element | null) => { for (; n && n !== svg; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === 'none' || c.visibility === 'hidden') return true; } return false; };
        const opacity = (n: Element | null) => { let o = 1; for (; n && n !== svg; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; };
        const BOXES: [string, string][] = [['.sr3-chip', 'rect'], ['.sr3-callout', 'rect'], ['.sr3-bubble', 'path'], ['.sr3-sticky', '.sr3-sticky-face'], ['.sr3-card', '.sr3-face'], ['.sr3-shell', '.sr3-shell-face']];
        const boxOf = (text: Element): Element | null => {
          for (let n: Element | null = text; n && n !== svg; n = n.parentElement) for (const [sel, inner] of BOXES) if (n.matches(sel)) return n.querySelector(inner);
          return null;
        };
        const tol = 1.25;
        for (const p of list) {
          api.seek(p);
          const r = svg.getBoundingClientRect();
          const scale = Math.min(r.width / vb.width, r.height / vb.height);
          const vx = r.left + (r.width - vb.width * scale) / 2;
          const vy = r.top + (r.height - vb.height * scale) / 2;
          const view = { left: vx, top: vy, right: vx + vb.width * scale, bottom: vy + vb.height * scale };
          for (const text of svg.querySelectorAll('text')) {
            const label = text.textContent?.replace(/\s+/g, ' ').trim();
            if (!label || hidden(text) || opacity(text) < 0.5) continue;
            const b = text.getBoundingClientRect();
            const within = (box: { left: number; top: number; right: number; bottom: number }, what: string) => {
              if (b.left < box.left - tol || b.right > box.right + tol || b.top < box.top - tol || b.bottom > box.bottom + tol)
                out.push(`p=${p} "${label}" outside ${what} (${b.left.toFixed(1)},${b.top.toFixed(1)},${b.right.toFixed(1)},${b.bottom.toFixed(1)}) vs (${box.left.toFixed(1)},${box.top.toFixed(1)},${box.right.toFixed(1)},${box.bottom.toFixed(1)})`);
            };
            within(view, 'the drawing');
            const node = boxOf(text);
            if (node) within(node.getBoundingClientRect(), node.parentElement!.getAttribute('class') ?? 'node');
          }
        }
        api.seek(1);
        return out.slice(0, 12);
      }, sweep);
      expect(bad, `${s.id}: text out of bounds`).toEqual([]);
    }
  });

  test('representative frames and HTML text stay inside their cards', async ({ page }) => {
    await ready(page);
    for (const [i, s] of SERVICES.entries()) {
      await open(page, i);
      await settle(page);
      for (const p of FRAMES) {
        await seek(page, p);
        const bad = await page.locator(ROOT).evaluate((root, id) => {
          const out: string[] = [];
          const frame = root.querySelector('.sr3-frame')!.getBoundingClientRect();
          const panelEl = root.querySelector(`[data-service="${id}"]`)!;
          const items = root.querySelectorAll<HTMLElement>('h2, .sr3-heading p, .sr3-service-name, .sr3-price, .sr3-treatment, .sr3-note, .sr3-play, .sr3-play-label, .sr3-progress, .sr3-detail, .sr3-more, .sr3-after > *');
          for (const el of items) {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || (!r.width && !r.height) || !el.getClientRects().length) continue;
            const holder = el.closest('.sr3-panel');
            if (holder && holder !== panelEl && !holder.classList.contains('is-open') ) {
              const hb = holder.getBoundingClientRect();
              if (r.left < hb.left - 1 || r.right > hb.right + 1) out.push(`${el.className} leaves its closed card`);
              continue;
            }
            const box = (holder ?? root.querySelector('.sr3-frame')!).getBoundingClientRect();
            const lim = holder ? box : frame;
            if (r.left < lim.left - 1 || r.right > lim.right + 1) out.push(`${el.className || el.tagName} "${el.textContent?.trim().slice(0, 24)}" x ${r.left.toFixed(1)}-${r.right.toFixed(1)} vs ${lim.left.toFixed(1)}-${lim.right.toFixed(1)}`);
            if (cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1) out.push(`${el.className} clips its text`);
          }
          return out;
        }, s.id);
        expect(bad, `${s.id} @${p}`).toEqual([]);
      }
    }
    await noOverflow(page);
  });

  test('desktop: fine-pointer hover opens, click pins, grows in place over a darkened photo', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-1280', 'hover opens only for a fine pointer on desktop');
    await ready(page);
    const toggle = (id: string) => panel(page, id).locator('.sr3-toggle');
    const widths = () => page.locator(`${ROOT} .sr3-panel`).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));

    const closed = await widths();
    expect(Math.max(...closed) - Math.min(...closed)).toBeLessThanOrEqual(1);

    // The open card's body covers the toggle except its name strip, so aim at the strip (bottom-left).
    const stripAt = async (id: string) => {
      const b = (await toggle(id).boundingBox())!;
      return { x: 24, y: b.height - 24 };
    };
    await toggle('opinion').hover({ position: await stripAt('opinion') });
    await expect.poll(async () => (await state(page)).open).toBe(1);
    await expect(panel(page, 'opinion')).toHaveClass(/is-open/);
    await settle(page);
    const grown = await widths();
    expect(grown[1]).toBeGreaterThan(closed[1] * 1.8);
    expect(grown[1] / grown[0]).toBeGreaterThan(3.2);
    expect(grown[1] / grown[0]).toBeLessThan(3.7);
    expect(grown[0]).toBeLessThan(closed[0]);
    expect(await panel(page, 'opinion').locator('img').evaluate((img) => getComputedStyle(img).filter)).toContain('brightness(0.26)');
    expect(await page.evaluate(() => document.querySelector('[id="05-services"]')!.getBoundingClientRect().width)).toBeLessThanOrEqual(1280);

    // Leaving a hover-opened deck closes it again.
    await page.mouse.move(2, 2);
    await expect.poll(async () => (await state(page)).open).toBe(-1);

    // Hover, then click: the click pins the card (does not toggle it shut); a second click closes it.
    const strip = await stripAt('setup');
    await toggle('setup').hover({ position: strip });
    await expect.poll(async () => (await state(page)).open).toBe(0);
    await settle(page);
    await toggle('setup').click({ position: strip });
    expect((await state(page)).open).toBe(0);
    await page.mouse.move(2, 2);
    await frames(page);
    expect((await state(page)).open).toBe(0);
    await toggle('setup').click({ position: strip });
    await expect.poll(async () => (await state(page)).open).toBe(-1);
    await expect(toggle('setup')).toHaveAttribute('aria-expanded', 'false');

    // A plain click opens another card; the open card swaps, never two at once.
    await toggle('build').click();
    await expect.poll(async () => (await state(page)).open).toBe(2);
    await toggle('workshop').click();
    await expect.poll(async () => (await state(page)).open).toBe(3);
    await expect(page.locator(`${ROOT} .sr3-panel.is-open`)).toHaveCount(1);
  });

  test.describe('touch', () => {
    test.use({ hasTouch: true });
    test('a tap opens a card and a second tap closes it; hover alone never opens', async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile-375', 'touch is the phone project');
      await ready(page);
      const toggle = (id: string) => panel(page, id).locator('.sr3-toggle');
      await toggle('opinion').tap();
      await expect.poll(async () => (await state(page)).open).toBe(1);
      await expect(toggle('opinion')).toHaveAttribute('aria-expanded', 'true');
      await expect(panel(page, 'opinion').locator('.sr3-body')).toBeVisible();
      await toggle('opinion').tap();
      await expect.poll(async () => (await state(page)).open).toBe(-1);
      await toggle('workshop').tap();
      await expect.poll(async () => (await state(page)).open).toBe(3);
      await noOverflow(page);
    });
  });

  test('keyboard: Enter and Space toggle, Escape closes and restores focus to the card', async ({ page }) => {
    await ready(page);
    const toggle = (id: string) => panel(page, id).locator('.sr3-toggle');
    const focusedIs = (id: string) => page.evaluate((s) => document.activeElement === document.querySelector(`[id="05-services"] [data-service="${s}"] .sr3-toggle`), id);

    await toggle('setup').focus();
    await page.keyboard.press('Enter');
    expect((await state(page)).open).toBe(0);
    await expect(toggle('setup')).toHaveAttribute('aria-expanded', 'true');
    expect(await focusedIs('setup')).toBe(true);

    // Escape from deep inside the open card: focus comes back to that card's own button.
    await panel(page, 'setup').locator('.sr3-scrub').focus();
    await page.keyboard.press('Escape');
    expect((await state(page)).open).toBe(-1);
    await expect(toggle('setup')).toHaveAttribute('aria-expanded', 'false');
    expect(await focusedIs('setup')).toBe(true);

    await page.keyboard.press('Space');
    expect((await state(page)).open).toBe(0);
    await page.keyboard.press('Space');
    expect((await state(page)).open).toBe(-1);

    // Opening another card while focus sits in the first one's body moves focus to a button that still exists.
    await toggle('setup').focus();
    await page.keyboard.press('Enter');
    await panel(page, 'setup').locator('.sr3-play').focus();
    await page.evaluate(() => document.querySelector('[id="05-services"]')!.__services!.open(2));
    expect(await focusedIs('setup')).toBe(true);
    expect((await state(page)).open).toBe(2);
    await expect(panel(page, 'setup').locator('.sr3-body')).toBeHidden();

    // Tab order inside the open card reaches the play button, scrubber and disclosure.
    await toggle('build').focus();
    await page.keyboard.press('Tab');
    const next = await page.evaluate(() => (document.activeElement as HTMLElement).className);
    expect(next).toMatch(/sr3-play|sr3-toggle/);
  });

  test('pause, scrub and replay; seek is deterministic; pauses offscreen, hidden and closed', async ({ page }) => {
    await ready(page);
    // Playback only starts while the card's artwork is on screen.
    await panel(page, 'setup').scrollIntoViewIfNeeded();
    await open(page, 0);
    const playBtn = panel(page, 'setup').locator('.sr3-play');
    await expect.poll(async () => (await state(page)).running).toBe(true);
    await expect(playBtn).toHaveAttribute('data-mode', 'pause');
    await expect(playBtn).toHaveText('Pause');

    // The 9 s sequence never runs faster than 1/9000 per ms; a slow frame is clamped, so it may only lag
    // (poll two progress marks, no fixed sleeps).
    await page.waitForFunction(() => document.querySelector('[id="05-services"]')!.__services!.state().openProgress! > 0.03);
    const a = await page.evaluate(() => [performance.now(), document.querySelector('[id="05-services"]')!.__services!.state().openProgress!]);
    await page.waitForFunction(() => document.querySelector('[id="05-services"]')!.__services!.state().openProgress! > 0.12);
    const b = await page.evaluate(() => [performance.now(), document.querySelector('[id="05-services"]')!.__services!.state().openProgress!]);
    const perSecond = ((b[1] - a[1]) / (b[0] - a[0])) * 1000;
    expect(perSecond).toBeGreaterThan(1 / 9 / 4);
    expect(perSecond).toBeLessThan((1 / 9) * 1.5);

    // Pause holds the frame and cancels the frame request.
    await playBtn.click();
    await expect(playBtn).toHaveAttribute('data-mode', 'play');
    const held = await state(page);
    expect(held.running).toBe(false);
    expect(held.framePending).toBe(false);
    await frames(page, 4);
    expect((await state(page)).openProgress).toBe(held.openProgress);

    // The native scrubber lands on exact frames, forwards and backwards.
    const scrub = panel(page, 'setup').locator('.sr3-scrub');
    await scrub.fill('50');
    expect((await state(page)).openProgress).toBeCloseTo(0.5, 5);
    await expect(panel(page, 'setup').locator('.sr3-progress')).toHaveText('50%');
    await expect(scrub).toHaveAttribute('aria-valuetext', '50% complete');
    const snapshot = () => panel(page, 'setup').locator('.sr3-svg:visible').evaluate((svg) => svg.outerHTML);
    const half = await snapshot();
    await seek(page, 1);
    expect(await snapshot()).not.toBe(half);
    await scrub.fill('50');
    expect(await snapshot(), 'scrubbing back to 50% repaints the identical frame').toBe(half);
    await expect(scrub).toHaveAttribute('aria-valuetext', '50% complete');

    // Complete: the one control becomes Replay, and Replay restarts from zero.
    await seek(page, 1);
    await expect(playBtn).toHaveAttribute('data-mode', 'replay');
    await expect(playBtn).toHaveText('Replay');
    await playBtn.click();
    await expect.poll(async () => (await state(page)).running).toBe(true);
    await expect(playBtn).toHaveAttribute('data-mode', 'pause');
    expect((await state(page)).openProgress).toBeLessThan(0.5);

    // Offscreen: no frames; back on screen: it carries on from where it was.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(async () => (await state(page)).running).toBe(false);
    expect((await state(page)).framePending).toBe(false);
    await page.evaluate(() => document.querySelector('[id="05-services"]')!.scrollIntoView({ block: 'start' }));
    await expect.poll(async () => (await state(page)).running).toBe(true);

    // Hidden document: no frames.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect((await state(page)).running).toBe(false);
    expect((await state(page)).framePending).toBe(false);
    await page.evaluate(() => {
      delete (document as unknown as { hidden?: boolean }).hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(async () => (await state(page)).running).toBe(true);

    // Closed: no frames, no running card.
    await open(page, -1);
    const closed = await state(page);
    expect(closed.open).toBe(-1);
    expect(closed.running).toBe(false);
    expect(closed.framePending).toBe(false);

    // The section detail disclosures (More buttons) are real, keyboard-reachable toggles.
    const more = panel(page, 'setup').locator('.sr3-more');
    await open(page, 0);
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await expect(panel(page, 'setup').locator('.sr3-detail')).toBeHidden();
    await more.click();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(panel(page, 'setup').locator('.sr3-detail')).toContainText('One AI workflow or assistant on the tools you already use.');
    await expect(panel(page, 'setup').locator('.sr3-detail')).toContainText('Local or private AI is included');
    const sectionMore = page.locator(`${ROOT} .sr3-section-more`);
    await expect(sectionMore).toHaveAttribute('aria-expanded', 'false');
    await sectionMore.click();
    await expect(page.locator(`${ROOT} .sr3-section-detail`)).toContainText('Which fits?');
  });

  test('destroy cancels frames and leaves readable final HTML', async ({ page }) => {
    await ready(page);
    await panel(page, 'opinion').scrollIntoViewIfNeeded();
    await open(page, 1);
    await expect.poll(async () => (await state(page)).running).toBe(true);
    await page.evaluate(() => document.querySelector('[id="05-services"]')!.__services!.destroy());
    expect(await page.evaluate(() => !!document.querySelector('[id="05-services"]')!.__services)).toBe(false);
    const after = await page.locator(ROOT).evaluate((root) => ({
      ready: root.classList.contains('sr3-ready'),
      hiddenBodies: [...root.querySelectorAll<HTMLElement>('.sr3-body')].filter((b) => b.hidden).length,
      controls: [...root.querySelectorAll<HTMLElement>('.sr3-controls')].every((c) => c.hidden),
    }));
    expect(after).toEqual({ ready: false, hiddenBodies: 0, controls: true });
    for (const s of SERVICES) await expect(panel(page, s.id).locator('.sr3-body')).toBeVisible();
  });

  test.describe('reduced motion', () => {
    test('renders the complete state with no frames; the scrubber still works', async ({ page }) => {
      await reducedMotion(page);
      const errors = noConsoleErrors(page);
      await ready(page);
      expect((await state(page)).reduced).toBe(true);
      for (const [i, s] of SERVICES.entries()) {
        await open(page, i);
        const st = await state(page);
        expect(st.openProgress, `${s.id} opens complete`).toBe(1);
        expect(st.running).toBe(false);
        expect(st.framePending).toBe(false);
        await expect(panel(page, s.id).locator('.sr3-play')).toBeDisabled();
      }
      const before = (await state(page)).paintCounts;
      await frames(page, 4);
      const after = await state(page);
      expect(after.paintCounts, 'nothing repaints without frames').toEqual(before);
      expect(after.framePending).toBe(false);

      await panel(page, 'workshop').locator('.sr3-scrub').fill('40');
      const scrubbed = await state(page);
      expect(scrubbed.openProgress).toBeCloseTo(0.4, 5);
      expect(scrubbed.running).toBe(false);
      expect(scrubbed.framePending).toBe(false);
      await frames(page, 3);
      expect((await state(page)).openProgress).toBeCloseTo(0.4, 5);
      // No CSS animation or transition survives either.
      const motion = await panel(page, 'workshop').locator('.sr3-body').evaluate((el) => [getComputedStyle(el).animationName, getComputedStyle(el.closest('.sr3-panel')!).transitionDuration]);
      expect(motion[0]).toBe('none');
      expect(parseFloat(motion[1])).toBe(0);
      errors.assertNone();
    });
  });

  test.describe('no JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('all four photos, final diagrams and service lines are readable', async ({ page }) => {
      await page.goto('/', { waitUntil: 'load' });
      await page.locator(ROOT).scrollIntoViewIfNeeded();
      const lines = [
        'One AI workflow or assistant on the tools you already use.',
        'Bigger setups are quoted. Local or private AI is included; you buy the hardware directly, at cost.',
        'One small app or critical flow, written findings, in three days.',
        'After the diagnostic.',
        'Two hours, up to ten people.',
      ];
      await expect(page.locator(`${ROOT} .sr3-panel`)).toHaveCount(4);
      for (const s of SERVICES) {
        const p = panel(page, s.id);
        await p.scrollIntoViewIfNeeded();
        await expect(p.locator('.sr3-toggle')).toContainText(s.name);
        await expect(p.locator('.sr3-body')).toBeVisible();
        await expect(p.locator('.sr3-note')).toHaveText('Illustration · sample data');
        await expect(p.locator('.sr3-controls')).toBeHidden();
        await expect(p.locator('.sr3-more')).toBeHidden();
        await expect(p.locator('.sr3-detail')).toBeVisible();
        await expect(p.locator('.sr3-svg:visible')).toHaveCount(1);
        expect(await p.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      }
      for (const line of lines) await expect(page.locator(`${ROOT} .sr3-detail`).filter({ hasText: line }).first()).toBeVisible();
      await expect(page.locator(`${ROOT} .sr3-section-detail`)).toContainText('Which fits?');
      // Final frames: finished scene text is present and every packet/leaving element is already gone.
      const finals = await page.locator(ROOT).evaluate((root) => {
        const text = (id: string) => [...root.querySelectorAll(`[data-service="${id}"] .sr3-svg[data-layout="wide"] text`)].map((t) => t.textContent!.trim());
        const packets = [...root.querySelectorAll('.sr3-packet')].every((p) => p.getAttribute('opacity') === '0');
        const leave = [...root.querySelectorAll('[data-leave]')].every((p) => p.getAttribute('opacity') === '0');
        return { setup: text('setup'), opinion: text('opinion'), build: text('build'), workshop: text('workshop'), packets, leave };
      });
      expect(finals.setup).toEqual(expect.arrayContaining(['HubSpot', 'Google Sheets', 'Zapier', 'AI workflow', 'Local AI', 'Assistant', 'Thanks, got it.', '12:04:04']));
      expect(finals.opinion).toEqual(expect.arrayContaining(['Written findings', 'ready', 'Permissions', 'Field mappings', 'Error paths', 'note · ready']));
      expect(finals.build).toEqual(expect.arrayContaining(['app · custom build', 'ready', 'done', 'Critical flow', 'Fields', 'Navigation']));
      expect(finals.workshop).toEqual(expect.arrayContaining(['sample run · done', 'Web form', 'HubSpot', 'Email', 'remind on', 'Friday']));
      expect(finals.packets && finals.leave).toBe(true);
      await noOverflow(page);
    });
  });
});
