// The brand kit's "C motif", reimplemented for inline SVG: a flow line made of rounded blocks.
// It breaks, two ink fragments fall out of the line, orange repair blocks bridge the gap (the
// first one lifted), and the line carries on. Pure geometry; components render the rects.

export type BlockKind = 'ink' | 'dim' | 'fix' | 'frag1' | 'frag2';

export interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
  kind: BlockKind;
}

interface LineOpts {
  /** Start and end along the line's axis. */
  from: number;
  to: number;
  /** Position across the axis (y for horizontal, x for vertical). */
  at: number;
  /** Block thickness. */
  t: number;
  /** Block length; defaults to 3t like the kit. */
  seg?: number;
  vertical?: boolean;
  kind?: BlockKind;
}

const gapOf = (t: number) => t * 0.45;
const rxOf = (t: number) => t * 0.22;

/** Rect in line space (u along the axis, v across it), mapped to x/y. */
function rect(u: number, v: number, len: number, t: number, kind: BlockKind, vertical: boolean): Block {
  const rx = rxOf(t);
  return vertical ? { x: v, y: u, w: t, h: len, rx, kind } : { x: u, y: v, w: len, h: t, rx, kind };
}

/**
 * Blocks that fill [from, to] exactly: the count nearest to `seg`-long blocks, all the same length,
 * so a run never ends in a stub where it meets a node.
 */
function fitRun(from: number, to: number, at: number, t: number, seg: number, kind: BlockKind, vertical: boolean): Block[] {
  const len = to - from;
  if (len <= 0.5) return [];
  const gap = gapOf(t);
  const n = Math.max(1, Math.round((len + gap) / (seg + gap)));
  const w = (len - (n - 1) * gap) / n;
  return Array.from({ length: n }, (_, i) => rect(from + i * (w + gap), at - t / 2, w, t, kind, vertical));
}

/** An unbroken block line from `from` to `to`. */
export function blockLine({ from, to, at, t, seg = t * 3, vertical = false, kind = 'ink' }: LineOpts): Block[] {
  return fitRun(from, to, at, t, seg, kind, vertical);
}

/**
 * The repair line: blocks up to `breakFrom`, an orange bridge to `breakTo` (first block lifted
 * by 1.15t, toward negative v), two displaced ink fragments on the positive side, then blocks on.
 */
export function repairLine(
  opts: LineOpts & { breakFrom: number; breakTo: number; fragments?: boolean; bridge?: boolean },
): Block[] {
  const { from, to, at, t, seg = t * 3, vertical = false, breakFrom, breakTo, fragments = true, bridge = true } = opts;
  const gap = gapOf(t);
  const out: Block[] = fitRun(from, breakFrom, at, t, seg, 'ink', vertical);
  const leftEnd = breakFrom;
  const rise = t * 1.15;
  const span = breakTo - leftEnd;
  const n = Math.max(2, Math.round(span / (seg + gap)));
  const w = (span - (n - 1) * gap - gap) / n;
  for (let i = 0; bridge && i < n; i++) {
    const uu = leftEnd + gap + i * (w + gap);
    out.push(rect(uu, at - t / 2 - (i === 0 ? rise : 0), w, t, 'fix', vertical));
  }
  if (fragments) {
    const fu = leftEnd + gap * 0.6;
    out.push(rect(fu, at + t * 1.35, seg * 0.8, t, 'frag1', vertical));
    out.push(rect(fu + seg * 0.95, at + t * 2.6, seg * 0.8, t, 'frag2', vertical));
  }
  out.push(...fitRun(breakTo + gap, to, at, t, seg, 'ink', vertical));
  return out;
}

/** Dot-matrix grid centres, the kit's backdrop between thin rules. */
export function dotGrid(x0: number, y0: number, x1: number, y1: number, step: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let y = y0; y <= y1 + 1e-6; y += step) for (let x = x0; x <= x1 + 1e-6; x += step) pts.push([x, y]);
  return pts;
}

/** Dot grid as one SVG path (keeps the DOM small; the kit does the same). */
export function dotPath(x0: number, y0: number, x1: number, y1: number, step: number, r: number): string {
  return dotGrid(x0, y0, x1, y1, step)
    .map(([x, y]) => `M${(x - r).toFixed(1)} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`)
    .join('');
}
