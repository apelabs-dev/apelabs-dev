import { expect, test, type Page } from '@playwright/test';
import { noConsoleErrors } from './helpers';

// Island lifecycle: a section mounts once, destroy() releases only what it created, it can be mounted again, a
// pending mount can be cancelled, and a chunk that fails to load leaves the static markup with no errors.
// Also the real tap targets of the rail and the footer: elementFromPoint at their edges, and focus order.
const JOURNEY = '[id="04-journey"]';

type IslandEl = HTMLElement & { __island?: { mount(): void; destroy(): void }; __journey?: unknown };

// Count what the page has live: per observer kind, the connected observers watching a node inside a given
// element (wrapped before any page script runs, so siblings' observers are not counted), and unhandled
// promise rejections.
async function instrument(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const live = new Map<string, Map<object, Set<Node>>>();
    for (const kind of ['IntersectionObserver', 'ResizeObserver', 'MutationObserver'] as const) {
      const p = (window[kind] as unknown as { prototype: { observe: Function; disconnect: Function } }).prototype;
      const map = new Map<object, Set<Node>>();
      live.set(kind, map);
      const observe = p.observe;
      const disconnect = p.disconnect;
      p.observe = function (this: object, t: Node, ...rest: unknown[]) {
        map.set(this, (map.get(this) ?? new Set()).add(t));
        return observe.call(this, t, ...rest);
      };
      p.disconnect = function (this: object) {
        map.delete(this);
        return disconnect.call(this);
      };
    }
    const rejections: string[] = [];
    addEventListener('unhandledrejection', (e) => rejections.push(String(e.reason)));
    Object.assign(window, {
      __obs: (within: Element) =>
        Object.fromEntries(
          [...live].map(([k, m]) => [k, [...m.values()].filter((ts) => [...ts].some((t) => within.contains(t))).length]),
        ),
      __rejections: rejections,
    });
  });
}

// Event listeners on document and window, by type, from the DevTools protocol (signal-removed ones are gone).
async function listeners(page: Page): Promise<Record<string, number>> {
  const cdp = await page.context().newCDPSession(page);
  const out: Record<string, number> = {};
  for (const target of ['document', 'window']) {
    const { result } = await cdp.send('Runtime.evaluate', { expression: target });
    const { listeners: ls } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId! });
    for (const l of ls) out[`${target}:${l.type}`] = (out[`${target}:${l.type}`] ?? 0) + 1;
  }
  await cdp.detach();
  return out;
}

async function snapshot(page: Page) {
  const dom = await page.evaluate((sel) => {
    const root = document.querySelector<IslandEl>(sel)!;
    return {
      live: root.classList.contains('jr-live'),
      notes: root.classList.contains('cx-live'),
      handle: !!root.__journey,
      pins: document.querySelectorAll('.pin-spacer').length,
      pinsInJourney: root.querySelectorAll('.pin-spacer').length,
      obs: (window as unknown as { __obs(within: Element): Record<string, number> }).__obs(root),
    };
  }, JOURNEY);
  return { ...dom, listeners: await listeners(page) };
}

async function mountJourney(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.mouse.move(1, 200);
  await page.mouse.wheel(0, 200);
  await page.locator(JOURNEY).scrollIntoViewIfNeeded();
  await expect(page.locator(`${JOURNEY}.jr-live`)).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(400);
}

const island = (page: Page, sel: string, op: 'mount' | 'destroy') =>
  page.locator(sel).evaluate((el, o) => (el as IslandEl).__island![o](), op);

test.describe('island lifecycle', () => {
  test('journey: mount is idempotent, destroy releases its own resources, remount restores them', async ({ page }) => {
    const errors = noConsoleErrors(page);
    await instrument(page);
    await mountJourney(page);
    const a = await snapshot(page);
    expect(a.live && a.notes && a.handle).toBe(true);

    // A second and third mount while mounted: nothing new.
    await island(page, JOURNEY, 'mount');
    await island(page, JOURNEY, 'mount');
    await page.waitForTimeout(300);
    expect(await snapshot(page)).toEqual(a);

    // Destroy: the pin, the listeners and the observers this init made are gone; nothing else is touched.
    await island(page, JOURNEY, 'destroy');
    await page.waitForTimeout(300);
    const d = await snapshot(page);
    expect(d).toMatchObject({ live: false, notes: false, handle: false, pinsInJourney: 0 });
    expect(d.pins).toBe(a.pins - a.pinsInJourney);
    expect(d.listeners['document:click'] ?? 0).toBe((a.listeners['document:click'] ?? 0) - 1);
    expect(d.listeners['window:scrollend'] ?? 0).toBe((a.listeners['window:scrollend'] ?? 0) - 1);
    // Nothing left watching the section (the island's own observers were disconnected when it mounted).
    expect(d.obs).toEqual({ IntersectionObserver: 0, ResizeObserver: 0, MutationObserver: 0 });
    expect(a.obs.IntersectionObserver).toBeGreaterThan(0);
    // Late work scheduled by the old mount (fonts, scrollend, resize) must not wake it.
    await page.evaluate(() => dispatchEvent(new Event('resize')));
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(400);
    expect(await page.locator(JOURNEY).evaluate((el) => el.classList.contains('jr-live'))).toBe(false);

    // Remount: back to exactly what one mount owns, at the same scroll position.
    await page.locator(JOURNEY).scrollIntoViewIfNeeded();
    await island(page, JOURNEY, 'mount');
    await expect(page.locator(`${JOURNEY}.jr-live`)).toHaveCount(1);
    await page.waitForTimeout(400);
    const r = await snapshot(page);
    expect(r.listeners).toEqual(a.listeners);
    expect(r.obs).toEqual(a.obs);
    expect(r.pins).toBe(a.pins);
    expect(await page.evaluate(() => (window as unknown as { __rejections: string[] }).__rejections)).toEqual([]);
    errors.assertNone();
  });

  test('a pending island cancelled before it is reached never loads or mounts', async ({ page }) => {
    const errors = noConsoleErrors(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    const before = new Set(await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name)));
    for (const sel of [JOURNEY, '[id="05-services"]', '[id="06-proof"]']) await island(page, sel, 'destroy');
    // Scroll the whole page: nothing that was cancelled wakes up, and no section chunk is fetched.
    for (let i = 0; i < 40; i++) await page.mouse.wheel(0, 600), await page.waitForTimeout(40);
    await page.waitForTimeout(800);
    const state = await page.evaluate(() => ({
      journey: document.querySelector('[id="04-journey"]')!.classList.contains('jr-live'),
      services: !!(document.querySelector('[id="05-services"]') as HTMLElement & { __services?: unknown }).__services,
      proof: document.querySelector('[id="06-proof"]')!.getAttribute('data-proof-mounted'),
    }));
    expect(state).toEqual({ journey: false, services: false, proof: null });
    const fetched = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name));
    expect(fetched.filter((u) => !before.has(u) && u.endsWith('.js'))).toEqual([]);
    errors.assertNone();
  });

  test('section chunks that fail to load leave the static markup, with no unhandled errors', async ({ page }) => {
    const errors = noConsoleErrors(page);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await instrument(page);
    // Everything the first screen loads is allowed; any script requested later (the section chunks) fails.
    let ready = false;
    await page.route('**/_astro/*.js', (route) => (ready ? route.abort('failed') : route.continue()));
    await page.goto('/', { waitUntil: 'networkidle' });
    ready = true;
    for (let i = 0; i < 40; i++) await page.mouse.wheel(0, 600), await page.waitForTimeout(40);
    await page.waitForTimeout(1000);
    const state = await page.evaluate(() => ({
      journey: document.querySelector('[id="04-journey"]')!.classList.contains('jr-live'),
      services: !!(document.querySelector('[id="05-services"]') as HTMLElement & { __services?: unknown }).__services,
      proof: document.querySelector('[id="06-proof"]')!.getAttribute('data-proof-mounted'),
      rejections: (window as unknown as { __rejections: string[] }).__rejections,
      steps: document.querySelectorAll('[id="04-journey"] .jr-step').length,
    }));
    expect(state).toMatchObject({ journey: false, services: false, proof: null, rejections: [], steps: 7 });
    expect(pageErrors).toEqual([]);
    // The aborted requests themselves log a network error; nothing else may.
    expect(errors.errors.filter((e) => !/Failed to load resource|ERR_FAILED/.test(e))).toEqual([]);
  });
});

test.describe('tap targets', () => {
  test('journey rail: seven ≥44px buttons that own their edges, in step order', async ({ page }, testInfo) => {
    await mountJourney(page);
    const rail = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLButtonElement>('.jx-rail button')].map((b) => {
        const r = b.getBoundingClientRect();
        const at = (x: number, y: number) => document.elementFromPoint(x, y)?.closest('button') === b;
        const my = r.top + r.height / 2;
        const mx = r.left + r.width / 2;
        return {
          w: r.width,
          h: r.height,
          left: r.left,
          right: r.right,
          edges: [at(r.left + 1, my), at(r.right - 1, my), at(mx, r.top + 1), at(mx, r.bottom - 1)],
        };
      }),
    );
    expect(rail).toHaveLength(7);
    for (const b of rail) {
      expect(b.w).toBeGreaterThanOrEqual(44);
      expect(b.h).toBeGreaterThanOrEqual(44);
      expect(b.edges).toEqual([true, true, true, true]);
    }
    // Side by side, none overlapping, all on screen.
    for (let i = 1; i < 7; i++) expect(rail[i].left).toBeGreaterThanOrEqual(rail[i - 1].right - 0.5);
    expect(rail[0].left).toBeGreaterThanOrEqual(0);
    expect(rail[6].right).toBeLessThanOrEqual(testInfo.project.use.viewport!.width + 0.5);

    // Focus order: Tab walks the rail 00 → 06.
    await page.locator('.jx-rail button[data-jr-go="0"]').focus();
    const order: string[] = [];
    for (let i = 0; i < 7; i++) {
      order.push(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.jrGo ?? ''));
      await page.keyboard.press('Tab');
    }
    expect(order).toEqual(['0', '1', '2', '3', '4', '5', '6']);
  });

  test('footer: each link owns a ≥44px hit area that no other link takes, in reading order', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.locator('footer').scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const links = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLAnchorElement>('footer a[href]')].map((a) => {
        const r = a.getBoundingClientRect();
        const own = (x: number, y: number) => document.elementFromPoint(x, y)?.closest('a') === a;
        // The real extent along the centre lines, scanned point by point.
        const scan = (from: number, to: number, at: (v: number) => boolean) => {
          let lo = NaN;
          let hi = NaN;
          for (let v = from; v <= to; v += 0.5) if (at(v)) (lo = Number.isNaN(lo) ? v : lo), (hi = v);
          return hi - lo + 0.5;
        };
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        return {
          href: a.getAttribute('href'),
          tall: scan(r.top - 40, r.bottom + 40, (y) => own(cx, y)),
          wide: scan(r.left - 40, r.right + 40, (x) => own(x, cy)),
        };
      }),
    );
    expect(links.map((l) => l.href)).toEqual([
      '#top',
      'mailto:hello@apelabs.dev',
      '#04-journey',
      '#05-services',
      '#06-proof',
      '#jr-diagnostic',
      '#07-faq',
    ]);
    for (const l of links) {
      expect(l.tall, `${l.href} height`).toBeGreaterThanOrEqual(44);
      expect(l.wide, `${l.href} width`).toBeGreaterThanOrEqual(44);
    }

    // Focus order follows the reading order.
    await page.locator('footer a[href="#top"]').focus();
    const order: string[] = [];
    for (let i = 0; i < links.length; i++) {
      order.push(await page.evaluate(() => document.activeElement?.getAttribute('href') ?? ''));
      await page.keyboard.press('Tab');
    }
    expect(order).toEqual(links.map((l) => l.href));
  });
});
