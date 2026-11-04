// Deterministic painter: every attribute below is a pure function of progress p (0..1), so playing, pausing,
// scrubbing forwards and scrubbing backwards all land on the same frame. Writes only when a value changes.

export const clamp = (x: number) => Math.min(1, Math.max(0, x));
export const easeOut = (x: number) => 1 - (1 - clamp(x)) ** 3;
export const easeIn = (x: number) => clamp(x) ** 2;
const easeInOut = (x: number) => {
  x = clamp(x);
  return x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
};
// Damped spring: overshoots ~7 % once and settles; exactly 0 at x=0 and 1 for x>=1.
export const spring = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.exp(-7 * x) * Math.cos(8.5 * x) * (1 - x ** 4));
const win = (p: number, [a, b]: number[]) => clamp((p - a) / Math.max(1e-6, b - a));
const nums = (s?: string) => (s || '').trim().split(/\s+/).filter(Boolean).map(Number);
const pose = ([x = 0, y = 0, r = 0, s = 1]: number[], k: number) =>
  `translate(${(x * k).toFixed(2)}px,${(y * k).toFixed(2)}px) rotate(${(r * k).toFixed(2)}deg) scale(${(1 + (s - 1) * k).toFixed(4)})`;

interface Step {
  at: number;
  text: string;
  tone: string;
}
// "at:text" (text may itself hold colons, e.g. times) or, for chips, "at:label:tone".
const steps = (s: string, chip = false): Step[] =>
  s.split('|').map((x) => {
    const i = x.indexOf(':');
    const rest = x.slice(i + 1);
    const j = chip ? rest.lastIndexOf(':') : -1;
    return { at: +x.slice(0, i), text: j < 0 ? rest : rest.slice(0, j), tone: j < 0 ? '' : rest.slice(j + 1) };
  });
const pick = (list: Step[], p: number) => {
  let cur = list[0];
  for (const s of list) if (p >= s.at) cur = s;
  return cur;
};

type Cache = Record<string, string | number | undefined>;
interface Base {
  el: SVGElement;
  c: Cache;
}
type Op = Base &
  (
    | { kind: 'enter'; w: number[]; pose: number[]; ease?: string }
    | { kind: 'move'; w: number[]; pose: number[]; ease?: string }
    | { kind: 'leave'; w: number[]; pose: number[] }
    | { kind: 'fade'; w: number[]; a: number; b: number }
    | { kind: 'draw'; w: number[] }
    | { kind: 'flow'; k: number }
    | { kind: 'pulse'; at: number[] }
    | { kind: 'chip'; list: Step[]; text: SVGTextElement }
    | { kind: 'text'; list: Step[] }
    | { kind: 'type'; w: number[]; full: string; spans: { s: SVGTSpanElement; text: string }[] }
    | { kind: 'scan'; w: number[]; dy: number }
    | { kind: 'fill'; w: number[] }
    | {
        kind: 'packet';
        w: number[];
        poly: number[][];
        cum: number[];
        len: number;
        trails: { el: SVGElement; n: number }[];
        head: SVGElement;
      }
  );

/** Collect animated parts beneath root. Returns a paint(p) function. */
export function timeline(root: Element): (p: number) => void {
  const ops: Op[] = [];
  const q = <T extends SVGElement>(sel: string) => root.querySelectorAll<T>(sel);
  const add = (el: SVGElement, op: object) => ops.push({ el, c: {}, ...op } as Op);
  for (const el of q('[data-enter]')) add(el, { kind: 'enter', w: nums(el.dataset.enter), pose: nums(el.dataset.from), ease: el.dataset.ease });
  for (const el of q('[data-move]')) add(el, { kind: 'move', w: nums(el.dataset.move), pose: nums(el.dataset.pose), ease: el.dataset.ease });
  for (const el of q('[data-leave]')) add(el, { kind: 'leave', w: nums(el.dataset.leave), pose: nums(el.dataset.to) });
  for (const el of q('[data-fade]')) {
    const n = nums(el.dataset.fade);
    add(el, { kind: 'fade', w: n.slice(0, 2), a: n[2] ?? 0, b: n[3] ?? 1 });
  }
  for (const el of q('[data-draw]')) add(el, { kind: 'draw', w: nums(el.dataset.draw) });
  for (const el of q('[data-flow]')) add(el, { kind: 'flow', k: +(el.dataset.flow as string) });
  for (const el of q('[data-pulse]')) add(el, { kind: 'pulse', at: nums(el.dataset.pulse) });
  for (const el of q('[data-chip]')) add(el, { kind: 'chip', list: steps(el.dataset.chip as string, true), text: el.querySelector('text') as SVGTextElement });
  for (const el of q('[data-text]')) add(el, { kind: 'text', list: steps(el.dataset.text as string) });
  for (const el of q('[data-type]')) {
    add(el, {
      kind: 'type',
      w: nums(el.dataset.type),
      full: el.dataset.full as string,
      spans: [...el.querySelectorAll('tspan')].map((s) => ({ s, text: s.textContent || '' })),
    });
  }
  for (const el of q('[data-scan]')) {
    const n = nums(el.dataset.scan);
    add(el, { kind: 'scan', w: n.slice(0, 2), dy: n[2] });
  }
  for (const el of q('[data-fill]')) add(el, { kind: 'fill', w: nums(el.dataset.fill) });
  for (const el of q('[data-packet]')) {
    const poly = (el.dataset.pts as string).split(' ').map((s) => s.split(',').map(Number));
    const cum = [0];
    for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
    add(el, {
      kind: 'packet',
      w: nums(el.dataset.packet),
      poly,
      cum,
      len: cum[cum.length - 1],
      trails: [...el.querySelectorAll<SVGElement>('[data-tail]')].map((t) => ({ el: t, n: +(t.dataset.tail as string) })),
      head: el.querySelector('.sr3-head') as SVGElement,
    });
  }
  const pointAt = (op: Extract<Op, { kind: 'packet' }>, d: number) => {
    const { poly, cum } = op;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const seg = cum[i] - cum[i - 1] || 1;
    const u = clamp((d - cum[i - 1]) / seg);
    return [poly[i - 1][0] + (poly[i][0] - poly[i - 1][0]) * u, poly[i - 1][1] + (poly[i][1] - poly[i - 1][1]) * u];
  };
  const set = (op: Base, key: string, value: string | number, write: (v: string | number) => void) => {
    if (op.c[key] === value) return;
    op.c[key] = value;
    write(value);
  };

  return function paint(p: number) {
    for (const op of ops) {
      const { el } = op;
      switch (op.kind) {
        case 'enter': {
          const x = win(p, op.w);
          const k = 1 - (op.ease === 'spring' ? spring(x) : easeOut(x));
          set(op, 'o', clamp(x * 3).toFixed(3), (v) => (el.style.opacity = String(v)));
          set(op, 't', pose(op.pose, k), (v) => (el.style.transform = String(v)));
          break;
        }
        case 'move': {
          const x = win(p, op.w);
          const k = 1 - (op.ease === 'out' ? easeOut(x) : op.ease === 'inout' ? easeInOut(x) : spring(x));
          set(op, 't', pose(op.pose, k), (v) => (el.style.transform = String(v)));
          break;
        }
        case 'leave': {
          // Opaque while it travels, faded over the last stretch of the same window (x .55 → 1), so a
          // lifted note never shows through, or under, what it passes.
          const x = easeIn(win(p, op.w));
          set(op, 'o', (1 - clamp((x - 0.55) / 0.45)).toFixed(3), (v) => (el.style.opacity = String(v)));
          set(op, 't', pose(op.pose, x), (v) => (el.style.transform = String(v)));
          break;
        }
        case 'fade': {
          const x = easeOut(win(p, op.w));
          set(op, 'o', (op.a + (op.b - op.a) * x).toFixed(3), (v) => (el.style.opacity = String(v)));
          break;
        }
        case 'draw': {
          const x = easeInOut(win(p, op.w));
          set(op, 'd', (100 * (1 - x)).toFixed(2), (v) => {
            el.style.strokeDasharray = '100 100';
            el.style.strokeDashoffset = String(v);
          });
          break;
        }
        case 'flow':
          set(op, 'f', (-p * op.k).toFixed(2), (v) => (el.style.strokeDashoffset = String(v)));
          break;
        case 'pulse': {
          let v = 0;
          for (const a of op.at) if (p >= a) v = Math.max(v, 1 - (p - a) / 0.07);
          set(op, 'o', clamp(v).toFixed(3), (x) => (el.style.opacity = String(x)));
          break;
        }
        case 'chip': {
          const s = pick(op.list, p);
          set(op, 'c', s.text + s.tone, () => {
            op.text.textContent = s.text;
            el.dataset.tone = s.tone;
          });
          break;
        }
        case 'text': {
          const s = pick(op.list, p);
          set(op, 'c', s.text, (v) => (el.textContent = String(v)));
          break;
        }
        case 'type': {
          const n = Math.round(op.full.length * win(p, op.w));
          set(op, 'n', n, () => {
            let left = n;
            for (const sp of op.spans) {
              sp.s.textContent = sp.text.slice(0, Math.max(0, left));
              left -= sp.text.length;
            }
          });
          break;
        }
        case 'scan': {
          const x = win(p, op.w);
          set(op, 't', `translate(0px,${(op.dy * easeInOut(x)).toFixed(2)}px)`, (v) => (el.style.transform = String(v)));
          set(op, 'o', (x <= 0 || x >= 1 ? 0 : Math.min(1, x * 12, (1 - x) * 12)).toFixed(3), (v) => (el.style.opacity = String(v)));
          break;
        }
        case 'fill':
          set(op, 't', `scaleX(${easeInOut(win(p, op.w)).toFixed(4)})`, (v) => (el.style.transform = String(v)));
          break;
        case 'packet': {
          const x = win(p, op.w);
          const tail = 30;
          const head = x * (op.len + tail);
          const live = x > 0 && x < 1;
          set(op, 'o', live ? '1' : '0', (v) => (el.style.opacity = String(v)));
          if (!live) break;
          for (const tr of op.trails) {
            const d = `${tr.n} ${op.len + 60}`;
            const o = (tr.n - head).toFixed(2);
            if (op.c['d' + tr.n] !== d) {
              op.c['d' + tr.n] = d;
              tr.el.style.strokeDasharray = d;
            }
            if (op.c['o' + tr.n] !== o) {
              op.c['o' + tr.n] = o;
              tr.el.style.strokeDashoffset = o;
            }
          }
          const [hx, hy] = pointAt(op, Math.min(head, op.len));
          set(op, 'h', `translate(${hx.toFixed(2)}px,${hy.toFixed(2)}px)`, (v) => (op.head.style.transform = String(v)));
          set(op, 'ho', head > op.len ? '0' : '1', (v) => (op.head.style.opacity = String(v)));
          break;
        }
      }
    }
  };
}
