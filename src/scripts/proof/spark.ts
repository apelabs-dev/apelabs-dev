// The circuit's spark, shared by the hero canvas (hero/circuit.ts) and the proof rail: an orange head with a
// soft glow and a five-step fading tail, drawn along a path (makePath). Canvas 2D; the caller sets the
// composite mode (the hero and the rail both add light: 'lighter').
//
// The path helpers the spark needs (makePath, pointAt, slicePath) live here too, so a consumer can import
// everything from this one module without reaching into the hero's private files.

export type Point = [number, number];

/** A polyline with cumulative lengths, ready for point-at-distance lookups. */
export interface Path {
  pts: Point[];
  cum: number[];
  len: number;
}

export interface SparkOptions {
  /** Glow sprite from `sprite()`. */
  glow: HTMLCanvasElement;
  /** Glow radius in CSS px. */
  r?: number;
  /** Dims the head only (a stalled spark). */
  flick?: number;
}

export const ORANGE = '255 107 53';
export const rgba = (c: string, a: number): string => `rgb(${c} / ${a.toFixed(3)})`;

/** A radial glow sprite, drawn once and stamped per frame. */
export function sprite(rgb: string, size = 64): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (!g) return c;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgb(${rgb} / 0.95)`);
  grad.addColorStop(0.18, `rgb(${rgb} / 0.55)`);
  grad.addColorStop(0.5, `rgb(${rgb} / 0.12)`);
  grad.addColorStop(1, `rgb(${rgb} / 0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

export const linePath = (pts: readonly Point[]): Path2D => {
  const p = new Path2D();
  if (!pts.length) return p;
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  return p;
};

/** A polyline with cumulative lengths, ready for point-at-distance lookups. */
export function makePath(pts: Point[]): Path {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return { pts, cum, len: cum[cum.length - 1] };
}

/** Point at distance d along a path (clamped). */
export function pointAt(path: Path, d: number): Point {
  const { pts, cum } = path;
  if (d <= 0) return pts[0];
  if (d >= path.len) return pts[pts.length - 1];
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const t = (d - cum[lo]) / (cum[hi] - cum[lo] || 1);
  return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t];
}

/** The part of a path between distances d0 and d1, as a point list. */
export function slicePath(path: Path, d0: number, d1: number): Point[] {
  d0 = Math.max(0, d0);
  d1 = Math.min(path.len, d1);
  if (d1 <= d0) return [];
  const out: Point[] = [pointAt(path, d0)];
  for (let i = 1; i < path.pts.length - 1; i++) if (path.cum[i] > d0 && path.cum[i] < d1) out.push(path.pts[i]);
  out.push(pointAt(path, d1));
  return out;
}

/**
 * One spark whose head is at distance d along path: the tail (length `tail`) in five steps, brighter towards
 * the head, then the glow (radius r) and the head's hot core while the head is still on the path.
 * `alpha` is the spark's opacity (0–1); `flick` dims the head only (a stalled spark).
 */
export function drawSpark(
  ctx: CanvasRenderingContext2D,
  path: Path,
  d: number,
  tail: number,
  alpha: number,
  { glow, r = 12, flick = 1 }: SparkOptions,
): void {
  const head = Math.min(d, path.len);
  const from = d - tail;
  for (let s = 0; s < 5; s++) {
    const pts = slicePath(path, from + (s * tail) / 5, Math.min(head, from + ((s + 1) * tail) / 5));
    if (pts.length < 2) continue;
    ctx.strokeStyle = rgba(ORANGE, alpha * (0.1 + 0.16 * s));
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 1;
    ctx.stroke(linePath(pts));
  }
  if (d <= path.len) {
    const [x, y] = pointAt(path, d);
    ctx.globalAlpha = alpha * flick;
    ctx.drawImage(glow, x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = 'rgb(255 214 196)';
    ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
  }
}
