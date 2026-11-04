/** True when the reader asked the OS for less motion. */
export const reducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** What a section's init may hand back: something to tear down, or nothing. */
export type Handle = { destroy(): void } | null | void;
type Init = (root: Element) => Handle;

/**
 * A scheduled section, kept on its root as `root.__island`. `mount()` runs init now instead of waiting for the
 * viewport; a second call while mounted does nothing. `destroy()` cancels whatever is still pending (observers,
 * the scroll listener, an in-flight import) and tears down what init returned; `mount()` brings it back.
 */
export interface Island {
  mount(): void;
  destroy(): void;
}
type IslandRoot = Element & { __island?: Island };

/**
 * Run `init(root)` the first time `root` is near the viewport, then stop observing.
 * Falls back to an immediate call without IntersectionObserver or with reduced motion,
 * so the section renders its final state instead of staying hidden.
 * A root that is already scheduled keeps its island: a second call returns it.
 */
export function onVisible(root: Element | null, init: Init): Island | null {
  return schedule(root, init);
}

// How far ahead of the viewport a lazy island starts downloading its code, once the reader scrolls.
const FETCH_AHEAD = '0px 0px 100% 0px';

/**
 * onVisible for a section whose code is its own chunk. `load` (a dynamic import) starts once the reader has
 * scrolled and the section is within a screen below the viewport; init still runs at the onVisible point.
 * The first screen therefore never waits on below-the-fold code. Without IntersectionObserver or with reduced
 * motion the chunk loads and runs at once, as onVisible does. If the chunk fails to load, the section keeps
 * its static markup.
 */
export function lazyIsland(root: Element | null, load: () => Promise<Init>): Island | null {
  return schedule(root, null, load);
}

function schedule(root: Element | null, sync: Init | null, load?: () => Promise<Init>): Island | null {
  if (!root) return null;
  const host = root as IslandRoot;
  if (host.__island) return host.__island;

  let started = false;
  // Bumped by destroy(), so an import that lands afterwards runs nothing.
  let gen = 0;
  let handle: Handle = null;
  let chunk: Promise<Init | null> | undefined;
  const fetch = (): Promise<Init | null> => (chunk ??= load!().catch(() => null));

  let near: IntersectionObserver | undefined;
  let ahead: IntersectionObserver | undefined;
  const arm = (): void => ahead?.observe(root);
  const stop = (): void => {
    removeEventListener('scroll', arm);
    near?.disconnect();
    ahead?.disconnect();
  };

  const run = (): void => {
    if (started) return;
    started = true;
    stop();
    const now = gen;
    const go = (init: Init | null): void => {
      if (now === gen && init) handle = init(root);
    };
    if (sync) go(sync);
    else void fetch().then(go);
  };

  const island: Island = {
    mount: run,
    destroy() {
      stop();
      gen++;
      started = false;
      handle?.destroy();
      handle = null;
    },
  };
  host.__island = island;

  if (typeof IntersectionObserver !== 'function' || reducedMotion()) {
    run();
    return island;
  }

  near = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) run();
    },
    { threshold: 0.01, rootMargin: '0px 0px -10% 0px' },
  );
  near.observe(root);
  if (load) {
    ahead = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        ahead?.disconnect();
        void fetch();
      },
      { rootMargin: FETCH_AHEAD },
    );
    addEventListener('scroll', arm, { once: true, passive: true });
  }
  return island;
}
