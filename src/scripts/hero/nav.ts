// Nav: the mobile sheet. Without JS the menu button is a plain link to the footer, which lists every
// page link; with JS it opens a full-height sheet. The sheet is a fixed panel rather than a modal
// <dialog>, so it behaves the same in a sandboxed frame: the rest of the page goes inert while it is
// open, Tab wraps inside it, and Esc or the close button returns focus to the menu button.

export interface NavHandle {
  destroy(): void;
}

const FOCUSABLE = 'a[href], button:not([disabled])';
const NOT_CONTENT = /^(SCRIPT|STYLE|TEMPLATE|LINK|META)$/;

/**
 * Make everything outside the sheet inert: at every level from the sheet up to <body>, each sibling of
 * the branch the sheet sits on. This holds wherever the nav lives in the document (a direct child of
 * <body> or nested in <main>) and never inerts the sheet or one of its ancestors. Returns what it changed.
 */
function inertAround(sheet: HTMLElement): HTMLElement[] {
  const changed: HTMLElement[] = [];
  let branch: HTMLElement = sheet;
  while (branch !== document.body && branch.parentElement) {
    const parent: HTMLElement = branch.parentElement;
    for (const sibling of Array.from(parent.children)) {
      if (sibling === branch || !(sibling instanceof HTMLElement)) continue;
      if (sibling.inert || NOT_CONTENT.test(sibling.tagName)) continue;
      sibling.inert = true;
      changed.push(sibling);
    }
    branch = parent;
  }
  return changed;
}

export function initNav(root: Element): NavHandle | null {
  const menu = root.querySelector<HTMLElement>('.menu');
  const trigger = root.querySelector<HTMLElement>('.bar-menu');
  const closeButton = menu?.querySelector<HTMLElement>('.menu-close');
  if (!menu || !trigger || !closeButton) return null;

  const ac = new AbortController();
  const on = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement | Document,
    type: K,
    handler: (event: HTMLElementEventMap[K]) => void,
  ): void => target.addEventListener(type, handler as EventListener, { signal: ac.signal });
  let inerted: HTMLElement[] = [];

  trigger.setAttribute('role', 'button');
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');

  const focusables = (): HTMLElement[] => Array.from(menu.querySelectorAll<HTMLElement>(FOCUSABLE));

  function open(): void {
    if (!menu || !menu.hidden) return;
    menu.hidden = false;
    trigger?.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('menu-open');
    inerted = inertAround(menu);
    closeButton?.focus();
  }

  function close({ restore = true } = {}): void {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    trigger?.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('menu-open');
    for (const el of inerted) el.inert = false;
    inerted = [];
    if (restore) trigger?.focus();
  }

  on(trigger, 'click', (event) => {
    event.preventDefault();
    open();
  });
  // A link with role="button" should also answer to Space.
  on(trigger, 'keydown', (event) => {
    if (event.key !== ' ') return;
    event.preventDefault();
    open();
  });
  on(closeButton, 'click', () => close());

  // Escape and the Tab wrap are on the document, so they hold even after a click on the sheet's padding
  // moved focus to <body>.
  on(document, 'keydown', (event) => {
    if (menu.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const list = focusables();
    const first = list[0];
    const lastItem = list[list.length - 1];
    const active = document.activeElement;
    if (!menu.contains(active)) {
      event.preventDefault();
      (event.shiftKey ? lastItem : first)?.focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      lastItem?.focus();
    } else if (!event.shiftKey && active === lastItem) {
      event.preventDefault();
      first?.focus();
    }
  });

  // Following a link closes the sheet first; the browser then scrolls to the target.
  for (const link of menu.querySelectorAll<HTMLElement>('a[href]')) on(link, 'click', () => close({ restore: false }));

  const wide = matchMedia('(min-width: 1024px)');
  const onWide = (): void => {
    if (wide.matches) close({ restore: false });
  };
  wide.addEventListener('change', onWide, { signal: ac.signal });

  return {
    destroy() {
      close({ restore: false });
      ac.abort();
    },
  };
}
