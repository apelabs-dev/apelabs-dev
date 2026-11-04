// Journey engine: a walk through the repair steps, driven by scroll. There is nothing to press: every state is
// a step, and the reader reaches each one by scrolling to it. The rail's buttons scroll to a step; they never
// change the story on their own.
//
// The engine only sets state on the root: data-step (0…n) and data-scene (one scene per step), plus .jr-live
// (the enhanced layout) and .jr-off (scrolled away: animations paused). The look of every state is CSS, or the
// renderer. With reduced motion the scroll-driven layout stays (state changes land instantly). Without JS the
// markup's own state shows (step 06, the verified board).

export interface Renderer {
  set(scene: string, info: { step: number; prev: string | null; instant: boolean }): void;
  pause(): void;
  resume(): void;
}

export interface JourneyOptions {
  reduced: boolean;
  scenes: string[];
  /** The step band as an IntersectionObserver rootMargin; read again on resize. */
  band: () => string;
  /** Scroll so `el` is the step in view. */
  scrollTo: (el: Element) => void;
  focus: (el: HTMLElement) => void;
  renderer?: Renderer;
  onStep?: (n: number) => void;
}

export interface Journey {
  state(): { step: number; scene: string | undefined };
  destroy(): void;
}

export function createJourney(root: HTMLElement, opts: JourneyOptions): Journey {
  const { reduced, scenes, renderer } = opts;
  const ac = new AbortController();
  const signal = ac.signal;

  const steps = [...root.querySelectorAll<HTMLElement>('.jr-step')];
  const goBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-jr-go]')];

  let step = 0;
  let drawn: string | null = null; // the scene the renderer last drew

  // ------------------------------------------------------------------ state → attributes

  function paint(): void {
    const scene = scenes[step] ?? scenes[scenes.length - 1];
    if (root.dataset.scene !== scene) {
      root.dataset.scene = 'none';
      void root.offsetWidth; // restart the scene's CSS animations
      root.dataset.scene = scene;
    }
    root.dataset.step = String(step);
    steps.forEach((el, i) => el.classList.toggle('is-active', i === step));
    goBtns.forEach((b) =>
      Number(b.dataset.jrGo) === step ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current'),
    );
    if (renderer && scene !== drawn) {
      renderer.set(scene, { step, prev: drawn, instant: reduced || drawn == null });
      drawn = scene;
    }
  }

  function setStep(n: number): void {
    n = Math.max(0, Math.min(steps.length - 1, n));
    if (n === step) return;
    step = n;
    paint();
    opts.onStep?.(step);
  }

  // ------------------------------------------------------------------ going to a step

  // While a scroll we started is running, scroll-driven step changes wait, so the board doesn't flash through
  // every step in between. Released on scrollend (or after a timeout).
  let hold = false;
  let holdTimer = 0;
  function release(): void {
    clearTimeout(holdTimer);
    hold = false;
  }

  function reveal(n: number): void {
    const el = steps[n];
    if (!el) return;
    hold = true;
    clearTimeout(holdTimer);
    holdTimer = window.setTimeout(release, reduced ? 120 : 1400);
    opts.scrollTo(el);
    setStep(n);
  }

  root.addEventListener(
    'click',
    (e) => {
      const b = (e.target as Element | null)?.closest<HTMLButtonElement>('button[data-jr-go]');
      if (!b || !root.contains(b)) return;
      const n = Number(b.dataset.jrGo);
      reveal(n);
      const name = steps[n]?.querySelector<HTMLElement>('.jr-name');
      if (name) opts.focus(name);
    },
    { signal },
  );

  // ------------------------------------------------------------------ scroll → step

  // The step crossing a thin band is current. The root is the document itself (an implicit root ignores
  // rootMargin in a cross-origin frame).
  let bandIO: IntersectionObserver | null = null;
  let bandNow = '';
  function watchBand(): void {
    const margin = opts.band();
    if (bandIO && margin === bandNow) return;
    bandIO?.disconnect();
    bandNow = margin;
    bandIO = new IntersectionObserver(
      (entries) => {
        if (hold) return;
        for (const en of entries) if (en.isIntersecting) setStep(steps.indexOf(en.target as HTMLElement));
      },
      { root: document, rootMargin: margin },
    );
    steps.forEach((el) => bandIO!.observe(el));
  }

  // Pause the board's loops while the section is off screen.
  const vio = new IntersectionObserver(([en]) => {
    root.classList.toggle('jr-off', !en.isIntersecting);
    if (renderer) en.isIntersecting ? renderer.resume() : renderer.pause();
  });
  vio.observe(root);

  root.classList.add('jr-live');
  watchBand();
  window.addEventListener('resize', watchBand, { passive: true, signal });
  window.addEventListener('scrollend', release, { signal });

  // Start at step 0 (the no-JS markup shows its own state instead).
  paint();

  return {
    state: () => ({ step, scene: root.dataset.scene }),
    destroy() {
      ac.abort();
      clearTimeout(holdTimer);
      vio.disconnect();
      bandIO?.disconnect();
      root.classList.remove('jr-live', 'jr-off');
    },
  };
}
