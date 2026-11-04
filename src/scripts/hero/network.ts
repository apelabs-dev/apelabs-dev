// Circuit network: traces routed on a grid that is locked to the page's six-column lattice, kept out of
// "quiet" rectangles (the headline block), with a planned break-and-repair for a few of them.
//
// Everything here is a pure function of its inputs and a seed: the same size, lattice and seed always
// give the same network, so the live canvas, a seek() for screenshots and the build-time SVG poster all
// draw the same thing. No DOM access.
import { makePath, pointAt, slicePath, type Path, type Point } from '../circuit/spark';

export interface QuietRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The layout a network is routed for, in CSS px. */
export interface Layout {
  width: number;
  height: number;
  /** Left edge and width of the six-column frame inside the canvas. */
  frameLeft: number;
  frameWidth: number;
  /** Rectangles no trace may cross (the headline block). */
  quiet: QuietRect[];
  /** y below which faults may sit (keeps them clear of a fixed bar). */
  top?: number;
}

export interface NetworkInput extends Layout {
  seed: number;
}

export interface Grid {
  pitch: number;
  per: number;
  x0: number;
  y0: number;
  cols: number;
  rows: number;
  width: number;
  height: number;
  frameLeft: number;
  frameWidth: number;
}

export interface FaultTimes {
  start: number;
  fail: number;
  detect: number;
  fix: number;
  verify: number;
  end: number;
}

export interface Trace extends Path {
  id: number;
  grid: Point[];
  /** Whether each end carries a pad (an end that runs off-screen does not). */
  pads: [boolean, boolean];
  speed: number;
  period: number;
  phase: number;
  /** Index into Network.faults when this trace breaks. */
  fault?: number;
}

export interface Fault {
  trace: number;
  mid: Point;
  dSplit: number;
  dJoin: number;
  dBreak: number;
  gap: number;
  detour: Path;
  repaired: Path;
  side: Point;
  times: FaultTimes;
}

export interface Network {
  grid: Grid;
  traces: Trace[];
  faults: Fault[];
  quiet: QuietRect[];
}

/** Small fast seeded PRNG (mulberry32). Returns floats in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stateless hash to [0, 1) for per-spark jitter. */
export function hash01(a: number, b = 0): number {
  let x = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca77);
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d);
  x = Math.imul(x ^ (x >>> 12), 0x297a2d39);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}

// Fault cycle, in seconds: healthy, then the trace fails, the break is found, a repair is routed, and
// the rerun is verified. Three faults per network, then the next network fades in.
export const PHASES = { healthy: 2.5, fail: 2.6, detect: 1.4, fix: 1.6, verified: 2.4 } as const;
export const FAULT_T = PHASES.healthy + PHASES.fail + PHASES.detect + PHASES.fix + PHASES.verified;
export const FAULTS_PER_NET = 3;
export const NET_T = FAULT_T * FAULTS_PER_NET;
export const XFADE = 1.2;

/** Start times of each phase of fault j, in network-local seconds. */
export function faultTimes(j: number): FaultTimes {
  const s = j * FAULT_T;
  const fail = s + PHASES.healthy;
  const detect = fail + PHASES.fail;
  const fix = detect + PHASES.detect;
  const verify = fix + PHASES.fix;
  return { start: s, fail, detect, fix, verify, end: s + FAULT_T };
}

const E: Point = [1, 0];
const S: Point = [0, 1];
const W: Point = [-1, 0];
const N: Point = [0, -1];
const DIRS: Point[] = [E, S, W, N];
const left = (d: Point): Point => DIRS[(DIRS.indexOf(d) + 3) % 4];
const right = (d: Point): Point => DIRS[(DIRS.indexOf(d) + 1) % 4];

/**
 * Routing grid locked to the lattice: one node every column / n, where n keeps the pitch near 38px
 * (four nodes per column at 1280 wide, one per column on phones). Nodes run a little past every edge
 * so traces can enter from off-screen.
 */
export function gridFor({ width, height, frameLeft, frameWidth }: Layout): Grid {
  const col = frameWidth / 6;
  const per = Math.max(1, Math.round(col / 38));
  const pitch = col / per;
  const x0 = frameLeft - Math.ceil(frameLeft / pitch) * pitch;
  const cols = Math.ceil((width - x0) / pitch) + 1;
  const y0 = -((pitch - (height % pitch)) % pitch) / 2;
  const rows = Math.ceil((height - y0) / pitch) + 1;
  return { pitch, per, x0, y0, cols, rows, width, height, frameLeft, frameWidth };
}

interface Site {
  run: Point[];
  u: Point;
  n: Point;
  det: Point[];
  mid: Point;
  dq: number;
  horiz: boolean;
}

interface RawTrace {
  nodes: Point[];
  corners: Point[];
  site?: Site;
}

/**
 * Build one network (orthogonal routing: square corners, square pads).
 * Fault sites come first, so they always exist and sit where they read best; every other trace is then a
 * seeded random walk on the free nodes.
 */
export function buildNetwork(o: NetworkInput): Network {
  const g = gridFor(o);
  const { pitch, cols, rows, x0, y0 } = g;
  const rand = rng(o.seed);
  const occ = new Uint8Array(cols * rows); // 0 free, 1 trace, 2 quiet, 3 detour lane
  const at = (i: number, j: number): number => i + j * cols;
  const inGrid = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < cols && j < rows;
  const px = (i: number): number => x0 + i * pitch;
  const py = (j: number): number => y0 + j * pitch;
  const pad = pitch * 0.6;
  for (const q of o.quiet) {
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const x = px(i);
        const y = py(j);
        if (x > q.x - pad && x < q.x + q.w + pad && y > q.y - pad && y < q.y + q.h + pad) occ[at(i, j)] = 2;
      }
  }
  const free = (i: number, j: number): boolean => inGrid(i, j) && occ[at(i, j)] === 0;
  const edge = (i: number, j: number): boolean => i <= 0 || j <= 0 || i >= cols - 1 || j >= rows - 1;

  // One walk on the grid: mostly straight, turning only after a minimum run, preferring to alternate
  // turn direction so traces step across the board instead of curling up.
  function walk(i: number, j: number, d: Point, maxSteps: number, minRun: number, turnP: number): Point[] {
    const nodes: Point[] = [[i, j]];
    occ[at(i, j)] = 1;
    let run = 0;
    let lastTurn = 0;
    for (let s = 0; s < maxSteps; s++) {
      const canAhead = free(i + d[0], j + d[1]);
      const wantTurn = run >= minRun && rand() < turnP;
      let next: Point | null = null;
      if (canAhead && !wantTurn) next = d;
      else {
        const prefer: Point[] =
          lastTurn === 1 ? [left(d), right(d)] : lastTurn === -1 ? [right(d), left(d)] : rand() < 0.5 ? [left(d), right(d)] : [right(d), left(d)];
        if (rand() < 0.25) prefer.reverse();
        if (run >= minRun) {
          for (const t of prefer) {
            const a: Point = [i + t[0], j + t[1]];
            const b: Point = [i + 2 * t[0], j + 2 * t[1]];
            if (free(a[0], a[1]) && (free(b[0], b[1]) || !inGrid(b[0], b[1]))) {
              lastTurn = t === left(d) ? -1 : 1;
              next = t;
              break;
            }
          }
        }
        if (!next && canAhead) next = d;
      }
      if (!next) break;
      if (next !== d) run = 0;
      d = next;
      i += d[0];
      j += d[1];
      run++;
      occ[at(i, j)] = 1;
      nodes.push([i, j]);
      if (edge(i, j) && s > 2) break;
    }
    return nodes;
  }

  // Corners only.
  const corners = (nodes: Point[]): Point[] => {
    const out: Point[] = [nodes[0]];
    for (let k = 1; k < nodes.length - 1; k++) {
      const a = nodes[k - 1];
      const b = nodes[k];
      const c = nodes[k + 1];
      if (b[0] - a[0] !== c[0] - b[0] || b[1] - a[1] !== c[1] - b[1]) out.push(b);
    }
    out.push(nodes[nodes.length - 1]);
    return out;
  };

  // A fault site is a straight run of eight nodes, fully on screen, clear of the headline and the bar, with
  // the row beside the middle four nodes kept free for the detour. Each site then grows into a full trace in
  // both directions.
  const top = o.top ?? 0;
  const visible = (x: number, y: number): boolean => x > pitch * 0.8 && x < o.width - pitch * 0.8 && y > top + pitch * 0.8 && y < o.height - pitch * 0.8;
  const qc = o.quiet[0];
  const sites: Site[] = [];
  const siteCands: Site[] = [];
  for (const u of [E, S])
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const run: Point[] = Array.from({ length: 8 }, (_, s): Point => [i + u[0] * s, j + u[1] * s]);
        if (!run.every(([a, b]) => free(a, b))) continue;
        const A: Point = [px(run[2][0]), py(run[2][1])];
        const B: Point = [px(run[5][0]), py(run[5][1])];
        if (!visible(A[0], A[1]) || !visible(B[0], B[1])) continue;
        const mid: Point = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
        const dq = qc ? Math.hypot(Math.max(qc.x - mid[0], 0, mid[0] - qc.x - qc.w), Math.max(qc.y - mid[1], 0, mid[1] - qc.y - qc.h)) : pitch * 9;
        if (dq < pitch * 2.4 || mid[1] > o.height - pitch * 2.2) continue;
        for (const side of [1, -1]) {
          const n: Point = [-u[1] * side, u[0] * side];
          const det: Point[] = [2, 3, 4, 5].map((s): Point => [run[s][0] + n[0], run[s][1] + n[1]]);
          if (det.every(([a, b]) => free(a, b))) siteCands.push({ run, u, n, det, mid, dq, horiz: u === E });
        }
      }
  for (let f = 0; f < FAULTS_PER_NET; f++) {
    let best: Site | null = null;
    let bestScore = -Infinity;
    for (const c of siteCands) {
      if (![...c.run, ...c.det].every(([a, b]) => free(a, b))) continue;
      const far = sites.length ? Math.min(...sites.map((x) => Math.hypot(x.mid[0] - c.mid[0], x.mid[1] - c.mid[1]))) : 0;
      if (sites.length && far < pitch * 5) continue;
      const midY = Math.abs(c.mid[1] - o.height * 0.52) / o.height;
      // First fault: close to the headline, around mid-height, on a horizontal run. Later: spread out.
      const margin = c.mid[0] < o.frameLeft || c.mid[0] > o.frameLeft + o.frameWidth ? pitch * 4 : 0;
      const score = (f === 0 ? -Math.abs(c.dq - pitch * 3.2) - midY * pitch * 12 + (c.horiz ? pitch * 2 : 0) : far * 0.6 - c.dq * 0.2) - margin;
      if (score + rand() * pitch * 1.5 > bestScore) {
        bestScore = score + rand() * pitch * 1.5;
        best = c;
      }
    }
    if (!best) break;
    for (const [a, b] of best.run) occ[at(a, b)] = 1;
    for (const [a, b] of best.det) occ[at(a, b)] = 3;
    sites.push(best);
  }

  const raw: RawTrace[] = [];
  for (const site of sites) {
    const { run, u } = site;
    const back: Point[] = [];
    const fwd: Point[] = [];
    const b0: Point = [run[0][0] - u[0], run[0][1] - u[1]];
    if (free(b0[0], b0[1])) back.push(...walk(b0[0], b0[1], [-u[0], -u[1]], 3 + Math.floor(rand() * 10), 2, 0.22));
    const f0: Point = [run[7][0] + u[0], run[7][1] + u[1]];
    if (free(f0[0], f0[1])) fwd.push(...walk(f0[0], f0[1], u, 3 + Math.floor(rand() * 10), 2, 0.22));
    const nodes = [...back.reverse(), ...run, ...fwd];
    raw.push({ nodes, corners: corners(nodes), site });
  }
  let freeCount = 0;
  for (const v of occ) if (v === 0) freeCount++;
  const want = freeCount * 0.56;
  let used = 0;
  for (let attempt = 0; attempt < 4000 && used < want; attempt++) {
    const i = Math.floor(rand() * cols);
    const j = Math.floor(rand() * rows);
    if (!free(i, j)) continue;
    const horiz = rand() < 0.62;
    const d = horiz ? (rand() < 0.5 ? E : W) : rand() < 0.5 ? S : N;
    const nodes = walk(i, j, d, 4 + Math.floor(rand() * 26), 2, 0.24);
    if (nodes.length < 4) {
      for (const [a, b] of nodes) occ[at(a, b)] = 0;
      continue;
    }
    raw.push({ nodes, corners: corners(nodes) });
    used += nodes.length;
  }

  // Geometry in px.
  const traces: Trace[] = raw.map((r, idx) => {
    let pts = r.corners.map(([i, j]): Point => [px(i), py(j)]);
    const first = r.nodes[0];
    const last = r.nodes[r.nodes.length - 1];
    const aEdge = edge(first[0], first[1]);
    const bEdge = edge(last[0], last[1]);
    // Sparks enter from an off-screen end when there is one.
    const flip = bEdge && !aEdge ? true : aEdge ? false : rand() < 0.5;
    if (flip) pts = pts.slice().reverse();
    const path = makePath(pts);
    const speed = (150 + rand() * 110) * (pitch / 38) ** 0.5;
    return {
      id: idx,
      ...path,
      grid: flip ? r.nodes.slice().reverse() : r.nodes,
      pads: [flip ? !bEdge : !aEdge, flip ? !aEdge : !bEdge],
      speed,
      period: Math.max(1.1, (path.len / speed) * (0.55 + rand() * 1.1)),
      phase: rand() * 9,
    };
  });

  // Faults, in site order: split before the break, rejoin after it, detour one pitch to the side.
  const faults: Fault[] = [];
  traces.forEach((t, idx) => {
    const site = raw[idx].site;
    if (!site) return;
    let A: Point = [px(site.run[2][0]), py(site.run[2][1])];
    let B: Point = [px(site.run[5][0]), py(site.run[5][1])];
    if (distanceTo(t, A) > distanceTo(t, B)) [A, B] = [B, A];
    const n: Point = [site.n[0] * pitch, site.n[1] * pitch];
    const detour: Point[] = [A, [A[0] + n[0], A[1] + n[1]], [B[0] + n[0], B[1] + n[1]], B];
    const dSplit = distanceTo(t, A);
    const dJoin = distanceTo(t, B);
    faults.push({
      trace: t.id,
      mid: site.mid,
      dSplit,
      dJoin,
      dBreak: (dSplit + dJoin) / 2,
      gap: pitch * 0.32,
      detour: makePath(detour),
      repaired: makePath([...slicePath(t, 0, dSplit), ...detour.slice(1, -1), ...slicePath(t, dJoin, t.len)]),
      side: n,
      times: faultTimes(faults.length),
    });
    t.fault = faults.length - 1;
  });

  return { grid: g, traces, faults, quiet: o.quiet };
}

function distanceTo(path: Path, p: Point): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < path.pts.length - 1; i++) {
    const [ax, ay] = path.pts[i];
    const [bx, by] = path.pts[i + 1];
    const l = Math.hypot(bx - ax, by - ay) || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * (bx - ax) + (p[1] - ay) * (by - ay)) / (l * l)));
    const d = Math.hypot(ax + (bx - ax) * t - p[0], ay + (by - ay) * t - p[1]);
    if (d < bestD) {
      bestD = d;
      best = path.cum[i] + l * t;
    }
  }
  return best;
}

/** Called for each live spark: the head is at distance d along path, `stalled` seconds into a fizzle. */
export type SparkEmit = (path: Path, d: number, alpha: number, stalled: number) => void;

/**
 * Where every spark on a trace is at network time t. Pure: spark k of a trace leaves at a fixed time,
 * so any frame can be drawn on its own. For a fault trace, a spark that reaches the break while it is
 * broken stalls there and fizzles out; once the repair is verified, sparks take the detour.
 */
export function eachSpark(trace: Trace, fault: Fault | null, t: number, tail: number, emit: SparkEmit): void {
  const { period, phase, speed } = trace;
  const kMax = Math.floor((t - phase) / period);
  const life = (Math.max(trace.len, fault ? fault.repaired.len : 0) + tail) / speed;
  const kMin = Math.floor((t - phase - life) / period) - 1;
  for (let k = kMin; k <= kMax; k++) {
    const t0 = phase + k * period + hash01(trace.id, k) * period * 0.35;
    if (t0 > t) continue;
    const d = (t - t0) * speed;
    if (!fault) {
      if (d - tail > trace.len) continue;
      emit(trace, d, 1, 0);
      continue;
    }
    const tm = fault.times;
    const tSplit = t0 + fault.dSplit / speed;
    const tBreak = t0 + fault.dBreak / speed;
    if (tSplit >= tm.verify - 0.15) {
      // Repaired route.
      if (d - tail > fault.repaired.len) continue;
      emit(fault.repaired, d, 1, 0);
    } else if (tBreak >= tm.fail && tBreak < tm.end) {
      // Reaches the break while it is broken: stall and fizzle for 0.7s.
      const stopAt = fault.dBreak - fault.gap;
      if (d < stopAt) emit(trace, d, 1, 0);
      else {
        const since = (d - stopAt) / speed;
        if (since < 0.7) emit(trace, stopAt, 1 - since / 0.7, since);
      }
    } else {
      if (d - tail > trace.len) continue;
      emit(trace, d, 1, 0);
    }
  }
}

/** When the latest spark arrived at the far end of a trace (for the pad flash), or -Infinity. */
export function lastArrival(trace: Trace, fault: Fault | null, t: number): number {
  const speed = trace.speed;
  const kTop = Math.floor((t - trace.phase) / trace.period);
  for (let k = kTop; k > kTop - 4; k--) {
    const t0 = trace.phase + k * trace.period + hash01(trace.id, k) * trace.period * 0.35;
    let len = trace.len;
    if (fault) {
      const tSplit = t0 + fault.dSplit / speed;
      const tBreak = t0 + fault.dBreak / speed;
      if (tSplit >= fault.times.verify - 0.15) len = fault.repaired.len;
      else if (tBreak >= fault.times.fail && tBreak < fault.times.end) continue;
    }
    const arrive = t0 + len / speed;
    if (arrive <= t) return arrive;
  }
  return -Infinity;
}
