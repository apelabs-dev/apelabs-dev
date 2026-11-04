import { expect, type Page } from '@playwright/test';

/**
 * Assert the page does not scroll sideways: the document fits the viewport and no visible
 * element's right edge sits more than 1px past it.
 */
export async function noOverflow(page: Page): Promise<void> {
  const report = await page.evaluate(() => {
    const viewport = window.innerWidth;
    let worst = 0;
    let worstElement = '';

    for (const element of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;

      const over = rect.right - viewport;
      if (over <= worst) continue;

      worst = over;
      const id = element.id ? `#${element.id}` : '';
      const cls =
        typeof element.className === 'string' && element.className.trim()
          ? `.${element.className.trim().split(/\s+/).join('.')}`
          : '';
      worstElement = `${element.tagName.toLowerCase()}${id}${cls}`;
    }

    return { scrollWidth: document.documentElement.scrollWidth, viewport, worst, worstElement };
  });

  expect(report.scrollWidth, `document scrollWidth ${report.scrollWidth} > viewport ${report.viewport}`).toBeLessThanOrEqual(
    report.viewport + 1,
  );
  expect(report.worst, `element ${report.worstElement} overflows the viewport by ${report.worst}px`).toBeLessThanOrEqual(1);
}

/**
 * Collect console errors and uncaught page errors from this point on. The spec asserts the
 * returned list is empty at the end of the test.
 */
export function noConsoleErrors(page: Page) {
  const errors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${error.message}`);
  });

  return {
    errors,
    assertNone(): void {
      expect(errors, errors.join('\n')).toEqual([]);
    },
  };
}

/** Install the reduced-motion preference before the spec navigates. */
export async function reducedMotion(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
}
