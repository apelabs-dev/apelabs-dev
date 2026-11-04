import { timeline, clamp } from './timeline';

export const DURATION = 9000;
const NARROW = 440; // px of artifact width; mirrors the container query in services.css

type Paint = (p: number) => void;
interface PanelState {
  panel: HTMLElement;
  art: HTMLElement;
  toggle: HTMLButtonElement;
  body: HTMLElement;
  input: HTMLInputElement;
  output: HTMLOutputElement;
  play: HTMLButtonElement;
  paints: Record<string, Paint>;
  p: number;
  wanted: boolean;
  visible: boolean;
  changes: number;
  narrow: boolean;
}

export interface ServicesState {
  open: number;
  running: boolean;
  framePending: boolean;
  reduced: boolean;
  /** Progress of the open card (0..1), or null when the deck is closed. */
  openProgress: number | null;
  /** Which drawing is painted for the open card. */
  layout: 'wide' | 'narrow' | null;
  progress: number[];
  paintCounts: number[];
}
export interface ServicesApi {
  /** 0 setup, 1 opinion, 2 build, 3 workshop; anything else (-1) closes. */
  open(i: number): void;
  /** 0..1; pauses the open card and paints that exact frame synchronously. */
  seek(p: number): void;
  state(): ServicesState;
  destroy(): void;
}

const need = <T extends Element>(scope: ParentNode, sel: string): T => {
  const el = scope.querySelector<T>(sel);
  if (!el) throw new Error(`services: missing ${sel}`);
  return el;
};

// No timer/animation survives destroy(). Only the selected, visible artifact can request a frame.
export function createServices(root: HTMLElement): ServicesApi {
  const abort = new AbortController();
  const on = (el: EventTarget, name: string, fn: (e: any) => void) => el.addEventListener(name, fn, { signal: abort.signal });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const hover = matchMedia('(hover: hover) and (pointer: fine)');
  const panels = [...root.querySelectorAll<HTMLElement>('.sr3-panel')];
  let open = -1;
  let by = '';
  let raf = 0;
  let last = 0;
  let destroyed = false;
  const status = need<HTMLElement>(root, '[data-status]');

  const states: PanelState[] = panels.map((panel) => {
    const art = need<HTMLElement>(panel, '.sr3-artifact');
    const paints: Record<string, Paint> = {};
    for (const svg of art.querySelectorAll<SVGElement>('.sr3-svg[data-layout]')) paints[svg.dataset.layout as string] = timeline(svg);
    if (!Object.keys(paints).length) paints.all = timeline(art);
    return {
      panel,
      art,
      toggle: need<HTMLButtonElement>(panel, '.sr3-toggle'),
      body: need<HTMLElement>(panel, '.sr3-body'),
      input: need<HTMLInputElement>(panel, '.sr3-scrub'),
      output: need<HTMLOutputElement>(panel, '.sr3-progress'),
      play: need<HTMLButtonElement>(panel, '.sr3-play'),
      paints,
      p: 1,
      wanted: false,
      visible: false,
      changes: 0,
      narrow: art.clientWidth > 0 && art.clientWidth < NARROW,
    };
  });

  const layoutOf = (s: PanelState) => (s.paints.all ? null : s.narrow ? 'narrow' : 'wide');
  function paint(s: PanelState) {
    const p = s.p;
    (s.paints.all || s.paints[s.narrow ? 'narrow' : 'wide'] || s.paints.wide)(p);
    const value = Math.round(p * 100);
    s.input.value = String(value);
    s.input.setAttribute('aria-valuetext', p === 1 ? 'Complete' : `${value}% complete`);
    s.output.value = `${value}%`;
    s.changes++;
    s.panel.dataset.progress = String(value);
  }
  const label = (mode: string) => (mode === 'pause' ? 'Pause' : mode === 'replay' ? 'Replay' : 'Play');
  function controls() {
    states.forEach((s, i) => {
      const running = i === open && s.wanted && s.visible && !document.hidden && !reduced.matches && s.p < 1;
      const mode = running ? 'pause' : s.p === 1 ? 'replay' : 'play';
      const name = need(s.panel, '.sr3-service-name').textContent;
      if (s.play.dataset.mode !== mode) {
        s.play.dataset.mode = mode;
        need(s.play, '.sr3-play-label').textContent = label(mode);
      }
      s.play.setAttribute('aria-label', `${label(mode)} ${name} illustration`);
      s.play.disabled = reduced.matches;
      s.panel.classList.toggle('is-running', running);
    });
  }
  function active() {
    const s = states[open];
    return !destroyed && s && s.wanted && s.visible && !document.hidden && !reduced.matches && s.p < 1 ? s : null;
  }
  function schedule() {
    if (!active()) {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    } else if (!raf) raf = requestAnimationFrame(tick);
    controls();
  }
  function tick(t: number) {
    raf = 0;
    const s = active();
    if (!s) return schedule();
    const dt = last ? Math.min(t - last, 64) : 0;
    last = t;
    s.p = clamp(s.p + dt / DURATION);
    paint(s);
    if (s.p === 1) {
      s.wanted = false;
      status.textContent = 'Illustration complete.';
    }
    schedule();
  }
  function expand(i: number, cause = 'api') {
    if (i === open) {
      by = cause;
      return;
    }
    const prev = open;
    if (prev >= 0) {
      const ps = states[prev];
      // Focus inside the closing body would be lost with it: hand it back to the card's own button.
      if (ps.body.contains(document.activeElement)) ps.toggle.focus({ preventScroll: true });
      ps.wanted = false;
      ps.panel.classList.remove('is-open');
      ps.toggle.setAttribute('aria-expanded', 'false');
      ps.body.hidden = true;
    }
    open = i;
    by = cause;
    last = 0;
    if (i >= 0) {
      const s = states[i];
      s.panel.classList.add('is-open');
      s.toggle.setAttribute('aria-expanded', 'true');
      s.body.hidden = false;
      s.narrow = s.art.clientWidth > 0 && s.art.clientWidth < NARROW;
      s.p = reduced.matches ? 1 : 0;
      s.wanted = !reduced.matches;
      paint(s);
    }
    schedule();
  }
  function disclosure(button: HTMLButtonElement | null) {
    if (!button) return; // a host may render the detail without the button (shown in the open card)
    const target = root.querySelector<HTMLElement>(`[id="${button.getAttribute('aria-controls')}"]`);
    if (!target) return;
    button.hidden = false;
    button.setAttribute('aria-expanded', 'false');
    target.hidden = true;
    on(button, 'click', () => {
      const expanded = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(expanded));
      target.hidden = !expanded;
    });
  }

  // Wide and narrow scenes swap by container width (CSS). The runtime only paints the one on screen.
  // A closed panel's body is hidden, so its artifact has no width: that is not a layout change to
  // paint (the next open() measures the panel again), and repainting it would be a phantom frame.
  const resize = new ResizeObserver((entries) => {
    for (const e of entries) {
      const s = states.find((x) => x.art === e.target);
      if (!s || e.contentRect.width === 0) continue;
      const narrow = e.contentRect.width < NARROW;
      if (narrow !== s.narrow) {
        s.narrow = narrow;
        paint(s);
      }
    }
  });
  states.forEach((s, i) => {
    resize.observe(s.art);
    s.body.hidden = true;
    s.toggle.setAttribute('aria-expanded', 'false');
    on(s.toggle, 'click', (e: MouseEvent) => expand(open === i && !(e.detail > 0 && by === 'hover') ? -1 : i, 'click'));
    on(s.toggle, 'pointerenter', (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && hover.matches && !root.contains(document.activeElement)) expand(i, 'hover');
    });
    need<HTMLElement>(s.panel, '.sr3-controls').hidden = false;
    disclosure(s.panel.querySelector<HTMLButtonElement>('.sr3-more'));
    // One control: Play / Pause while it runs, Replay once complete (WCAG 2.2.2: pause stays available).
    on(s.play, 'click', () => {
      if (s.p === 1) {
        s.p = 0;
        s.wanted = true;
      } else s.wanted = !s.wanted;
      last = 0;
      paint(s);
      schedule();
    });
    // Scrubbing is reader-driven, so it also works with reduced motion; it never starts playback.
    on(s.input, 'input', () => {
      s.wanted = false;
      s.p = +s.input.value / 100;
      paint(s);
      schedule();
    });
    paint(s);
  });
  disclosure(root.querySelector<HTMLButtonElement>('.sr3-section-more'));
  on(root, 'keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open >= 0) {
      const button = states[open].toggle;
      e.preventDefault();
      expand(-1);
      button.focus({ preventScroll: true });
    }
  });
  on(need(root, '.sr3-deck'), 'pointerleave', () => {
    if (by === 'hover') expand(-1);
  });
  on(document, 'visibilitychange', () => {
    last = 0;
    schedule();
  });
  on(reduced, 'change', () => {
    if (reduced.matches)
      states.forEach((s) => {
        s.p = 1;
        s.wanted = false;
        paint(s);
      });
    schedule();
  });
  const observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const s = states.find((x) => x.art === e.target);
        if (s) s.visible = e.isIntersecting;
      }
      last = 0;
      schedule();
    },
    { threshold: 0.08 },
  );
  states.forEach((s) => observer.observe(s.art));
  root.classList.add('sr3-ready');
  controls();

  return {
    open: (i) => expand(Number.isInteger(i) && i >= 0 && i < panels.length ? i : -1),
    seek(p) {
      if (open < 0) return;
      const s = states[open];
      s.p = clamp(p);
      s.wanted = false;
      paint(s);
      schedule();
    },
    state: () => ({
      open,
      running: !!active(),
      framePending: !!raf,
      reduced: reduced.matches,
      openProgress: open >= 0 ? states[open].p : null,
      layout: open >= 0 ? layoutOf(states[open]) : null,
      progress: states.map((s) => s.p),
      paintCounts: states.map((s) => s.changes),
    }),
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      observer.disconnect();
      resize.disconnect();
      abort.abort();
      root.classList.remove('sr3-ready');
      root.querySelectorAll<HTMLElement>('[hidden]').forEach((el) => (el.hidden = false));
      root.querySelectorAll('[aria-expanded]').forEach((el) => el.setAttribute('aria-expanded', 'true'));
      states.forEach((s) => {
        s.p = 1;
        for (const f of Object.values(s.paints)) f(1);
        paint(s);
        s.panel.classList.remove('is-running', 'is-open');
      });
      root.querySelectorAll<HTMLElement>('.sr3-controls,.sr3-more,.sr3-section-more').forEach((el) => (el.hidden = true));
    },
  };
}
