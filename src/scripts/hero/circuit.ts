// Circuit canvas: orange sparks run along the traces of a lattice-locked network. Every ~10 seconds one
// trace breaks (arriving sparks stall and fizzle, the dead side goes grey and flickers), brackets find
// the break, and a paper-white repair routes a detour around it; then sparks flow through the fix.
//
// Canvas 2D. render(t) is a pure function of the time t, so seek(t) can draw any frame. The loop only
// runs while the canvas is on screen, the tab is visible and motion is allowed; with reduced motion it
// draws one still frame of the repaired trace and never starts a loop. Device pixel ratio is capped.
import { drawSpark, linePath, pointAt, rgba, slicePath, sprite, type Point } from '../circuit/spark';
import {
  buildNetwork,
  eachSpark,
  hash01,
  lastArrival,
  NET_T,
  PHASES,
  XFADE,
  type Layout,
  type Network,
} from './network';

const PAPER = '243 241 234';
const GREY = '154 150 140';
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
// Critically damped settle (Erlang CDF, k = 2): starts with zero velocity, lands without overshoot.
const settle = (t: number, tau: number): number => {
  if (t <= 0) return 0;
  const x = (t * 3) / tau;
  return 1 - Math.exp(-x) * (1 + x + (x * x) / 2);
};
const fade = (t: number, a: number, b: number, edge = 0.25): number => clamp01((t - a) / edge) * clamp01((b - t) / edge);

export type CircuitState = 'running' | 'paused' | 'still';

export type PhaseLabels = readonly [string, string, string, string];

export interface CircuitOptions {
  /** Layout, in CSS px. */
  measure: () => Layout;
  seed?: number;
  /** Tags for the four fault phases: failed, diagnosed, patched, verified. */
  labels?: PhaseLabels;
  dprCap?: number;
  /** Elements whose size changes should re-route the network. */
  observe?: Element[];
  onFirstFrame?: () => void;
  /** Called whenever the loop starts, pauses or settles on a still frame. */
  onState?: (state: CircuitState) => void;
}

export interface Circuit {
  render(t: number): void;
  /** Freeze on time t (null resumes the loop). */
  seek(t: number | null): void;
  /** Re-route after the layout changed (fonts loaded, copy resized). */
  remeasure(): void;
  /** Redraw the current frame without advancing time (fonts loaded). */
  refresh(): void;
  readonly running: boolean;
  stats(): { frames: number; dpr: number; avgMs: number; p95Ms: number };
  network(): Network;
  destroy(): void;
}

interface NetEntry {
  N: Network;
  p: number;
  dots: Path2D;
  traces: Path2D;
  pads: Path2D;
}

interface LabelledContext extends CanvasRenderingContext2D {
  letterSpacing: string;
}

const DEFAULT_LABELS: PhaseLabels = ['failed', 'diagnosed', 'patched', 'verified'];

export function createCircuit(canvas: HTMLCanvasElement, opts: CircuitOptions): Circuit | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const labels = opts.labels ?? DEFAULT_LABELS;
  const seed = opts.seed ?? 7;
  const dprCap = opts.dprCap ?? 2;
  const tailLen = 96;
  const glow = sprite('255 120 70');
  const glowPaper = sprite(PAPER);
  const reducedQ = matchMedia('(prefers-reduced-motion: reduce)');
  const REST_T = PHASES.healthy + PHASES.fail + PHASES.detect + PHASES.fix + 1.1;

  let geo: Layout | null = null;
  let dpr = 1;
  let nets = new Map<number, NetEntry>();
  let clock = 0;
  let last = 0;
  let raf = 0;
  let running = false;
  let visible = false;
  let destroyed = false;
  let seekT: number | null = null;
  let first = true;
  let frames = 0;
  let state: CircuitState | null = null;
  const dts: number[] = [];
  const REROUTE_T = 0.5;
  // The network routed for the previous layout, fading out after a re-route.
  let prev: { n: number; net: NetEntry; at: number } | null = null;
  let rerouteTimer = 0;

  const nextDpr = (): number => Math.min(window.devicePixelRatio || 1, dprCap);
  const same = (m: Layout): boolean =>
    geo !== null &&
    m.width === geo.width &&
    m.height === geo.height &&
    nextDpr() === dpr &&
    JSON.stringify(m.quiet) === JSON.stringify(geo.quiet) &&
    m.frameLeft === geo.frameLeft &&
    m.frameWidth === geo.frameWidth;

  function measure(): boolean {
    const m = opts.measure();
    if (same(m)) return false;
    const n = Math.floor(clock / NET_T);
    const cached = nets.get(n);
    prev = running && cached ? { n, net: cached, at: clock } : null;
    geo = m;
    dpr = nextDpr();
    canvas.width = Math.max(1, Math.round(m.width * dpr));
    canvas.height = Math.max(1, Math.round(m.height * dpr));
    nets = new Map();
    return true;
  }

  function net(n: number): NetEntry {
    const cached = nets.get(n);
    if (cached) return cached;
    if (!geo) throw new Error('circuit: layout not measured');
    const N = buildNetwork({ ...geo, seed: seed * 1009 + n * 7919 });
    const faultIds = new Set(N.faults.map((f) => f.trace));
    const dots = new Path2D();
    const { x0, y0, cols, rows, pitch } = N.grid;
    const inQuiet = (x: number, y: number): boolean =>
      N.quiet.some((q) => x > q.x - pitch * 0.6 && x < q.x + q.w + pitch * 0.6 && y > q.y - pitch * 0.6 && y < q.y + q.h + pitch * 0.6);
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const x = x0 + i * pitch;
        const y = y0 + j * pitch;
        if (!inQuiet(x, y)) dots.rect(x - 0.5, y - 0.5, 1, 1);
      }
    const traces = new Path2D();
    for (const t of N.traces) if (!faultIds.has(t.id)) traces.addPath(linePath(t.pts));
    const pads = new Path2D();
    const padAt = (x: number, y: number): void => pads.rect(x - 2.5, y - 2.5, 5, 5);
    for (const t of N.traces) {
      if (t.pads[0]) padAt(...t.pts[0]);
      if (t.pads[1]) padAt(...t.pts[t.pts.length - 1]);
    }
    const entry: NetEntry = { N, p: pitch, dots, traces, pads };
    nets.set(n, entry);
    if (nets.size > 3) {
      const oldest = nets.keys().next();
      if (!oldest.done) nets.delete(oldest.value);
    }
    return entry;
  }

  function drawNet(e: NetEntry, t: number, alpha: number): void {
    if (!ctx) return;
    const { N, p } = e;
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = rgba(PAPER, 0.09);
    ctx.fill(e.dots);
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = rgba(PAPER, 0.13);
    ctx.stroke(e.traces);
    ctx.fillStyle = '#0b0b0c';
    ctx.fill(e.pads);
    ctx.strokeStyle = rgba(PAPER, 0.3);
    ctx.stroke(e.pads);

    // Fault traces, drawn live.
    for (let j = 0; j < N.faults.length; j++) {
      const f = N.faults[j];
      const tr = N.traces[f.trace];
      const tm = f.times;
      const idle = rgba(PAPER, 0.13);
      const stroke = (pts: Point[], style: string, w = 1): void => {
        if (pts.length < 2) return;
        ctx.strokeStyle = style;
        ctx.lineWidth = w;
        ctx.stroke(linePath(pts));
      };
      if (t < tm.fail) {
        stroke(tr.pts, idle);
        continue;
      }
      const verified = t >= tm.verify;
      const flick = 0.35 + 0.65 * (hash01(j * 31 + 7, Math.floor(t * 15)) > 0.45 ? 1 : 0.15);
      if (!verified) {
        stroke(slicePath(tr, 0, f.dBreak - f.gap), idle);
        stroke(slicePath(tr, f.dBreak + f.gap, tr.len), rgba(GREY, 0.07 + 0.22 * flick));
      } else {
        const back = clamp01((t - tm.verify) / 0.8);
        stroke(slicePath(tr, 0, f.dSplit), idle);
        stroke(slicePath(tr, f.dSplit, f.dBreak - f.gap), rgba(GREY, 0.12));
        stroke(slicePath(tr, f.dBreak + f.gap, f.dJoin), rgba(GREY, 0.12));
        stroke(slicePath(tr, f.dJoin, tr.len), rgba(back < 1 ? GREY : PAPER, back < 1 ? 0.18 : 0.13));
        if (back < 1) stroke(slicePath(tr, f.dJoin, tr.len), rgba(PAPER, 0.13 * back));
      }
      // The two burnt ends of the break.
      const a = pointAt(tr, f.dBreak - f.gap);
      const b = pointAt(tr, f.dBreak + f.gap);
      const nx = f.side[0] / p;
      const ny = f.side[1] / p;
      const cap = verified ? 0.16 : 0.25 + 0.5 * flick;
      ctx.strokeStyle = rgba(GREY, cap);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const q of [a, b]) {
        ctx.moveTo(q[0] - nx * 3, q[1] - ny * 3);
        ctx.lineTo(q[0] + nx * 3, q[1] + ny * 3);
      }
      ctx.stroke();

      // Detection brackets.
      if (t >= tm.detect) {
        const s = 1 + 0.9 * (1 - settle(t - tm.detect, 0.55));
        const al = fade(t, tm.detect, tm.end - 0.3, 0.3) * 0.9;
        const ux = (b[0] - a[0]) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1);
        const uy = (b[1] - a[1]) / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1);
        const cx = (a[0] + b[0]) / 2;
        const cy = (a[1] + b[1]) / 2;
        const hu = p * 0.95 * s;
        const hn = p * 0.5 * s;
        const arm = p * 0.28;
        ctx.strokeStyle = rgba(PAPER, al);
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        for (const su of [-1, 1])
          for (const sn of [-1, 1]) {
            const kx = cx + ux * hu * su + nx * hn * sn;
            const ky = cy + uy * hu * su + ny * hn * sn;
            ctx.moveTo(kx - ux * arm * su, ky - uy * arm * su);
            ctx.lineTo(kx, ky);
            ctx.lineTo(kx - nx * arm * sn, ky - ny * arm * sn);
          }
        ctx.stroke();
      }

      // The repair: a paper-white detour drawn in, then kept as a quiet mark.
      if (t >= tm.fix) {
        const prog = settle(t - tm.fix, PHASES.fix * 0.85);
        const len = f.detour.len * prog;
        const al = t < tm.verify ? 0.95 : 0.95 - 0.55 * clamp01((t - tm.verify) / 1.6);
        stroke(slicePath(f.detour, 0, len), rgba(PAPER, al), 1.25);
        if (prog < 0.995) {
          const [hx, hy] = pointAt(f.detour, len);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = alpha * 0.9;
          ctx.drawImage(glowPaper, hx - 13, hy - 13, 26, 26);
          ctx.globalAlpha = alpha;
          ctx.globalCompositeOperation = 'source-over';
        }
      }

      // Phase tag, on the side away from the detour.
      const tags: [number, number, string, string][] = [
        [tm.fail + 0.25, tm.detect, labels[0], GREY],
        [tm.detect + 0.15, tm.fix, labels[1], PAPER],
        [tm.fix + 0.15, tm.verify, labels[2], PAPER],
        [tm.verify + 0.15, tm.end - 0.35, labels[3], PAPER],
      ];
      for (const [t0, t1, text, col] of tags) {
        const al = fade(t, t0, t1, 0.2);
        if (al <= 0) continue;
        const cx = (a[0] + b[0]) / 2 - nx * p * 1.05;
        const cy = (a[1] + b[1]) / 2 - ny * p * 1.05;
        ctx.font = '500 9.5px "Geist Mono", ui-monospace, monospace';
        if ('letterSpacing' in ctx) (ctx as LabelledContext).letterSpacing = '0.8px';
        ctx.textAlign = Math.abs(nx) > 0.5 ? (nx > 0 ? 'right' : 'left') : 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = rgba(col, al * (col === GREY ? 0.9 : 0.85));
        ctx.fillText(text.toUpperCase(), cx, cy);
      }
    }

    // Sparks, added light (a stalled spark's tail shrinks and its head flickers and swells).
    ctx.globalCompositeOperation = 'lighter';
    const tail = tailLen * (p / 38) ** 0.5;
    for (const tr of N.traces) {
      const f = tr.fault != null ? N.faults[tr.fault] : null;
      eachSpark(tr, f, t, tail, (path, d, al, stalled) => {
        const tl = stalled ? tail * Math.max(0, 1 - stalled / 0.45) : tail;
        const flick = stalled ? 0.45 + 0.55 * hash01(tr.id * 13 + Math.floor(t * 24), 3) : 1;
        drawSpark(ctx, path, d, tl, al * alpha, { glow, r: stalled ? 11 + stalled * 12 : 12, flick });
      });
      // Pad flash where a spark lands.
      if (tr.pads[1]) {
        const since = t - lastArrival(tr, f, t);
        if (since < 0.7) {
          const [x, y] = tr.pts[tr.pts.length - 1];
          ctx.globalAlpha = alpha * (1 - since / 0.7) * 0.85;
          ctx.drawImage(glow, x - 12, y - 12, 24, 24);
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Draw the frame at time t (seconds). */
  function render(t: number): void {
    if (!ctx) return;
    if (!geo) measure();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.floor(t / NET_T);
    const tl = t - n * NET_T;
    if (prev && !(n === prev.n && t >= prev.at && t - prev.at < REROUTE_T)) prev = null;
    const k = prev ? (t - prev.at) / REROUTE_T : 1;
    if (prev) drawNet(prev.net, tl, 1 - k);
    if (n > 0 && tl < XFADE) drawNet(net(n - 1), tl + NET_T, (1 - tl / XFADE) * k);
    drawNet(net(n), tl, (n > 0 ? Math.min(1, tl / XFADE) : 1) * k);
    if (first) {
      first = false;
      opts.onFirstFrame?.();
    }
  }

  function tick(now: number): void {
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    clock += dt;
    frames++;
    dts.push(dt);
    if (dts.length > 240) dts.shift();
    render(clock);
    raf = requestAnimationFrame(tick);
  }

  function setState(next: CircuitState): void {
    if (state === next) return;
    state = next;
    opts.onState?.(next);
  }

  function update(): void {
    const want = !destroyed && !reducedQ.matches && visible && document.visibilityState === 'visible' && seekT === null;
    if (want && !running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    } else if (!want && running) {
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
    }
    if (!running && !destroyed) render(seekT ?? (reducedQ.matches ? REST_T : clock || REST_T));
    if (!destroyed) setState(running ? 'running' : reducedQ.matches || seekT !== null ? 'still' : 'paused');
  }

  const io = new IntersectionObserver((entries) => {
    const latest = entries[entries.length - 1];
    if (!latest) return;
    visible = latest.isIntersecting;
    update();
  });
  io.observe(canvas);
  const onVis = (): void => update();
  document.addEventListener('visibilitychange', onVis);
  reducedQ.addEventListener('change', onVis);
  // A size change can come every frame (a panel opening under the headline). Re-routing on each one cleared
  // the canvas after its frame was drawn (a blank flash) and swapped layouts mid-tween, so the canvas holds
  // its size until the layout settles, then re-routes once and crossfades to the new network.
  const ro = new ResizeObserver(() => {
    if (!geo || same(opts.measure())) return;
    if (!canvas.style.height) Object.assign(canvas.style, { width: `${geo.width}px`, height: `${geo.height}px` });
    clearTimeout(rerouteTimer);
    rerouteTimer = window.setTimeout(() => {
      canvas.style.width = canvas.style.height = '';
      if (measure() && !running) update();
    }, 160);
  });
  ro.observe(canvas);
  for (const el of opts.observe ?? []) ro.observe(el);

  measure();
  // Before the first frame, start a little into the healthy phase so sparks are already in flight.
  clock = 0.6;
  update();

  return {
    render,
    seek(t) {
      seekT = t;
      update();
    },
    remeasure() {
      if (measure()) update();
    },
    refresh() {
      if (!running) update();
    },
    get running() {
      return running;
    },
    stats() {
      const s = dts.slice().sort((a, b) => a - b);
      return {
        frames,
        dpr,
        avgMs: (s.reduce((a, b) => a + b, 0) / (s.length || 1)) * 1000,
        p95Ms: (s[Math.floor(s.length * 0.95)] || 0) * 1000,
      };
    },
    network() {
      return net(Math.floor((seekT ?? clock) / NET_T)).N;
    },
    destroy() {
      destroyed = true;
      running = false;
      cancelAnimationFrame(raf);
      clearTimeout(rerouteTimer);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      reducedQ.removeEventListener('change', onVis);
      nets = new Map();
    },
  };
}
