// Hero copy entrance: text blocks rise into place line by line as they enter the viewport.
// A hero-only port of the reference line reveal (src/reveal/reveal.js).
//
// The original text is never split. When a block reveals, an aria-hidden, inert overlay holds one clone of
// the block's content per line; each clone is clipped to its line band and slides up into it. When the last
// line lands the overlay is removed and the original text shows, so screen readers, search engines and
// find-in-page always see the text once, in reading order. Bands are measured from the live layout at
// reveal time; a resize during a reveal re-measures them and carries on. Blocks that hold controls
// (data-rt="block") fade and lift as one piece.
//
// The hidden start state only exists under `.rt` on the hero root, which an inline script sets before first
// paint when JavaScript runs and motion is allowed. Without JS, with reduced motion, or if this module never
// loads (the inline script drops `.rt` after a timeout), nothing is hidden. State lives on the hero only.
import { reducedMotion } from '../lib/island';

export type RevealState = 'pending' | 'running' | 'idle';

export interface HeroReveal {
  destroy(): void;
}

const SELECTOR = '[data-rt]';
// Seconds between the start of one line and the next, and each line's travel time.
const STAGGER = 0.085;
const DURATION = 0.9;
// How far a line starts below its band, in em.
const RISE = 0.6;
// A block reveals once its top passes this share of the viewport height.
const ENTER = 0.9;
// A block dims once its bottom is above this share of the viewport height.
const DIM_TOP = 0.14;
// Seconds between blocks that enter in the same batch.
const BATCH = 0.08;
// Longest wait for the fonts before measuring lines anyway.
const FONT_WAIT_MS = 800;

interface Band {
  top: number;
  bottom: number;
  a: number;
  b: number;
}

interface Run {
  timer?: ReturnType<typeof setTimeout>;
  start?: number;
  color?: string;
  layer?: HTMLElement;
  ro?: ResizeObserver;
  positioned?: boolean;
}

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

function mode(el: HTMLElement): 'block' | 'lines' {
  if (el.dataset.rt === 'block') return 'block';
  if (!/^(block|list-item)$/.test(getComputedStyle(el).display)) return 'block';
  for (const c of Array.from(el.children)) {
    if (!/^(inline|inline-block|contents)$/.test(getComputedStyle(c).display) && c.tagName !== 'BR') return 'block';
  }
  return 'lines';
}

/** Line bands in the element's padding-box coordinates, edges halfway between neighbouring lines. */
function bands(el: HTMLElement): Band[] {
  const range = document.createRange();
  range.selectNodeContents(el);
  const box = el.getBoundingClientRect();
  const rects = Array.from(range.getClientRects())
    .filter((q) => q.width > 0.5 && q.height > 0.5)
    .sort((a, b) => a.top - b.top);
  range.detach?.();
  const lines: { top: number; bottom: number }[] = [];
  for (const q of rects) {
    const mid = (q.top + q.bottom) / 2;
    const last = lines[lines.length - 1];
    if (last && mid < last.bottom && mid > last.top) {
      last.top = Math.min(last.top, q.top);
      last.bottom = Math.max(last.bottom, q.bottom);
    } else lines.push({ top: q.top, bottom: q.bottom });
  }
  const top = box.top + el.clientTop;
  const rel = lines.map((l) => ({ top: l.top - top, bottom: l.bottom - top }));
  return rel.map((l, i) => {
    const prev = rel[i - 1];
    const next = rel[i + 1];
    const half = 0.5 * (l.bottom - l.top);
    return { ...l, a: prev ? (prev.bottom + l.top) / 2 : -half, b: next ? (l.bottom + next.top) / 2 : l.bottom + half };
  });
}

function overlay(el: HTMLElement, list: Band[], elapsed: number, color: string): HTMLElement {
  const cs = getComputedStyle(el);
  const layer = document.createElement('span');
  layer.className = 'rt-fx';
  layer.setAttribute('aria-hidden', 'true');
  layer.inert = true;
  layer.style.color = color;
  const padL = parseFloat(cs.paddingLeft) || 0;
  const padT = parseFloat(cs.paddingTop) || 0;
  const width = el.clientWidth - padL - (parseFloat(cs.paddingRight) || 0);
  const height = el.clientHeight;
  const fontPx = parseFloat(cs.fontSize) || 16;
  const lines: HTMLElement[] = [];
  list.forEach((band, i) => {
    const clip = document.createElement('span');
    clip.className = 'rt-band';
    clip.style.clipPath = `inset(${band.a}px 0 ${height - band.b}px 0)`;
    const inner = document.createElement('span');
    inner.className = 'rt-copy';
    inner.style.left = `${padL}px`;
    inner.style.top = `${padT}px`;
    inner.style.width = `${width}px`;
    for (const n of Array.from(el.childNodes)) {
      if (n instanceof Element && n.classList.contains('rt-fx')) continue;
      inner.appendChild(n.cloneNode(true));
    }
    inner.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    const delay = i * STAGGER - elapsed;
    if (delay + DURATION > 0) {
      const wait = Math.max(0, delay);
      inner.style.transform = `translateY(${RISE * fontPx}px)`;
      inner.style.opacity = '0';
      inner.style.transition = `transform ${DURATION}s ${EASE} ${wait}s, opacity ${DURATION * 0.7}s ease-out ${wait}s`;
    }
    clip.appendChild(inner);
    layer.appendChild(clip);
    lines.push(inner);
  });
  el.appendChild(layer);
  // Commit the start state, then let every line travel to its place.
  void layer.offsetWidth;
  for (const inner of lines) {
    inner.style.transform = '';
    inner.style.opacity = '';
  }
  return layer;
}

/** Wait for the hero faces so line bands are measured with the real glyphs, but never for long. */
function fontsReady(): Promise<void> {
  if (!document.fonts) return Promise.resolve();
  const loaded = Promise.all([document.fonts.load('400 1em "Hero Pixel Line"'), document.fonts.ready]).then(() => undefined);
  const cap = new Promise<void>((done) => setTimeout(done, FONT_WAIT_MS));
  return Promise.race([loaded.catch(() => undefined), cap]);
}

export function initHeroReveal(root: HTMLElement): HeroReveal | null {
  if (reducedMotion() || typeof IntersectionObserver !== 'function') {
    root.classList.remove('rt');
    return null;
  }
  root.classList.add('rt');

  const live = new Map<HTMLElement, Run>();
  const watched = new Set<HTMLElement>();
  let destroyed = false;
  let entered = false;

  const publish = (): void => {
    const state: RevealState = !entered ? 'pending' : live.size ? 'running' : 'idle';
    root.dataset.reveal = state;
  };

  function finish(el: HTMLElement): void {
    const run = live.get(el);
    if (!run) return;
    live.delete(el);
    clearTimeout(run.timer);
    run.ro?.disconnect();
    run.layer?.remove();
    if (run.positioned) el.style.position = '';
    el.classList.remove('rt-run');
    el.classList.add('rt-in');
    publish();
  }

  function play(el: HTMLElement, delay = 0): void {
    finish(el);
    el.classList.remove('rt-in', 'rt-dim');
    if (mode(el) === 'block') {
      el.classList.add('rt-block');
      const timer = setTimeout(() => {
        live.delete(el);
        el.classList.add('rt-in');
        publish();
      }, delay * 1000);
      live.set(el, { timer });
      return;
    }
    const start = performance.now() + delay * 1000;
    const run: Run = { start };
    live.set(el, run);
    const begin = (): void => {
      if (live.get(el) !== run) return;
      const list = bands(el);
      if (!list.length) return finish(el);
      const cs = getComputedStyle(el);
      const color = cs.color;
      run.color = color;
      if (cs.position === 'static') {
        el.style.position = 'relative';
        run.positioned = true;
      }
      el.classList.add('rt-run');
      run.layer = overlay(el, list, 0, color);
      run.timer = setTimeout(() => finish(el), ((list.length - 1) * STAGGER + DURATION) * 1000 + 60);
      // Re-measure on resize: lines that already landed stay put, the rest carry on from where they are.
      let width = el.clientWidth;
      run.ro = new ResizeObserver(() => {
        if (el.clientWidth === width) return;
        width = el.clientWidth;
        const elapsed = (performance.now() - start) / 1000;
        run.layer?.remove();
        const next = bands(el);
        run.layer = overlay(el, next, elapsed, color);
        clearTimeout(run.timer);
        const left = Math.max(0, (next.length - 1) * STAGGER + DURATION - elapsed);
        run.timer = setTimeout(() => finish(el), left * 1000 + 60);
      });
      run.ro.observe(el);
    };
    run.timer = setTimeout(begin, delay * 1000);
    publish();
  }

  // Both observers take the document as their root: in a cross-origin frame the implicit root ignores rootMargin.
  const enterIO = new IntersectionObserver(
    (entries) => {
      const batch = entries
        .filter((e) => e.isIntersecting)
        .map((e) => e.target as HTMLElement)
        .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      entered = true;
      batch.forEach((el, i) => {
        enterIO.unobserve(el);
        play(el, i * BATCH);
      });
      publish();
    },
    { root: document, rootMargin: `0px 0px -${Math.round((1 - ENTER) * 100)}% 0px` },
  );

  const dimIO = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const above = !e.isIntersecting && e.boundingClientRect.bottom <= (e.rootBounds ? e.rootBounds.top : 0) + 1;
        e.target.classList.toggle('rt-dim', above && e.target.classList.contains('rt-in'));
      }
    },
    { root: document, rootMargin: `-${Math.round(DIM_TOP * 100)}% 0px 0px 0px` },
  );

  // Keyboard or pointer reaching a block that has not shown yet: show it at once, never leave it stranded hidden.
  const onFocusIn = (e: FocusEvent): void => {
    const target = e.target instanceof Element ? e.target : null;
    const block = target?.closest<HTMLElement>(SELECTOR);
    if (!block || !root.contains(block) || block.classList.contains('rt-in')) return;
    finish(block);
    enterIO.unobserve(block);
    block.classList.add('rt-in');
  };
  root.addEventListener('focusin', onFocusIn);

  const motion = matchMedia('(prefers-reduced-motion: reduce)');

  // Leave the page as it renders without the entrance: everything shown, no overlays, no observers.
  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    for (const el of Array.from(live.keys())) finish(el);
    enterIO.disconnect();
    dimIO.disconnect();
    root.removeEventListener('focusin', onFocusIn);
    motion.removeEventListener('change', onMotion);
    root.classList.remove('rt');
    for (const el of watched) el.classList.remove('rt-in', 'rt-dim', 'rt-block', 'rt-run');
    watched.clear();
    delete root.dataset.reveal;
  }

  // Reduced motion switched on while the page is open: drop the entrance and show the final state.
  function onMotion(): void {
    if (motion.matches) destroy();
  }
  motion.addEventListener('change', onMotion);

  publish();
  void fontsReady().then(() => {
    if (destroyed) return;
    root.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
      watched.add(el);
      enterIO.observe(el);
      dimIO.observe(el);
    });
  });

  return { destroy };
}
