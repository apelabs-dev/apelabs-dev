// Build-time SVG vocabulary for the services scenes. Every function returns markup in its FINAL state; the
// runtime (timeline.ts) reads the data-* attributes and derives every earlier state from one progress value.
// Elements that are gone at the end carry opacity="0" so no-JS and reduced motion show the finished scene.
//
// Icons are never drawn here. `icon()` / `logo()` emit a <use> that points at a symbol the Astro component
// renders once at build time through Icon.astro (Lucide 16 × 16 at stroke 1.5; Simple Icons marks in
// currentColor), so no icon data and no icon renderer ships to the browser.
import { escapeHTML as h } from './content';

type Pt = [number, number];
type Spec = [at: number, label: string, tone: string];
type TextSpec = [at: number, text: string];

const r1 = (n: number) => Math.round(n * 10) / 10;
export const t = (x: number, y: number, label: string, cls = '', extra = '') =>
  `<text x="${r1(x)}" y="${r1(y)}" class="${cls}" ${extra}>${h(label)}</text>`;

// Mono 10px advance is 0.6em in Geist Mono; used to size chips so their text never clips.
export const monoW = (s: string, size = 10) => s.length * size * 0.6;

/* ---------- icons: symbol references, collected for the build-time sprite ---------- */
export interface UsedIcons {
  lucide: Set<string>;
  simple: Set<string>;
}
/** Named tools and the Simple Icons file each one maps to. A tool without a mark falls back to its Lucide icon. */
export const LOGOS: Readonly<Record<string, string>> = Object.freeze({
  HubSpot: 'hubspot',
  'Google Sheets': 'googlesheets',
  Zapier: 'zapier',
  QuickBooks: 'quickbooks',
});
export const hasLogo = (tool: string) => Object.hasOwn(LOGOS, tool);

let sink: UsedIcons = { lucide: new Set(), simple: new Set() };
/** Run `fn` collecting every icon it references; returns the result and the icons used. */
export function collectIcons<T>(fn: () => T): { value: T; icons: UsedIcons } {
  const prev = sink;
  sink = { lucide: new Set(), simple: new Set() };
  try {
    const value = fn();
    return { value, icons: sink };
  } finally {
    sink = prev;
  }
}
export const symbolId = (set: 'lucide' | 'simple', name: string) => `sr3-i-${set}-${name}`;

interface Place {
  x?: number;
  y?: number;
  cls?: string;
}
const at = (x?: number, y?: number) => (x === undefined || y === undefined ? '' : ` x="${r1(x)}" y="${r1(y)}"`);
/** A module or step icon: always 16 × 16 at stroke 1.5 (the symbol carries both). */
export function icon(name: string, { x, y, cls = '' }: Place = {}) {
  sink.lucide.add(name);
  return `<use class="lu${cls ? ' ' + cls : ''}" data-lucide="${name}" href="#${symbolId('lucide', name)}"${at(x, y)}/>`;
}
/** A tool's own one-colour mark, 16 × 16, drawn in currentColor. */
export function logo(tool: string, { x, y, cls = '' }: Place = {}) {
  const slug = LOGOS[tool];
  if (!slug) throw new Error(`services: no Simple Icons mark mapped for "${tool}"`);
  sink.simple.add(slug);
  return `<use class="lg${cls ? ' ' + cls : ''}" data-logo="${slug}" href="#${symbolId('simple', slug)}"${at(x, y)}/>`;
}

/* ---------- geometry: paths the runtime can also walk ---------- */
interface Geom {
  d: string;
  poly: Pt[];
  len: number;
}
const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
function quad(a: Pt, c: Pt, b: Pt, n = 6): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const v = 1 - u;
    out.push([v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]]);
  }
  return out;
}
const geom = (d: string, poly: Pt[]): Geom => {
  let len = 0;
  for (let i = 1; i < poly.length; i++) len += dist(poly[i - 1], poly[i]);
  return { d, poly, len: r1(len) };
};
/** Orthogonal route with rounded corners. */
export function route(pts: Pt[], r = 7): Geom {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  const poly: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [p0, p1, p2] = [pts[i - 1], pts[i], pts[i + 1]];
    const a = Math.min(r, dist(p0, p1) / 2, dist(p1, p2) / 2);
    const u = [Math.sign(p1[0] - p0[0]), Math.sign(p1[1] - p0[1])];
    const v = [Math.sign(p2[0] - p1[0]), Math.sign(p2[1] - p1[1])];
    const s: Pt = [p1[0] - u[0] * a, p1[1] - u[1] * a];
    const e: Pt = [p1[0] + v[0] * a, p1[1] + v[1] * a];
    d += `L${r1(s[0])} ${r1(s[1])}Q${p1[0]} ${p1[1]} ${r1(e[0])} ${r1(e[1])}`;
    poly.push(s, ...quad(s, p1, e));
  }
  const last = pts[pts.length - 1];
  d += `L${last[0]} ${last[1]}`;
  poly.push(last);
  return geom(d, poly);
}
const ptsAttr = (poly: Pt[]) => poly.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ');

/* ---------- spacing tokens (SVG user units) ---------- */
// Every padding and gap in a card, chip, bubble, sticky or scene comes from this one 4–40 scale, and every
// offset in the scenes is derived from these names instead of a literal.
export const SP = Object.freeze({ s4: 4, s8: 8, s12: 12, s16: 16, s20: 20, s24: 24, s32: 32, s40: 40 });
/** Node card: a 32 header bar (16 icon centred in it), then a body of 16 rows and the chip, all inside 12/8 pads. */
export const CARD = Object.freeze({
  padX: SP.s12,
  padY: SP.s8,
  head: SP.s32,
  icon: SP.s16,
  iconGap: SP.s8,
  row: SP.s16,
  bodyGap: SP.s8,
  chip: SP.s16,
  mini: SP.s40,
  miniPad: SP.s12,
  dot: 3,
});
/** Status chip: a 16 mark box (dot or Lucide check) 4 in from the left, 4 to the text, 8 after it. */
export const CHIP = Object.freeze({ h: SP.s16, padL: SP.s4, mark: SP.s16, gap: SP.s4, padR: SP.s8 });
/** Scene: outer edge, sibling cards in one column, columns joined by a wire, separate groups. */
export const SCENE = Object.freeze({ wide: SP.s16, narrow: SP.s12, sib: SP.s8, col: SP.s16, group: SP.s24 });
// Baselines that centre a line of text in a 16 box (Geist 12.5 / Geist Mono 10 cap heights).
export const BASE = Object.freeze({ name: 12.4, mono: 11.5, sticky: 11.8 });

const markX = (x: number) => x + CARD.padX;
const nameX = (x: number, hasMark: boolean) => (hasMark ? markX(x) + CARD.icon + CARD.iconGap : x + CARD.padX);
/** The card's mark: the tool's own Simple Icons logo when it has one, else its Lucide module icon. */
const mark = ({ tool, icon: ic }: { tool?: string; icon?: string }, x: number, y: number, cls = '') =>
  tool && hasLogo(tool) ? logo(tool, { x, y, cls }) : ic ? icon(ic, { x, y, cls }) : '';
/** Card height from its contents (no literal heights): header, body rows, chip, pads. */
export const cardH = ({ rows = 0, chip: c = false, extra = 0 }: { rows?: number; chip?: boolean; extra?: number }) =>
  CARD.head +
  (rows || c || extra ? CARD.bodyGap : 0) +
  rows * CARD.row +
  (rows && c ? CARD.bodyGap : 0) +
  (c ? CARD.chip : 0) +
  extra +
  (rows || c || extra ? CARD.padY : 0);

/* ---------- chips ---------- */
/**
 * Status chip. states: [[at, label, tone]] where tone is idle | live | done. The markup shows the last state;
 * the runtime switches label/tone by progress. Width is fixed to the longest label, so nothing reflows.
 */
export const chipW = (states: Spec[] | string) =>
  Math.ceil(Math.max(...(Array.isArray(states) ? states : [[0, states]]).map((s) => monoW(s[1] as string)))) +
  CHIP.padL +
  CHIP.mark +
  CHIP.gap +
  CHIP.padR;
export function chip(x: number, y: number, states: Spec[] | string, { id = '', anchor = 'start' } = {}) {
  const list: Spec[] = Array.isArray(states) ? states : [[0, states, 'idle']];
  const w = chipW(list);
  const x0 = anchor === 'end' ? x - w : x;
  const [, label, tone] = list[list.length - 1];
  const spec = list.length > 1 ? `data-chip="${h(list.map((s) => s.join(':')).join('|'))}"` : '';
  const mx = x0 + CHIP.padL;
  return `<g class="sr3-chip" data-tone="${tone}" ${spec} ${id ? `id="${id}"` : ''}><rect x="${r1(x0)}" y="${r1(y)}" width="${w}" height="${CHIP.h}" rx="4"/><circle cx="${r1(mx + CHIP.mark / 2)}" cy="${r1(y + CHIP.h / 2)}" r="${CARD.dot}"/>${icon('check', { x: mx, y, cls: 'sr3-chip-check' })}${t(mx + CHIP.mark + CHIP.gap, y + BASE.mono, label, 'sr3-chip-text')}</g>`;
}

/* ---------- node card ---------- */
interface Row {
  text?: string;
  parts?: [string, string][];
  tone?: string;
  type?: string;
  states?: TextSpec[];
}
interface CardOpts {
  x: number;
  y: number;
  w: number;
  h?: number;
  icon?: string;
  tool?: string;
  name: string;
  lines?: string[];
  rows?: Row[];
  status?: Spec[];
  meta?: string | { text: string; states?: TextSpec[] };
  ports?: string | (string | Pt)[];
  plates?: number;
  focal?: boolean;
  dot?: boolean;
  lit?: string;
  pulse?: string;
  cls?: string;
  extra?: string;
  nameCls?: string;
  mini?: boolean;
  body?: string;
}
const specText = (s: TextSpec[]) => h(s.map((x) => x.join(':')).join('|'));
/**
 * A product-UI node card. rows: [{ text | parts:[[text, tone]] }] stacked in 16 rows under the header;
 * status: chip spec under the rows, meta: muted text right-aligned on the chip row. lines: a name set on two
 * lines (mini cards only, when one line cannot fit at full size). plates: offset back-plates. focal: orange edge
 * and glow. body: extra markup the scene places inside the face; h: an explicit height for those.
 */
export function card({
  x,
  y,
  w,
  h: ht,
  icon: ic,
  tool,
  name,
  lines,
  rows = [],
  status,
  meta,
  ports = 'lr',
  plates = 1,
  focal = false,
  dot = true,
  lit,
  pulse,
  cls = '',
  extra = '',
  nameCls = '',
  mini = false,
  body: inner = '',
}: CardOpts) {
  const height = ht ?? (mini ? CARD.mini + (lines ? CARD.row / 2 : 0) : cardH({ rows: rows.length, chip: !!status }));
  const plate = Array.from(
    { length: plates },
    (_, i) =>
      `<rect class="sr3-plate" x="${x + SP.s4 + i * SP.s4}" y="${y + SP.s4 + i * SP.s4}" width="${w}" height="${height}" rx="7" opacity="${(0.75 - i * 0.3).toFixed(2)}"/>`,
  )
    .reverse()
    .join('');
  const portList = (Array.isArray(ports) ? ports : [...ports])
    .map((side) => {
      const [px, py] = Array.isArray(side)
        ? side
        : side === 'l'
          ? [x, y + height / 2]
          : side === 'r'
            ? [x + w, y + height / 2]
            : side === 't'
              ? [x + w / 2, y]
              : [x + w / 2, y + height];
      return `<rect class="sr3-port" x="${r1(px - 3)}" y="${r1(py - 3)}" width="6" height="6" rx="1.5"/>`;
    })
    .join('');
  // Header: on a full card the 16 mark sits padY into the 32 bar; on a mini card it is centred in the face.
  const midY = mini ? y + height / 2 : y + CARD.head / 2;
  const has = !!((tool && hasLogo(tool)) || ic);
  const nx = nameX(x, has);
  const nameText = lines
    ? `<text x="${nx}" y="${r1(midY - CARD.row + BASE.name)}" class="sr3-name ${nameCls}">${lines.map((s, i) => `<tspan x="${nx}" ${i ? `dy="${CARD.row}"` : ''}>${h(s)}${i < lines.length - 1 ? ' ' : ''}</tspan>`).join('')}</text>`
    : t(nx, midY - CARD.row / 2 + BASE.name, name, `sr3-name ${nameCls}`);
  const bodyY = y + CARD.head + CARD.bodyGap;
  const rowsHTML = rows
    .map((r, i) => {
      const parts = r.parts || [[r.text as string, r.tone || 'muted']];
      const spec = r.type
        ? `data-type="${r.type}" data-full="${h(parts.map((p) => p[0]).join(''))}"`
        : r.states
          ? `data-text="${specText(r.states)}"`
          : '';
      return `<text x="${x + CARD.padX}" y="${r1(bodyY + i * CARD.row + BASE.mono)}" class="sr3-mono" ${spec}>${parts.map(([s, tone]) => `<tspan class="sr3-${tone}">${h(s)}</tspan>`).join('')}</text>`;
    })
    .join('');
  const chipY = bodyY + rows.length * CARD.row + (rows.length ? CARD.bodyGap : 0);
  const foot = status ? chip(x + CARD.padX, chipY, status) : '';
  const metaStates = typeof meta === 'object' ? meta.states : undefined;
  const metaText = meta
    ? `<text x="${x + w - CARD.padX}" y="${r1(chipY + BASE.mono)}" text-anchor="end" class="sr3-mono sr3-muted" ${metaStates ? `data-text="${specText(metaStates)}"` : ''}>${h(typeof meta === 'object' ? meta.text : meta)}</text>`
    : '';
  const glow = focal
    ? `<ellipse class="sr3-glow" cx="${x + w / 2}" cy="${y + height / 2}" rx="${w * 0.95}" ry="${height * 0.95}" fill="url(#GLOW)" ${lit ? `data-fade="${lit}" opacity="1"` : ''}/>`
    : '';
  const ring = pulse
    ? `<rect class="sr3-ring" x="${x - SP.s4}" y="${y - SP.s4}" width="${w + SP.s8}" height="${height + SP.s8}" rx="11" data-pulse="${pulse}" opacity="0"/>`
    : '';
  const dx = x + w - CARD.padX - CARD.dot;
  return `<g class="sr3-card ${focal ? 'is-focal' : ''} ${cls}" data-card="${mini ? 'mini' : 'full'}" ${extra}>${glow}<rect class="sr3-shadow" x="${x + 2}" y="${y + 7}" width="${w - 4}" height="${height}" rx="8" filter="url(#SHADOW)"/>${plate}<rect class="sr3-face" x="${x}" y="${y}" width="${w}" height="${height}" rx="7"/><rect class="sr3-hi" x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${height - 1}" rx="6.5"/>${focal ? `<rect class="sr3-focal-edge" x="${x}" y="${y}" width="${w}" height="${height}" rx="7" ${lit ? `data-fade="${lit}" opacity="1"` : ''}/>` : ''}
    ${mark({ tool, icon: ic }, markX(x), midY - CARD.icon / 2, focal ? 'is-orange' : '')}${nameText}${dot ? `<circle class="sr3-dot" cx="${dx}" cy="${midY}" r="${CARD.dot}"/>${pulse ? `<circle class="sr3-dot is-on" cx="${dx}" cy="${midY}" r="${CARD.dot}" data-pulse="${pulse}" opacity="0"/>` : ''}` : ''}
    ${mini ? '' : `<path class="sr3-divider" d="M${x + 1} ${y + CARD.head}H${x + w - 1}"/>`}${rowsHTML}${foot}${metaText}${inner}${portList}${ring}</g>`;
}

/* ---------- edges and packets ---------- */
/**
 * Edge: faint base wire + dashed flow texture (+ orange lit overlay once a packet has passed).
 * draw: "t0 t1" draws it in; lit: "t0 t1" fades the orange overlay in.
 */
export function edge(g: Geom, { draw, lit, dashed = false, cls = '' }: { draw?: string; lit?: string; dashed?: boolean; cls?: string } = {}) {
  const drawAttr = draw ? `data-draw="${draw}"` : '';
  return `<g class="sr3-edge ${dashed ? 'is-dashed' : ''} ${cls}"><path d="${g.d}" class="sr3-wire" pathLength="100" ${drawAttr}/><path d="${g.d}" class="sr3-flow" data-flow="${dashed ? 0 : 60}" ${draw ? `data-fade="${draw}"` : ''}/>${lit ? `<path d="${g.d}" class="sr3-lit" data-fade="${lit}"/>` : ''}</g>`;
}
/** Orange spark with a short fading trail, the hero's spark language in SVG. at: "t0 t1". */
export function packet(g: Geom, when: string, { dim = false } = {}) {
  const tails: [number, string][] = [
    [30, 'a'],
    [17, 'b'],
    [7, 'c'],
  ];
  return `<g class="sr3-packet ${dim ? 'is-dim' : ''}" data-packet="${when}" data-len="${g.len}" data-pts="${ptsAttr(g.poly)}" opacity="0">${tails.map(([n, k]) => `<path d="${g.d}" class="sr3-trail sr3-trail-${k}" pathLength="${g.len}" data-tail="${n}"/>`).join('')}<g class="sr3-head"><circle r="9" fill="url(#GLOW)"/><rect x="-1.6" y="-1.6" width="3.2" height="3.2" rx=".6"/></g></g>`;
}

/* ---------- small parts ---------- */
export const label = (x: number, y: number, s: string, anchor = 'start') =>
  t(x, y, s.toUpperCase(), 'sr3-label', anchor === 'end' ? 'text-anchor="end"' : '');
/** Bottom status strip, like a canvas footer in a workflow tool. d: the divider's y; the 16 text row sits 8 below it. */
export function strip(
  w: number,
  d: number,
  left: string,
  right?: string | { text: string; states?: TextSpec[] },
  { live }: { live?: string } = {},
) {
  const e = SCENE.wide;
  const top = d + SP.s8;
  const y = r1(top + BASE.mono);
  const cx = e + CARD.dot;
  const cy = top + CARD.row / 2;
  const tx = e + CARD.dot * 2 + SP.s8;
  const rightStates = typeof right === 'object' ? right.states : undefined;
  return `<g class="sr3-strip"><path class="sr3-divider" d="M${e} ${d}H${w - e}"/><circle class="sr3-dot" cx="${cx}" cy="${cy}" r="${CARD.dot}"/>${live ? `<circle class="sr3-dot is-on" cx="${cx}" cy="${cy}" r="${CARD.dot}" data-fade="${live}"/>` : ''}${t(tx, y, left, 'sr3-mono sr3-muted')}${right ? `<text x="${w - e}" y="${y}" text-anchor="end" class="sr3-mono sr3-muted" ${rightStates ? `data-text="${specText(rightStates)}"` : ''}>${h(typeof right === 'object' ? right.text : right)}</text>` : ''}</g>`;
}
/** Paper sticky note (charcoal text on paper). lines: up to three short mono strings. */
export function sticky(x: number, y: number, w: number, ht: number, lines: string[], { rot = 0, cls = '', extra = '' } = {}) {
  const fold = SP.s8;
  return `<g class="sr3-sticky ${cls}" ${extra}><g transform="rotate(${rot} ${x + w / 2} ${y + ht / 2})"><rect class="sr3-sticky-shadow" x="${x + 2}" y="${y + 6}" width="${w - 2}" height="${ht - 2}" rx="2" filter="url(#SHADOW)"/><path class="sr3-sticky-face" d="M${x} ${y}h${w}v${ht - fold}l-${fold} ${fold}H${x}z"/><path class="sr3-sticky-fold" d="M${x + w} ${y + ht - fold}h-${fold}v${fold}z"/><rect class="sr3-sticky-tape" x="${x + w / 2 - 12}" y="${y - SP.s4}" width="${SP.s24}" height="${SP.s8}" rx="1"/>${lines.map((s, i) => t(x + SP.s12, y + SP.s12 + i * CARD.row + BASE.sticky, s, 'sr3-sticky-text')).join('')}</g></g>`;
}
/** Wrap any markup in a group the runtime animates. kind: enter | move | leave; spec: "t0 t1"; pose: "dx dy rot scale". */
export const anim = (
  kind: 'enter' | 'move' | 'leave',
  spec: string,
  pose: string,
  body: string,
  { ease, cls = '', hiddenAtEnd = false }: { ease?: string; cls?: string; hiddenAtEnd?: boolean } = {},
) => {
  const poseAttr = kind === 'enter' ? 'data-from' : kind === 'move' ? 'data-pose' : 'data-to';
  return `<g class="sr3-anim ${cls}" data-${kind}="${spec}" ${pose ? `${poseAttr}="${pose}"` : ''} ${ease ? `data-ease="${ease}"` : ''} ${hiddenAtEnd || kind === 'leave' ? 'opacity="0"' : ''}>${body}</g>`;
};

/* ---------- canvas ---------- */
/** One SVG stage: dot-grid backdrop with a soft vignette, glow gradient and its own ids. */
export function stage(uid: string, w: number, ht: number, body: string, labelText: string, { layout = 'wide' } = {}) {
  const ids: Record<string, string> = {
    SHADOW: `${uid}-sh`,
    GLOW: `${uid}-glow`,
    DOTS: `${uid}-dots`,
    VIG: `${uid}-vig`,
    MASK: `${uid}-mask`,
    SCAN: `${uid}-scan`,
  };
  const content = body.replace(/url\(#(GLOW|SCAN|SHADOW)\)/g, (_, k: string) => `url(#${ids[k]})`);
  return `<svg class="sr3-svg" data-layout="${layout}" viewBox="0 0 ${w} ${ht}" role="img" aria-label="${h(labelText)}">
    <defs>
      <pattern id="${ids.DOTS}" width="16" height="16" patternUnits="userSpaceOnUse"><rect x="7.5" y="7.5" width="1" height="1" class="sr3-griddot"/></pattern>
      <radialGradient id="${ids.VIG}" cx="50%" cy="45%" r="70%"><stop offset="0" class="sr3-stop-paper"/><stop offset=".55" class="sr3-stop-paper" stop-opacity=".7"/><stop offset="1" class="sr3-stop-paper" stop-opacity="0"/></radialGradient>
      <mask id="${ids.MASK}"><rect width="${w}" height="${ht}" fill="url(#${ids.VIG})"/></mask>
      <radialGradient id="${ids.GLOW}"><stop offset="0" class="sr3-stop-orange" stop-opacity=".55"/><stop offset=".45" class="sr3-stop-orange" stop-opacity=".16"/><stop offset="1" class="sr3-stop-orange" stop-opacity="0"/></radialGradient>
      <linearGradient id="${ids.SCAN}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="sr3-stop-orange" stop-opacity="0"/><stop offset="1" class="sr3-stop-orange" stop-opacity=".18"/></linearGradient>
      <filter id="${ids.SHADOW}" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="6"/></filter>
    </defs>
    <rect width="${w}" height="${ht}" fill="url(#${ids.DOTS})" mask="url(#${ids.MASK})"/>
    ${content}
  </svg>`;
}
