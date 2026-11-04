// The journey's notes "in the picture": the lines that once sat behind a disclosure, each behind an orange dot.
//
//   Steps 01, 04, 06   an annotation plate on the pinned board, a leader line to the part it explains. The plate
//                      goes where it covers the least of the board and never sits on a panel's edge (fully inside
//                      a panel with 12px to spare, or 12px clear of it). Phones dock it in a strip under the board.
//   Step 02            the diagnostic list written into the run-history rows (CSS: each row's ring and rule).
//
// Without JS (no .cx-live on the section) the in-flow notes under each step are plain text and the layer stays
// hidden; with JS they stay the screen-reader copy (visually hidden).
//
// The note dot: each note waits behind a 6px orange dot at the point the router chose for its ring, with a soft
// ring breathing round it. The dot is a button (44×44 px at least, aria-expanded, aria-controls its plate).
// "Reveal the note" shows beside it on hover or keyboard focus, and all the time where nothing can hover
// (phones); the label takes the side of the dot with room (no board words, no panel edge). A press, Enter or
// Space opens the note: the plate and the leader, which ends on the dot's edge. Open, the dot stops breathing
// and the label goes. A second press, Escape, a press outside the dot and its plate, focus moving elsewhere or
// the next step closes it. Step 02's dot sits on the run history's lead line and opens the rows' notes.

const RING = 11; // the router's ring, outer diameter, px: its routes end on this ring's edge
const R = RING / 2;
const DOT = 3; // the note dot's radius, px (6px across)
const CLEAR = 12; // a plate's clearance from any panel edge
const HIT = 44; // the dot button's smallest box, px
const LABEL = 'Reveal the note';

type Box = { x: number; y: number; w: number; h: number };
type Rel = Box & { W: number; H: number };
type Leaf = Box & { k: number };
type Pt = [number, number];
type Obstacles = { leaves: Leaf[]; panels: Box[]; edges: Box[]; lanes: number[]; gutters: number[] };
type Host = { id: string; step: number; plate: HTMLElement | null; twin: HTMLElement | null };
type Mark = Box & { cx: number; cy: number; r: number };

export interface Notes {
  step(n: number): void;
  refresh(): void;
  destroy(): void;
}

export function createNotes(root: HTMLElement, { desk, docked }: { desk: () => boolean; docked: () => boolean }): Notes {
  const doc = root.ownerDocument;
  const layer = root.querySelector<HTMLElement>('[data-cx-layer]');
  const leader = layer?.querySelector<SVGPathElement>('.cx-lead-line path') ?? null;
  const viewEl = root.querySelector<HTMLElement>('.jx-view')!;
  const ac = new AbortController();
  const signal = ac.signal;

  const hosts: Host[] = [...root.querySelectorAll<HTMLElement>('.jx-step [data-cx-host]')].map((notes) => ({
    id: notes.dataset.cxHost!,
    step: Number(notes.closest<HTMLElement>('.jx-step')!.dataset.step),
    plate: layer?.querySelector<HTMLElement>(`.cx-plate[data-cx-for="${notes.dataset.cxHost}"]`) ?? null,
    twin: layer?.querySelector<HTMLElement>(`.cx-rows-sr[data-cx-for="${notes.dataset.cxHost}"]`) ?? null,
  }));
  // The run-history notes (step 02) have no plate: their dot sits on the list's lead line.
  const rowsHost = hosts.find((x) => x.twin);
  const rowLead = root.querySelector<HTMLElement>('.cx-row-lead');

  const open = new Set<string>(); // the note open now (one at most)
  let active = Number(root.dataset.step ?? -1);
  const timers: number[] = [];

  // ---------------------------------------------------------------- geometry

  // Rect of `el` relative to the layer (both live in the pinned stage, so scrolling never moves one against the
  // other; the board's own scene changes and the window size do).
  function rel(el: Element): Rel {
    const L = layer!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - L.left, y: r.top - L.top, w: r.width, h: r.height, W: L.width, H: L.height };
  }
  // The painted text of an element (a label's box can be wider than its words).
  function textRel(el: Element): Box {
    const range = doc.createRange();
    range.selectNodeContents(el);
    const t = range.getBoundingClientRect();
    const L = layer!.getBoundingClientRect();
    return t.width ? { x: t.left - L.left, y: t.top - L.top, w: t.width, h: t.height } : rel(el);
  }
  // The first visible match (the board keeps parts of other scenes in the DOM, hidden).
  const anchorOf = (sel: string | undefined) =>
    sel ? ([...root.querySelectorAll(`.jx-view ${sel}`)].find((el) => el.checkVisibility({ opacityProperty: true })) ?? null) : null;

  // Every visible board element that draws text or an icon (weight 1), every filled or bordered box (0.25).
  // Boxes bordered (three sides at least) and of panel size are kept apart as panels: a plate is fully inside one
  // (12px in) or 12px clear. Whatever a full-screen card (.jx-screen) covers is out of sight and does not count.
  function obstacles(view: HTMLElement): Obstacles {
    const leaves: Leaf[] = [];
    const panels: Box[] = [];
    const seen = (el: Element) => el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    // A screen covers the board only while it is raised over it (z-index 6 in the diag, find and quote scenes);
    // otherwise it is the card holder, one part of the board among others.
    const onTop = (el: Element) => Number(getComputedStyle(el).zIndex) >= 6;
    const screens = [...view.querySelectorAll('.jx-screen')].filter((el) => seen(el) && onTop(el)).map((el) => [el, rel(el)] as const);
    const covered = (el: Element, r: Box) =>
      screens.some(([s, b]) => !s.contains(el) && r.x >= b.x && r.y >= b.y && r.x + r.w <= b.x + b.w && r.y + r.h <= b.y + b.h);
    for (const el of view.querySelectorAll('*')) {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
      if (el.closest('.cx-layer')) continue;
      if (!seen(el)) continue;
      const r = rel(el);
      if (r.w < 2 || r.h < 2) continue;
      if (covered(el, r)) continue;
      const leaf = el.tagName.toLowerCase() === 'svg' || (!el.childElementCount && !!el.textContent?.trim());
      // Text that sits beside an icon or a tag in the same element is a leaf of its own.
      if (!leaf) {
        for (const n of el.childNodes) {
          if (n.nodeType !== 3 || !n.textContent?.trim()) continue;
          const range = doc.createRange();
          range.selectNodeContents(n);
          const t = range.getBoundingClientRect();
          const L = layer!.getBoundingClientRect();
          if (t.width >= 2) leaves.push({ x: t.left - L.left, y: t.top - L.top, w: t.width, h: t.height, k: 1 });
        }
      }
      const cs = getComputedStyle(el);
      const border = parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0;
      const box = !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) || border;
      // A text leaf counts by its painted words, not its box (a table cell can be far wider than its name).
      if (leaf && el.tagName.toLowerCase() !== 'svg') {
        const t = textRel(el);
        leaves.push({ x: t.x, y: t.y, w: t.w, h: t.h, k: 1 });
        if (box) leaves.push({ ...r, k: 0.25 });
      } else if (leaf || box) leaves.push({ ...r, k: leaf ? 1 : 0.25 });
      // A panel is bordered on three sides at least (the phone's frame runs off the board's bottom; a block with
      // only a top rule is not a panel).
      const sides = (['Top', 'Right', 'Bottom', 'Left'] as const).filter((k) => parseFloat(cs[`border${k}Width`]) > 0).length;
      if (sides >= 3 && r.w >= 120 && r.h >= 60) panels.push(r);
    }
    // Panel edges as 16px bands: a leader may cross one, never run along it.
    const edges = panels.flatMap((p) => [
      { x: p.x, y: p.y - 8, w: p.w, h: 16 },
      { x: p.x, y: p.y + p.h - 8, w: p.w, h: 16 },
      { x: p.x - 8, y: p.y, w: 16, h: p.h },
      { x: p.x + p.w - 8, y: p.y, w: 16, h: p.h },
    ]);
    // Lanes: the open rows between one panel's bottom and another's top, and the open columns (gutters) between
    // one panel's right edge and another's left, where a leader can cross the board.
    const lanes: number[] = [];
    const gutters: number[] = [];
    for (const p of panels)
      for (const q of panels) {
        const gap = q.y - (p.y + p.h);
        if (gap >= 16 && gap <= 160) lanes.push(p.y + p.h + gap / 2);
        const gx = q.x - (p.x + p.w);
        if (gx >= 16 && gx <= 160) gutters.push(p.x + p.w + gx / 2);
      }
    // The board's own margins left and right of its panels are gutters too.
    const v = rel(view);
    if (panels.length) {
      const left = Math.min(...panels.map((p) => p.x)) - v.x;
      const right = v.x + v.w - Math.max(...panels.map((p) => p.x + p.w));
      if (left >= 10) gutters.push(v.x + left / 2);
      if (right >= 10) gutters.push(v.x + v.w - right / 2);
    }
    // So are the free columns beside the board's outermost words (inside a full-board screen, its padding).
    const words = leaves.filter((o) => o.k === 1);
    if (words.length) {
      const lx = Math.min(...words.map((o) => o.x)) - 8;
      const rx = Math.max(...words.map((o) => o.x + o.w)) + 8;
      if (lx >= v.x + 3) gutters.push(lx);
      if (rx <= v.x + v.w - 3) gutters.push(rx);
    }
    const uniq = (a: number[]) => [...new Set(a.map(Math.round))];
    return { leaves, panels, edges, lanes: uniq(lanes), gutters: uniq(gutters) };
  }
  const overlap = (x: number, y: number, w: number, h: number, o: Box) =>
    Math.max(0, Math.min(x + w, o.x + o.w) - Math.max(x, o.x)) * Math.max(0, Math.min(y + h, o.y + o.h) - Math.max(y, o.y));
  // A plate is fine with a panel when it is inside it with CLEAR to spare, or CLEAR outside it.
  const edgeOk = (x: number, y: number, w: number, h: number, p: Box) =>
    (x >= p.x + CLEAR && y >= p.y + CLEAR && x + w <= p.x + p.w - CLEAR && y + h <= p.y + p.h - CLEAR) ||
    x + w <= p.x - CLEAR ||
    x >= p.x + p.w + CLEAR ||
    y + h <= p.y - CLEAR ||
    y >= p.y + p.h + CLEAR;

  // The ring: on the anchor's text line, against its last letter or its first (the router picks the side). A
  // chip (a small bordered box) also offers the middle of its bottom and top edges, just outside it.
  function ringsAt(a: Rel, chip: Box | null): Pt[] {
    const out: Pt[] = [];
    const right = a.x + a.w + 3 + R;
    if (right + R + 2 <= a.W) out.push([right, a.y + a.h / 2]);
    const left = a.x - 3 - R;
    if (left - R - 2 >= 0) out.push([left, a.y + a.h / 2]);
    if (chip) {
      out.push([chip.x + chip.w / 2, chip.y + chip.h + 3 + R]);
      if (chip.y - 3 - 2 * R >= 0) out.push([chip.x + chip.w / 2, chip.y - 3 - R]);
    }
    return out;
  }

  // Leader routes from a plate box to a ring; every route ends on the ring's outer edge. Straight into the ring
  // (down, up or across), or with elbows via the lanes and gutters between panels.
  function routes(x: number, y: number, w: number, h: number, [rx, ry]: Pt, { lanes = [], gutters = [] }: Partial<Obstacles> = {}): Pt[][] {
    const out: Pt[][] = [];
    // Three elbows: out of the plate's side, down (or up) a gutter, across a lane, into the ring's top (or bottom).
    for (const gx of gutters) {
      const sideX = gx < x - 6 ? x : gx > x + w + 6 ? x + w : null;
      if (sideX == null) continue;
      const sy = y + h / 2;
      for (const ly of lanes) {
        const down = ly > sy && ly < ry - R - 6;
        const up = ly < sy && ly > ry + R + 6;
        if ((down || up) && Math.abs(gx - rx) > R + 6)
          out.push([[sideX, sy], [gx, sy], [gx, ly], [rx, ly], [rx, down ? ry - R : ry + R]]);
      }
    }
    // Two elbows: down (or up) out of the plate, across a lane between panels, into the ring's top (or bottom).
    for (const ly of lanes) {
      const down = ly > y + h + 6 && ly < ry - R - 6;
      const up = ly < y - 6 && ly > ry + R + 6;
      if (!down && !up) continue;
      for (const sx of [x + 14, x + w / 2, x + w - 14]) {
        if (Math.abs(sx - rx) > R + 6) out.push([[sx, down ? y + h : y], [sx, ly], [rx, ly], [rx, down ? ry - R : ry + R]]);
      }
    }
    const inX = rx >= x + 14 && rx <= x + w - 14;
    const inY = ry >= y + 10 && ry <= y + h - 10;
    if (inX && y + h <= ry - R) out.push([[rx, y + h], [rx, ry - R]]);
    if (inX && y >= ry + R) out.push([[rx, y], [rx, ry + R]]);
    if (inY && x >= rx + R) out.push([[x, ry], [rx + R, ry]]);
    if (inY && x + w <= rx - R) out.push([[x + w, ry], [rx - R, ry]]);
    // Out of the ring's top or bottom, then across into the plate's side.
    if (!inX && (x >= rx + R || x + w <= rx - R)) {
      const side = x >= rx ? x : x + w;
      const sy = Math.min(Math.max(ry, y + 14), y + h - 14);
      if (Math.abs(sy - ry) > R + 6) out.push([[side, sy], [rx, sy], [rx, sy > ry ? ry + R : ry - R]]);
    }
    // Out of the ring's side, then up or down into the plate's edge.
    if (!inY && (y >= ry + R || y + h <= ry - R)) {
      const edge = y >= ry ? y : y + h;
      for (const want of [rx + R + 12, rx - R - 12, ...gutters]) {
        const sx = Math.min(Math.max(want, x + 8), x + w - 8);
        if (Math.abs(sx - rx) > R + 6) out.push([[sx, edge], [sx, ry], [sx > rx ? rx + R : rx - R, ry]]);
      }
    }
    return out;
  }
  // A crossing of a line of text costs as much as covering a good part of one, of a button or field a third of
  // that, running along a panel's edge more, cutting through a panel that holds neither the plate nor the anchor
  // more again; length costs a little.
  const holds = (p: Box, o: Box) => o.x >= p.x - 1 && o.y >= p.y - 1 && o.x + o.w <= p.x + p.w + 1 && o.y + o.h <= p.y + p.h + 1;
  function routeCost(pts: Pt[], { leaves, edges, panels }: Obstacles, anchor: Box, plate: Box): number {
    let c = 0;
    let len = 0;
    const hit = new Set<number>();
    const boxes = new Set<number>();
    const cut = new Set<number>();
    const foreign = panels.filter((p) => !holds(p, plate) && !holds(p, anchor));
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const seg = { x: Math.min(x0, x1) - 2, y: Math.min(y0, y1) - 2, w: Math.abs(x1 - x0) + 4, h: Math.abs(y1 - y0) + 4 };
      leaves.forEach((o, k) => {
        if (overlap(seg.x, seg.y, seg.w, seg.h, o) <= 0) return;
        if (o.k === 1) hit.add(k);
        else if (!holds(o, plate) && !holds(o, anchor)) boxes.add(k);
      });
      if (overlap(seg.x, seg.y, seg.w, seg.h, anchor) > 0) c += 8000;
      for (const e of edges) c += 10 * overlap(seg.x, seg.y, seg.w, seg.h, e);
      foreign.forEach((p, k) => overlap(seg.x, seg.y, seg.w, seg.h, { x: p.x + 4, y: p.y + 4, w: p.w - 8, h: p.h - 8 }) > 0 && cut.add(k));
      len += Math.abs(x1 - x0) + Math.abs(y1 - y0);
    }
    return c + hit.size * 5000 + boxes.size * 1500 + cut.size * 6000 + len * 0.6;
  }
  function bestRoute(x: number, y: number, w: number, h: number, rings: Pt[], obs: Obstacles, anchor: Box) {
    let best: { pts: Pt[]; cost: number; rp: Pt } | null = null;
    for (const rp of rings) {
      for (const pts of routes(x, y, w, h, rp, obs)) {
        const cost = routeCost(pts, obs, anchor, { x, y, w, h });
        if (!best || cost < best.cost) best = { pts, cost, rp };
      }
    }
    return best;
  }

  // Where a plate covers the least of the board: text and icons it covers (with 6px of air), its leader's
  // crossings and length, and its distance from the ring all cost; touching a panel's edge (closer than CLEAR)
  // rules a spot out while any spot is left. A full board may leave no room for the plate's 272px: it can narrow
  // (to 180px, a little cost per px) to fit inside a panel or a gap. `sizes`: [[w, h], …].
  function spot(a: Rel, rings: Pt[], sizes: [number, number][]) {
    const view = rel(viewEl);
    const obs = obstacles(viewEl);
    const words = obs.leaves.filter((o) => o.k === 1);
    const air = obs.leaves.map((o) => ({ ...o, x: o.x - 6, y: o.y - 6, w: o.w + 12, h: o.h + 12 }));
    const hard = { ...a, x: a.x - 16 - RING, y: a.y - 16, w: a.w + 32 + 2 * RING, h: a.h + 32 };
    // The anchor's own panel is what the note is about: covering its lines costs three times as much.
    const inside = (o: Box, p: Box) => o.x >= p.x && o.y >= p.y && o.x + o.w <= p.x + p.w && o.y + o.h <= p.y + p.h;
    const own = obs.panels.filter((p) => inside(a, p)).sort((p, q) => p.w * p.h - q.w * q.h)[0];
    for (const o of air) if (own && inside(o, { x: own.x - 6, y: own.y - 6, w: own.w + 12, h: own.h + 12 })) o.k *= 3;
    let best: (Box & { cost: number; route: Pt[]; rp: Pt }) | null = null;
    const at = (x: number, y: number, w: number, h: number, strict: boolean) => {
      if (strict && !obs.panels.every((p) => edgeOk(x, y, w, h, p))) return;
      let cost = 20 * (sizes[0][0] - w);
      for (const o of air) cost += o.k * overlap(x, y, w, h, o);
      // A word cut in half reads worse than one the plate covers whole.
      for (const o of words) {
        const v = overlap(x, y, w, h, { x: o.x - 3, y: o.y, w: o.w + 6, h: o.h });
        if (v > 0 && v < (o.w + 6) * o.h - 1) cost += 2000;
      }
      cost += 3 * overlap(x, y, w, h, hard);
      if (best && cost >= best.cost) return;
      const r = bestRoute(x, y, w, h, rings, obs, a);
      if (!r) return;
      cost += r.cost + 4 * Math.hypot(x + w / 2 - r.rp[0], y + h / 2 - r.rp[1]);
      if (!best || cost < best.cost) best = { x, y, w, h, cost, route: r.pts, rp: r.rp };
    };
    // A 16px pass over the board, then a 4px pass around the best spot.
    const x0 = view.x + 10;
    const y0 = view.y + 10;
    for (const strict of [true, false]) {
      for (const [w, h] of sizes) {
        for (let y = y0; y <= view.y + view.h - h - 10; y += 16) for (let x = x0; x <= view.x + view.w - w - 10; x += 16) at(x, y, w, h, strict);
      }
      if (best) {
        const { x: bx, y: by, w, h } = best as Box;
        for (let y = Math.max(y0, by - 12); y <= Math.min(view.y + view.h - h - 10, by + 12); y += 4) {
          for (let x = Math.max(x0, bx - 12); x <= Math.min(view.x + view.w - w - 10, bx + 12); x += 4) at(x, y, w, h, strict);
        }
        break;
      }
    }
    return best as (Box & { cost: number; route: Pt[]; rp: Pt }) | null;
  }

  // ---------------------------------------------------------------- placing

  const fix = (n: number) => Number(n.toFixed(1));
  function placePlates(): void {
    if (!layer || !leader) return;
    const h = hosts.find((x) => x.plate && x.step === active);
    hosts.forEach((x) => {
      if (!x.plate) return;
      const on = x === h && open.has(x.id);
      x.plate.classList.toggle('is-on', on);
      // The plate is the dot's controlled region, read once open.
      if (on) x.plate.removeAttribute('aria-hidden');
      else x.plate.setAttribute('aria-hidden', 'true');
    });
    layer.classList.toggle('is-live', !!h);
    placeRowsPin();
    if (!h || !h.plate) {
      leader.setAttribute('d', '');
      hidePins(null);
      return;
    }
    const plate = h.plate;
    const anchor = anchorOf(plate.dataset.anchor);
    if (!anchor || !anchor.getClientRects().length) return;
    const a: Rel = { ...rel(anchor), ...textRel(anchor) };
    // A ring never sits on an icon or a word (the left one can land on a tag's icon).
    const words = obstacles(viewEl).leaves.filter((o) => o.k === 1);
    const cs = getComputedStyle(anchor);
    const box = rel(anchor);
    const all = ringsAt(a, parseFloat(cs.borderBottomWidth) > 0 && box.h < 40 ? box : null);
    const clear = all.filter(([rx, ry]) => !words.some((o) => overlap(rx - R - 1, ry - R - 1, 2 * R + 2, 2 * R + 2, o) > 0));
    const rings = clear.length ? clear : all;
    // Phones: the board is full, so the plate docks in a caption strip the CSS adds under it.
    const dock = !desk() && docked();
    plate.classList.toggle('is-dock', dock);
    plate.style.width = '';
    let w = plate.offsetWidth;
    let ph = plate.offsetHeight;
    let x: number;
    let y: number;
    let route: Pt[];
    let rp: Pt;
    if (dock) {
      x = 0;
      y = a.H - ph;
      const r = bestRoute(x, y, w, ph, rings, obstacles(viewEl), a);
      rp = r?.rp ?? rings[0];
      route = r?.pts ?? [[rp[0], y], [rp[0], rp[1] + R]];
    } else {
      const sizes = [w, 236, 200, 180]
        .filter((v, i) => i === 0 || v < w)
        .map((v): [number, number] => {
          plate.style.width = `${v}px`;
          return [v, plate.offsetHeight];
        });
      const p = spot(a, rings, sizes) ?? { x: 8, y: 8, w, h: ph, rp: rings[0], route: [[8 + w / 2, 8 + ph], [rings[0][0], rings[0][1] - R]] as Pt[] };
      ({ x, y, w, rp, route } = p);
      ph = p.h;
      plate.style.width = w === sizes[0][0] ? '' : `${w}px`;
    }
    plate.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
    route = route.map(([px, py]) => [fix(px), fix(py)]);
    // The dot sits on the ring point; the leader stops at its edge.
    const side = rp[0] > a.x + a.w ? 'r' : rp[0] < a.x ? 'l' : rp[1] > a.y + a.h ? 'b' : 't';
    const mark = markRect(rp);
    const drawn = endOnMark(route, mark);
    leader.setAttribute('d', `M${drawn.map((p) => p.join(' ')).join('L')}`);
    // Shown only once placed for this step (CSS: .is-on[data-placed]).
    plate.dataset.placed = '';
    hidePins(h.id);
    placePin(h, { a, anchor, mark, side, dock });
  }

  // ---------------------------------------------------------------- the note dot

  // The dot's box in layer px, centred on the ring point.
  const markRect = ([rx, ry]: Pt): Mark => ({ x: rx - DOT, y: ry - DOT, w: 2 * DOT, h: 2 * DOT, cx: rx, cy: ry, r: DOT });
  // The router ends every leader on the 11px ring's edge; end it on the dot's edge instead. The last leg is
  // straight along x or y: it stops at the dot's edge, in line with its centre.
  function endOnMark(route: Pt[], m: Mark): Pt[] {
    const pts = route.map((p) => [...p] as Pt);
    const end = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    if (!prev) return pts;
    if (prev[1] === end[1]) {
      end[0] = fix(prev[0] > end[0] ? m.cx + m.r : m.cx - m.r);
      end[1] = prev[1] = fix(m.cy);
    } else {
      end[1] = fix(prev[1] > end[1] ? m.cy + m.r : m.cy - m.r);
      end[0] = prev[0] = fix(m.cx);
    }
    return pts;
  }

  const pins = new Map<string, HTMLButtonElement>(); // host id -> button
  function makePin(h: Host): HTMLButtonElement {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'cx-pin';
    b.dataset.cxPin = h.id;
    b.hidden = true;
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-controls', `cx-plate-${h.id}`);
    b.innerHTML = `<i class="cx-pin-mark" aria-hidden="true"></i><span class="cx-pin-label" aria-hidden="true">${LABEL}</span>`;
    b.addEventListener('click', () => toggle(h.id), { signal });
    b.addEventListener(
      'focusout',
      (e) => {
        const to = e.relatedTarget as Node | null;
        if (to && !b.contains(to) && !h.plate?.contains(to)) close(h.id);
      },
      { signal },
    );
    // Before its plate, so a screen reader meets the button, then what it opened.
    (h.plate ?? h.twin)!.before(b);
    pins.set(h.id, b);
    return b;
  }
  function hidePins(keep: string | null): void {
    for (const [id, b] of pins) {
      if (id === keep || id === rowsHost?.id) continue;
      b.hidden = true;
    }
  }
  // The anchor's own words, for the button's name ("Reveal the note: Acceptance check").
  const nameOf = (h: Host, anchor: Element | null) =>
    h === rowsHost ? 'Run history' : anchor?.textContent?.trim().replace(/\s+/g, ' ') || 'this part';
  function dressPin(b: HTMLButtonElement, h: Host, anchor: Element | null): void {
    b.setAttribute('aria-label', `${LABEL}: ${nameOf(h, anchor)}`);
    b.setAttribute('aria-expanded', String(open.has(h.id)));
    b.classList.toggle('is-open', open.has(h.id));
  }

  // Where the label goes: beside the dot on the side away from the anchor's words (or after the anchor's words
  // when the dot is before them), else before it, else under or over it (clear of the anchor's own box, a few px
  // further out at a small cost, so it can step off a box's edge). Board words cost most; a box costs when the
  // label covers part of it or crosses its edge, never when the label sits inside it; a panel's edge costs more.
  // Docked boards (phones) keep the label off a panel's edge entirely: the label shows there all the time, so
  // one that straddles a window's border reads as part of the window.
  function labelSpot(m: Mark, a: Box, box: Box, side: string, w: number, ht: number, obs: Obstacles, view: Box, dock: boolean): Box | null {
    const cy = m.cy - ht / 2;
    const cands = [
      { x: side === 'l' ? a.x + a.w + 8 : m.x + m.w + 6, y: cy, pref: 0 },
      { x: side === 'r' ? a.x - 12 - w : m.x - 6 - w, y: cy, pref: 30 },
    ];
    const over = Math.min(m.y, side === 'b' ? box.y : m.y) - 5 - ht;
    const under = Math.max(m.y + m.h, side === 't' ? box.y + box.h : 0) + 5;
    [m.x, m.cx - w / 2, m.x + m.w - w].forEach((x, i) => {
      for (const k of [0, 4, 8, 12, 16, 20]) {
        cands.push({ x, y: under + k, pref: 50 + 3 * k + 5 * i }, { x, y: over - k, pref: 50 + 3 * k + 5 * i });
      }
    });
    const inside = (o: Box, b: Box) => b.x >= o.x + 2 && b.y >= o.y + 2 && b.x + b.w <= o.x + o.w - 2 && b.y + b.h <= o.y + o.h - 2;
    const crosses = (lab: Box) => obs.panels.some((p) => !edgeOk(lab.x, lab.y, lab.w, lab.h, { x: p.x + CLEAR - 4, y: p.y + CLEAR - 4, w: p.w - 2 * (CLEAR - 4), h: p.h - 2 * (CLEAR - 4) }));
    let best: { box: Box; cost: number } | null = null;
    for (const c of cands) {
      const lab = { x: c.x, y: c.y, w, h: ht };
      if (lab.x < view.x + 2 || lab.y < view.y + 2 || lab.x + w > view.x + view.w - 2 || lab.y + ht > view.y + view.h - 2) continue;
      let cost = c.pref;
      for (const o of obs.leaves) {
        if (o.k === 1) cost += 40 * overlap(lab.x - 3, lab.y - 3, w + 6, ht + 6, o);
        else if (!inside(o, lab)) cost += 8 * overlap(lab.x - 2, lab.y - 2, w + 4, ht + 4, o);
      }
      for (const e of obs.edges) cost += 4 * overlap(lab.x, lab.y, w, ht, { x: e.x + 4, y: e.y + 4, w: e.w - 8, h: e.h - 8 });
      if (dock && crosses(lab)) cost += 100000;
      if (!best || cost < best.cost) best = { box: lab, cost };
    }
    return best?.box ?? null;
  }

  // Lay the button out: HIT×HIT centred on the dot, the dot in its middle, the label where labelSpot put it
  // (outside the button's box; it is the button's child, so a press on it is a press on the button).
  function layPin(b: HTMLButtonElement, m: Mark, lab: Box | null): void {
    const bx = m.cx - HIT / 2;
    const by = m.cy - HIT / 2;
    Object.assign(b.style, { left: `${fix(bx)}px`, top: `${fix(by)}px`, width: `${HIT}px`, height: `${HIT}px` });
    const mk = b.querySelector<HTMLElement>('.cx-pin-mark')!;
    Object.assign(mk.style, { left: `${fix(m.x - bx)}px`, top: `${fix(m.y - by)}px` });
    const l = b.querySelector<HTMLElement>('.cx-pin-label')!;
    if (lab) Object.assign(l.style, { left: `${fix(lab.x - bx)}px`, top: `${fix(lab.y - by)}px` });
  }

  function placePin(h: Host, { a, anchor, mark, side, dock }: { a: Box; anchor: Element; mark: Mark; side: string; dock: boolean }): void {
    const b = pins.get(h.id) ?? makePin(h);
    dressPin(b, h, anchor);
    b.hidden = false;
    const l = b.querySelector<HTMLElement>('.cx-pin-label')!;
    const view = rel(viewEl);
    const obs = obstacles(viewEl);
    // The anchor's own words are taken already: the dot is beside them.
    const lab = labelSpot(mark, a, rel(anchor), side, l.offsetWidth, l.offsetHeight, obs, view, dock);
    layPin(b, mark, lab);
    b.dataset.placed = '';
  }

  // Step 02: the run history's notes open from a dot on the list's lead line ("What we look at:"). Closed, the
  // lead keeps its line, empty, and the rows stay out; open, the lead's words follow the dot and the rows show.
  function placeRowsPin(): void {
    if (!rowsHost || !layer || !rowsHost.twin) return;
    const on = open.has(rowsHost.id);
    root.dataset.cxRows = on ? 'open' : 'closed';
    rowsHost.twin.hidden = !on;
    const b = pins.get(rowsHost.id) ?? makePin(rowsHost);
    const here = active === rowsHost.step && !!rowLead?.checkVisibility();
    b.hidden = !here;
    if (!here || !rowLead) return;
    dressPin(b, rowsHost, null);
    const lr = rel(rowLead);
    const cs = getComputedStyle(rowLead);
    const pad = parseFloat(cs.getPropertyValue('--cx-lead-pad')) || 0;
    const lh = parseFloat(cs.lineHeight) || 14;
    // The dot starts at the lead's padding edge, centred on its first line; the label follows it.
    const cy = lr.y + parseFloat(cs.paddingTop) + lh / 2;
    const m = markRect([lr.x + pad + DOT, cy]);
    const l = b.querySelector<HTMLElement>('.cx-pin-label')!;
    const lab = { x: m.x + m.w + 6, y: m.cy - l.offsetHeight / 2, w: l.offsetWidth, h: l.offsetHeight };
    layPin(b, m, lab);
    b.dataset.placed = '';
    rowLead.style.setProperty('--cx-pin-w', `${m.w + 10}px`);
  }

  // A reader's own press shows or hides a note at once (the 800 ms wait is for the board's scene change).
  function toggle(id: string): void {
    layer?.classList.add('is-now');
    if (open.has(id)) close(id);
    else {
      open.clear();
      open.add(id);
      settle();
    }
  }
  function close(id: string, { focus = false } = {}): void {
    if (!open.delete(id)) return;
    layer?.classList.add('is-now');
    settle();
    if (focus) pins.get(id)?.focus();
  }

  // Escape closes the open note (focus back on its dot when it was in the note); a press outside its dot and
  // plate closes it too.
  doc.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || !open.size) return;
      const id = [...open][0];
      const b = pins.get(id);
      const h = hosts.find((x) => x.id === id);
      const inNote = !!b && (b.contains(doc.activeElement) || !!h?.plate?.contains(doc.activeElement));
      close(id, { focus: inNote });
    },
    { signal },
  );
  doc.addEventListener(
    'pointerdown',
    (e) => {
      if (!open.size) return;
      const id = [...open][0];
      const h = hosts.find((x) => x.id === id);
      const t = e.target as Node;
      if (pins.get(id)?.contains(t) || h?.plate?.contains(t)) return;
      close(id);
    },
    { signal, capture: true },
  );

  // The board moves things during a scene change (GSAP, up to ~2 s): place again every 120 ms until the anchor
  // has held still for two polls (3 s at most).
  function anchorNow(): string {
    const h = hosts.find((x) => x.plate && x.step === active);
    if (!h) return '';
    const el = anchorOf(h.plate!.dataset.anchor);
    return el ? Object.values(rel(el)).map(Math.round).join(',') : 'missing';
  }
  function settle(): void {
    timers.splice(0).forEach(clearTimeout);
    if (!layer) return;
    placePlates();
    let last = anchorNow();
    let still = 0;
    let t = 0;
    const poll = () => {
      t += 120;
      const now = anchorNow();
      still = now === last && now !== 'missing' ? still + 1 : 0;
      last = now;
      if (still === 0 || t <= 240) placePlates();
      if (still < 2 && t < 3000) timers.push(window.setTimeout(poll, 120));
      else placePlates();
    };
    timers.push(window.setTimeout(poll, 120));
  }

  window.addEventListener('resize', settle, { signal });
  // The board's scene can change after the step does (a screen rises over the board): place again then.
  const sceneWatch = new MutationObserver(settle);
  sceneWatch.observe(root, { attributes: true, attributeFilter: ['data-scene'] });
  signal.addEventListener('abort', () => sceneWatch.disconnect());
  root.classList.add('cx-live');
  settle();

  return {
    step(n) {
      if (n !== active) {
        // A note opened at one step closes at the next.
        open.clear();
        layer?.classList.remove('is-now');
        for (const b of pins.values()) b.removeAttribute('data-placed');
      }
      active = n;
      for (const h of hosts) h.plate?.removeAttribute('data-placed');
      settle();
    },
    refresh: settle,
    destroy() {
      ac.abort();
      timers.splice(0).forEach(clearTimeout);
      for (const b of pins.values()) b.remove();
      rowLead?.style.removeProperty('--cx-pin-w');
      root.classList.remove('cx-live');
    },
  };
}
