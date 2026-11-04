// Static SVG of the circuit at rest, after its first repair: the same network the canvas draws (same
// generator, same seed), for readers without JavaScript. Pure string output, so it runs at build time.
import { pointAt, slicePath, type Point } from '../circuit/spark';
import { buildNetwork, eachSpark, PHASES, type Layout } from './network';

export interface PosterInput extends Layout {
  /** The canvas's seed. */
  seed?: number;
  /** Prefix for the SVG's own element ids, so two posters on one page do not collide. */
  idPrefix?: string;
}

const f1 = (n: number): number => Math.round(n * 10) / 10;
const d = (pts: Point[]): string => (pts.length < 2 ? '' : `M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}`);

/** An `<svg>` element, aria-hidden, sized to o.width × o.height. */
export function posterSVG(o: PosterInput): string {
  const N = buildNetwork({ ...o, seed: (o.seed ?? 7) * 1009 });
  const p = N.grid.pitch;
  const id = o.idPrefix || 'cp';
  const t = PHASES.healthy + PHASES.fail + PHASES.detect + PHASES.fix + 1.1;
  const faultIds = new Set(N.faults.map((f) => f.trace));
  const quiet = (x: number, y: number): boolean =>
    N.quiet.some((q) => x > q.x - p * 0.6 && x < q.x + q.w + p * 0.6 && y > q.y - p * 0.6 && y < q.y + q.h + p * 0.6);

  let dots = '';
  for (let j = 0; j < N.grid.rows; j++)
    for (let i = 0; i < N.grid.cols; i++) {
      const x = N.grid.x0 + i * p;
      const y = N.grid.y0 + j * p;
      if (!quiet(x, y)) dots += `M${f1(x - 0.5)} ${f1(y - 0.5)}h1v1h-1z`;
    }
  const idle = N.traces
    .filter((tr) => !faultIds.has(tr.id))
    .map((tr) => d(tr.pts))
    .join('');
  let pads = '';
  for (const tr of N.traces) {
    for (const [k, on] of tr.pads.entries()) {
      if (!on) continue;
      const [x, y] = k === 0 ? tr.pts[0] : tr.pts[tr.pts.length - 1];
      pads += `<rect x="${f1(x - 2.5)}" y="${f1(y - 2.5)}" width="5" height="5"/>`;
    }
  }

  // First fault repaired; later faults not reached yet.
  let faults = '';
  N.faults.forEach((f, j) => {
    const tr = N.traces[f.trace];
    if (j > 0) {
      faults += `<path d="${d(tr.pts)}" stroke="rgb(243 241 234 / 0.13)"/>`;
      return;
    }
    faults +=
      `<path d="${d(slicePath(tr, 0, f.dSplit))}${d(slicePath(tr, f.dJoin, tr.len))}" stroke="rgb(243 241 234 / 0.13)"/>` +
      `<path d="${d(slicePath(tr, f.dSplit, f.dBreak - f.gap))}${d(slicePath(tr, f.dBreak + f.gap, f.dJoin))}" stroke="rgb(154 150 140 / 0.14)"/>` +
      `<path d="${d(f.detour.pts)}" stroke="rgb(243 241 234 / 0.6)" stroke-width="1.25"/>`;
  });

  // Sparks frozen where they are at that moment.
  let tails = '';
  let heads = '';
  const tail = 96 * (p / 38) ** 0.5;
  for (const tr of N.traces) {
    const f = tr.fault != null ? N.faults[tr.fault] : null;
    eachSpark(tr, f, t, tail, (path, dist, _alpha, stalled) => {
      if (stalled || dist > path.len) return;
      tails += d(slicePath(path, dist - tail * 0.6, dist));
      const [x, y] = pointAt(path, dist);
      heads += `<circle cx="${f1(x)}" cy="${f1(y)}" r="10" fill="url(#${id}-g)"/><rect x="${f1(x - 1.2)}" y="${f1(y - 1.2)}" width="2.4" height="2.4" fill="rgb(255 214 196)"/>`;
    });
  }

  return (
    `<svg class="circuit-poster" viewBox="0 0 ${o.width} ${o.height}" width="${o.width}" height="${o.height}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">` +
    `<defs><radialGradient id="${id}-g"><stop offset="0" stop-color="rgb(255 120 70 / 0.9)"/><stop offset="0.2" stop-color="rgb(255 120 70 / 0.5)"/><stop offset="1" stop-color="rgb(255 120 70 / 0)"/></radialGradient></defs>` +
    `<path d="${dots}" fill="rgb(243 241 234 / 0.09)"/>` +
    `<g fill="none" stroke-linejoin="round"><path d="${idle}" stroke="rgb(243 241 234 / 0.13)"/>${faults}<path d="${tails}" stroke="rgb(255 107 53 / 0.4)" stroke-width="1.5"/></g>` +
    `<g fill="#0b0b0c" stroke="rgb(243 241 234 / 0.3)">${pads}</g>` +
    heads +
    `</svg>`
  );
}
