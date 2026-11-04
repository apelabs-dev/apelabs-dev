// The proof rows' feature rail: one orange spark runs each row's rail slowly, across under the row from
// 1024px and down the left on smaller screens. It fades in and out at the rail's ends, passes under each
// fact's chip and lights that chip's border while it is near. The rail itself stays CSS (.pf-facts::before),
// so without JS and under reduced motion it is the same static line; the spark draws on the strip of canvas
// that already sits over that line in the markup, above it and under the chips.
//
// The path is read from the rail's own box (the ::before's computed offsets), so it follows the CSS at every
// width. The loop runs only while a rail is on screen, the tab is visible and motion is allowed; a switch to
// reduced motion clears the strips and stops it. Device pixel ratio is capped.

import { drawSpark, makePath, sprite, type Path } from './spark';

const SPEED = 120; // px/s
const TAIL = 96; // the spark's five-step tail
const REST = 1.6; // s between passes
const EDGE = 64; // px over which the spark fades in at the rail's start and out at its end
const DPR_CAP = 2;
const HL_FADE = 0.22; // s of the spark's travel over which a fact's border fades in, and out
const HL_GATE: [number, number] = [EDGE / 8, EDGE / 2]; // px from a rail end: no highlight within the first, full past the second
const HL_HOLD = 0.06; // s at full that every fact keeps, however short its span

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

interface Span {
  a: number;
  b: number;
  t0: number;
  t1: number;
}

interface Rail {
  dl: HTMLElement;
  facts: HTMLElement[];
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  path: Path | null;
  across: boolean;
  key: string;
  dpr: number;
  clock: number;
  visible: boolean;
  spans: Span[];
  lit: number | null;
  hl: number;
}

export interface RailSparkState {
  running: boolean;
  frames: number;
  speed: number;
  tail: number;
  rest: number;
  hlFade: number;
  edge: number;
  hlGate: [number, number];
  hlHold: number;
  rails: Array<{
    across: boolean;
    len: number;
    period: number;
    clock: number;
    visible: boolean;
    dpr: number;
    w: number;
    h: number;
    active: number | null;
    intensity: number;
    spans: Span[];
  }>;
}

export interface RailSparkController {
  seek(t: number | null): void;
  state(): RailSparkState;
  destroy(): void;
}

/** Adopt the row's existing canvas strips and drive them, in document order. */
export function createRailSpark(root: Element): RailSparkController {
  const reducedQ = matchMedia('(prefers-reduced-motion: reduce)');
  const glow = sprite('255 120 70');

  const rails: Rail[] = [];
  for (const dl of Array.from(root.querySelectorAll<HTMLElement>('.pf-facts'))) {
    const article = dl.closest('.pr3-a') ?? root;
    const canvas = article.querySelector<HTMLCanvasElement>(':scope > canvas.pf-spark');
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) continue;
    rails.push({
      dl,
      facts: Array.from(dl.querySelectorAll<HTMLElement>(':scope > .pf-fact')),
      canvas,
      ctx,
      path: null,
      across: false,
      key: '',
      dpr: 1,
      clock: 0,
      visible: false,
      spans: [],
      lit: null,
      hl: 0,
    });
  }

  const byEl = new Map<Element, Rail>(rails.flatMap((r) => [[r.canvas, r] as [Element, Rail], [r.dl, r] as [Element, Rail]]));

  let raf = 0;
  let last = 0;
  let frames = 0;
  let seekT: number | null = null;
  let destroyed = false;

  const period = (r: Rail): number => (r.path ? r.path.len / SPEED + REST : 0);

  // The rail's centre line in the strip's own coordinates, from the rail's box; and each fact's span.
  function measure(r: Rail): boolean {
    const c = r.canvas.getBoundingClientRect();
    const d = r.dl.getBoundingClientRect();
    const b = getComputedStyle(r.dl, '::before');
    const x = d.left - c.left + parseFloat(b.left);
    const y = d.top - c.top + parseFloat(b.top);
    const w = parseFloat(b.width);
    const h = parseFloat(b.height);
    const across = w > h;
    const len = across ? w : h;

    r.spans = r.facts.map((f) => {
      const q = f.getBoundingClientRect();
      const a = Math.max(0, across ? q.left - c.left - x : q.top - c.top - y);
      const z = Math.min(len, across ? q.right - c.left - x : q.bottom - c.top - y);
      return { a, b: Math.max(a, z), t0: a / SPEED, t1: Math.max(a, z) / SPEED };
    });

    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    const key = [c.width, c.height, x, y, w, h, dpr].join();
    if (key === r.key) return false;
    r.key = key;
    r.dpr = dpr;
    r.canvas.width = Math.max(1, Math.round(c.width * dpr));
    r.canvas.height = Math.max(1, Math.round(c.height * dpr));
    r.across = w > h;
    const ok = c.width >= 1 && c.height >= 1 && Math.max(w, h) > EDGE * 2;
    r.path = !ok ? null : r.across ? makePath([[x, y + h / 2], [x + w, y + h / 2]]) : makePath([[x + w / 2, y], [x + w / 2, y + h]]);
    return true;
  }

  // The lit fact: index i at intensity v (null, 0: none). Writes only what changed.
  function light(r: Rail, i: number | null, v: number): void {
    v = Math.round(v * 1000) / 1000;
    if (i === r.lit && v === r.hl) return;
    if (r.lit !== null && r.lit !== i) {
      r.facts[r.lit].classList.remove('is-spark');
      r.facts[r.lit].style.removeProperty('--pf-hl');
    }
    r.lit = i;
    r.hl = v;
    if (i === null) return;
    r.facts[i].classList.add('is-spark');
    r.facts[i].style.setProperty('--pf-hl', String(v));
  }

  // The fact the head at d is inside, and how lit it is: position-driven fades at both ends of its span,
  // times a gate on the spark's own end fade (none where the spark has all but faded).
  function litAt(r: Rail, d: number): [number | null, number] {
    if (!r.path) return [null, 0];
    const gate = clamp01((Math.min(d, r.path.len - d) - HL_GATE[0]) / (HL_GATE[1] - HL_GATE[0]));
    for (let i = 0; i < r.spans.length; i++) {
      const { a, b } = r.spans[i];
      if (d >= a && d <= b && b > a) {
        const room = Math.min(b, r.path.len - HL_GATE[1]) - Math.max(a, HL_GATE[1]) - HL_HOLD * SPEED;
        const f = Math.max(1, Math.min(HL_FADE * SPEED, room));
        const v = clamp01((d - a) / f) * clamp01((b - d) / f) * gate;
        return v > 0 ? [i, v] : [null, 0];
      }
    }
    return [null, 0];
  }

  // The strip at time t of the rail's pass: nothing while the rail rests or motion is reduced.
  function draw(r: Rail, t: number): void {
    const { ctx, canvas, path } = r;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!path || reducedQ.matches) {
      light(r, null, 0);
      return;
    }
    const d = (t % period(r)) * SPEED;
    if (d > path.len) {
      light(r, null, 0);
      return;
    }
    light(r, ...litAt(r, d));
    ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    drawSpark(ctx, path, d, TAIL, clamp01(d / EDGE) * clamp01((path.len - d) / EDGE), { glow });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function tick(now: number): void {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    frames++;
    for (const r of rails) {
      if (!r.visible) continue;
      r.clock += dt;
      draw(r, r.clock);
    }
    raf = requestAnimationFrame(tick);
  }

  function update(): void {
    const want =
      !destroyed &&
      !reducedQ.matches &&
      document.visibilityState === 'visible' &&
      seekT === null &&
      rails.some((r) => r.visible);
    if (want && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    } else if (!want && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    if (!raf && !destroyed) for (const r of rails) draw(r, seekT ?? r.clock);
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const rail = byEl.get(e.target);
      if (rail) rail.visible = e.isIntersecting;
    }
    update();
  });
  const ro = new ResizeObserver((entries) => {
    let changed = false;
    for (const r of new Set(entries.map((e) => byEl.get(e.target)).filter((r): r is Rail => !!r))) {
      changed = measure(r) || changed;
    }
    if (changed && !raf) update();
  });

  for (const r of rails) {
    measure(r);
    io.observe(r.canvas);
    ro.observe(r.canvas);
    ro.observe(r.dl);
  }

  const onChange = (): void => update();
  document.addEventListener('visibilitychange', onChange);
  reducedQ.addEventListener('change', onChange);
  update();

  return {
    seek(t: number | null): void {
      seekT = t;
      update();
    },
    state(): RailSparkState {
      return {
        running: !!raf,
        frames,
        speed: SPEED,
        tail: TAIL,
        rest: REST,
        hlFade: HL_FADE,
        edge: EDGE,
        hlGate: HL_GATE,
        hlHold: HL_HOLD,
        rails: rails.map((r) => ({
          across: r.across,
          len: r.path?.len ?? 0,
          period: period(r),
          clock: r.clock,
          visible: r.visible,
          dpr: r.dpr,
          w: r.canvas.width,
          h: r.canvas.height,
          active: r.lit,
          intensity: r.hl,
          spans: r.spans.map(({ a, b, t0, t1 }) => ({
            a: Math.round(a * 10) / 10,
            b: Math.round(b * 10) / 10,
            t0: Math.round(t0 * 1000) / 1000,
            t1: Math.round(t1 * 1000) / 1000,
          })),
        })),
      };
    },
    destroy(): void {
      destroyed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onChange);
      reducedQ.removeEventListener('change', onChange);
      for (const r of rails) {
        light(r, null, 0);
        r.ctx.setTransform(1, 0, 0, 1, 0, 0);
        r.ctx.clearRect(0, 0, r.canvas.width, r.canvas.height);
      }
    },
  };
}
