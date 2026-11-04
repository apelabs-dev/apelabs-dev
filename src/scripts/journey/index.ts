// The journey island: the repair walkthrough on a board pinned beside (desktop) or above (phones, tablets) the
// seven steps. Scroll position is the only thing that changes the story: the band a step crosses picks the
// current step, the rail's buttons scroll to a step, and step anchors (#jr-…) anywhere on the page do the same.
//
// The board is pinned with ScrollTrigger from the moment the grid's top reaches it until the last step has gone
// by. Short landscape phones pin nothing: the board scrolls with the page. With reduced motion the layout and
// the pin stay, and every state lands at once.

import { gsap, ScrollTrigger } from '../lib/gsap';
import { reducedMotion } from '../lib/island';
import { createJourney } from './engine';
import { createNotes } from './notes';
import { watchRows } from './rows';
import { createUi } from './ui';

// One scene per step: the healthy pipeline, the silent failure, then the repair.
const SCENES = ['ok', 'broken', 'diag', 'find', 'quote', 'fix', 'done'];
const DESK = '(min-width: 1024px)';
const SHORT = '(max-width: 1023px) and (max-height: 520px)';
const STACKED = '(max-width: 1023px) and (min-height: 520.02px)';
// The board's distance below the bar on desktop.
const DESK_GAP = 24;

const matches = (q: string) => matchMedia(q).matches;

// The page's bar, when it stays on screen (fixed or sticky); the board pins under it.
function barHeight(): number {
  const bar = document.querySelector<HTMLElement>('[id="01-nav"]');
  if (!bar) return 0;
  const { position } = getComputedStyle(bar);
  return position === 'fixed' || position === 'sticky' ? bar.offsetHeight : 0;
}

export interface JourneyHandle {
  state(): { step: number; scene: string | undefined };
  destroy(): void;
}
type JourneyRoot = HTMLElement & { __journey?: JourneyHandle };

/**
 * Wire the journey once. The handle is exposed as `root.__journey`; destroy() tears down only what this init
 * created (its pin, observers, listeners and the board's loops), after which the section can be mounted again.
 */
export function init(section: Element): JourneyHandle | null {
  const root = section as JourneyRoot;
  if (root.__journey) return null;
  const stage = root.querySelector<HTMLElement>('.jx-stage');
  const grid = root.querySelector<HTMLElement>('.jx-grid');
  const view = root.querySelector<HTMLElement>('.jx-view');
  if (!stage || !grid || !view) return null;
  const ac = new AbortController();

  const reduced = reducedMotion();
  // Pinned on top of the steps (phones and tablets), as opposed to beside them (desktop) or not at all.
  const stacked = () => !matches(DESK) && !matches(SHORT);
  const setBar = () => root.style.setProperty('--jx-bar', `${barHeight()}px`);
  setBar();

  // Where a step's top lands when we scroll to it: on desktop, where the steps' text sticks (34vh), so the step
  // covers the band and stays current once the scroll ends (a step box is shorter than the distance from the bar
  // to the band); right under the pinned board on phones (the board's ink reaches down to where the step pins,
  // --jx-pin).
  const stepOffset = () =>
    stacked() ? barHeight() + stage.offsetHeight : Math.max(barHeight() + DESK_GAP, Math.round(innerHeight * 0.34));
  // The step band: 40% down on desktop, just under the pinned board on phones.
  const band = () => {
    if (!stacked()) return '-40% 0px -59% 0px';
    const top = Math.round(stepOffset() + 12);
    const bottom = Math.max(0, innerHeight - top - 2);
    return `-${top}px 0px -${bottom}px 0px`;
  };

  const where = root.querySelector<HTMLElement>('[data-jx-where]');
  const words = [...root.querySelectorAll('.jx-rail-t')].map((t) => t.textContent ?? '');
  const writeWhere = (n: number) => {
    if (where) where.textContent = words[n] ?? '';
  };

  const renderer = createUi(view, { gsap, reduced });
  const rows = watchRows(view);
  const notes = createNotes(root, { desk: () => matches(DESK), docked: stacked });
  const scrollToStep = (el: Element) =>
    window.scrollBy({ top: el.getBoundingClientRect().top - stepOffset(), behavior: reduced ? 'instant' : 'smooth' });
  const journey = createJourney(root, {
    reduced,
    scenes: SCENES,
    renderer,
    band,
    scrollTo: scrollToStep,
    focus: (el) => {
      el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    },
    onStep: (n) => {
      writeWhere(n);
      notes.step(n);
    },
  });
  writeWhere(journey.state().step);
  notes.step(journey.state().step);

  // Step anchors elsewhere on the page land on their step, with the board showing it.
  const steps = [...root.querySelectorAll<HTMLElement>('.jr-step')];
  document.addEventListener(
    'click',
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#jr-"]');
      if (!a || root.contains(a)) return;
      const n = steps.findIndex((s) => `#${s.id}` === a.getAttribute('href'));
      if (n < 0) return;
      e.preventDefault();
      root.querySelector<HTMLButtonElement>(`[data-jr-go="${n}"]`)?.click();
    },
    { signal: ac.signal },
  );

  // The pin. Desktop: the board holds DESK_GAP under the bar beside the steps. Phones and tablets: right under
  // the bar, over the steps, its ink running down to where the current step pins. The pin ends when the grid's
  // bottom reaches the board's, so the board leaves with the last step.
  const mm = gsap.matchMedia();
  mm.add({ desk: DESK, short: SHORT, stacked: STACKED }, (ctx) => {
    if (ctx.conditions?.short) return;
    const top = () => barHeight() + (ctx.conditions?.desk ? DESK_GAP : 0);
    ScrollTrigger.create({
      trigger: grid,
      pin: stage,
      pinSpacing: false,
      start: () => `top top+=${top()}`,
      end: () => `bottom top+=${top() + stage.offsetHeight}`,
      invalidateOnRefresh: true,
      onRefresh: () => {
        setBar();
        notes.refresh();
      },
    });
  });

  // Late fonts change the steps' heights, and with them where the pin ends.
  void document.fonts?.ready.then(() => {
    if (!ac.signal.aborted) ScrollTrigger.refresh();
  });

  const handle: JourneyHandle = {
    state: journey.state,
    destroy() {
      if (ac.signal.aborted) return;
      ac.abort();
      // Only this section's matchMedia context: its pin, nothing a sibling created.
      mm.revert();
      journey.destroy();
      notes.destroy();
      rows?.destroy();
      renderer.destroy();
      root.style.removeProperty('--jx-bar');
      if (root.__journey === handle) delete root.__journey;
    },
  };
  root.__journey = handle;
  return handle;
}
