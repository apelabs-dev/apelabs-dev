import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/** True when the reader asked the OS for less motion. */
export const reducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Snapshot of the media query at module load, for modules that branch once. */
export const prefersReducedMotion: boolean = reducedMotion();

const REGISTERED = '__apeGsapRegistered' as const;
type Flagged = typeof globalThis & { [REGISTERED]?: boolean };
const scope = globalThis as Flagged;

// A section module and the shared island helper may both import gsap; register once.
if (!scope[REGISTERED]) {
  gsap.registerPlugin(ScrollTrigger);
  scope[REGISTERED] = true;
}

/**
 * Run `init(root)` the first time `root` is near the viewport, then stop observing.
 * Falls back to an immediate call without IntersectionObserver or with reduced motion,
 * so the section renders its final state instead of staying hidden.
 */
export function onVisible(root: Element | null, init: (root: Element) => void): void {
  if (!root) return;

  if (typeof IntersectionObserver !== 'function' || reducedMotion()) {
    init(root);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        io.disconnect();
        init(entry.target);
        return;
      }
    },
    { threshold: 0.01, rootMargin: '0px 0px -10% 0px' },
  );

  io.observe(root);
}

export { gsap, ScrollTrigger };
