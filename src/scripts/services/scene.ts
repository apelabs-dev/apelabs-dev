// The deliverable as a small live system. Wide = 480×360 (desktop/tablet), narrow = 340×440 (phones, fewer
// nodes rather than smaller text). Timings are progress fractions of one bounded sequence.
// Every position is laid on the spacing tokens in primitives.ts (edge 16 wide / 12 narrow, sibling cards 8
// apart, wired columns 16 or 24, card pads 12/8, 16 rows).
import {
  card, chip, chipW, edge, packet, route, label, strip, sticky, anim, t, stage, monoW, icon, SP, CARD, SCENE, BASE,
} from './primitives';
import { services, type Service } from './content';

type Layout = 'wide' | 'narrow';
type Pt = [number, number];

const W = { w: 480, h: 360, e: SCENE.wide };
const N = { w: 340, h: 440, e: SCENE.narrow };
// Section labels: a 16 text row whose top sits 4 above the edge (the caps land on it), 8 above the content.
const LABEL = { wide: W.e - SP.s4 + BASE.mono, narrow: N.e - SP.s4 + BASE.mono };
const TOP = { wide: W.e - SP.s4 + CARD.row + SP.s8, narrow: N.e - SP.s4 + CARD.row + SP.s8 };
const STRIP = 328; // wide strip divider: 12 below the content bottom (316), its text row 8 below it
const r1 = (n: number) => Math.round(n * 10) / 10;
const payload = (k: string, v: string): [string, string][] => [
  ['{ ', 'muted'],
  [k, 'paper'],
  [': ', 'muted'],
  [`"${v}"`, 'str'],
  [' }', 'muted'],
];
const BUBBLE_H = CARD.row + SP.s16;
const bubbleW = (text: string) => CARD.padX + CARD.icon + CARD.iconGap + monoW(text) + CARD.padX;
const typeWin = (at: string) => {
  const b = Number(at.split(' ')[1]);
  return `${(b + 0.01).toFixed(2)} ${(b + 0.13).toFixed(2)}`;
};
const bubble = (x: number, y: number, w: number, tail: number, text: string, at: string) =>
  anim(
    'enter',
    at,
    '0 -6 0 .96',
    `<g class="sr3-bubble"><path d="M${x + 6} ${y}H${tail - 6}l6 -7 6 7H${x + w - 6}a6 6 0 0 1 6 6v${BUBBLE_H - 12}a6 6 0 0 1 -6 6H${x + 6}a6 6 0 0 1 -6 -6v-${BUBBLE_H - 12}a6 6 0 0 1 6 -6z"/>${icon('message-square', { x: x + CARD.padX, y: y + SP.s8 })}<text x="${x + CARD.padX + CARD.icon + CARD.iconGap}" y="${y + SP.s8 + BASE.mono}" class="sr3-mono" data-type="${typeWin(at)}" data-full="${text}"><tspan class="sr3-paper">${text}</tspan></text></g>`,
    { ease: 'spring' },
  );
const muted = (x: number, y: number, s: string, extra = '') => t(x, y, s, 'sr3-mono sr3-muted', extra);

/* ---------------- AI systems setup ---------------- */
function setup(L: Layout) {
  const toolStates = (at: number, first: string): [number, string, string][] => [
    [0, first, 'idle'],
    [at, 'sent', 'done'],
  ];
  const aiRows = (n: number) => [
    {
      text: `events · ${n}`,
      states: [
        [0, 'events · 0'],
        [0.4, 'events · 1'],
        ...(n === 3
          ? [
              [0.42, 'events · 2'],
              [0.5, 'events · 3'],
            ]
          : [[0.44, 'events · 2']]),
      ] as [number, string][],
    },
    {
      text: 'step · reply',
      states: [
        [0, 'step · waiting'],
        [0.4, 'step · read'],
        [0.53, 'step · ask AI'],
        [0.65, 'step · reply'],
      ] as [number, string][],
    },
  ];
  const aiChip: [number, string, string][] = [
    [0, 'idle', 'idle'],
    [0.4, 'running', 'live'],
    [0.88, 'done', 'done'],
  ];
  const asRows = [
    {
      text: 'reply · ready',
      states: [
        [0, 'reply · waiting'],
        [0.74, 'reply · drafting'],
        [0.88, 'reply · ready'],
      ] as [number, string][],
    },
  ];
  const asChip: [number, string, string][] = [
    [0, 'queued', 'idle'],
    [0.72, 'running', 'live'],
    [0.88, 'done', 'done'],
  ];
  if (L === 'wide') {
    // Three tool cards stacked 8 apart (36–316); the AI workflow 16 to their right, centred on the middle tool;
    // Local AI, Assistant and the drafted reply in the right column.
    const tw = 166, th = 88, ax = W.e + tw + SCENE.col, aw = 130, ay = 124, rx = ax + aw + SCENE.col, rw = W.w - W.e - rx;
    const tools = [
      { name: 'HubSpot', rows: payload('lead', 'sample'), st: toolStates(0.28, 'connected'), meta: '12:04:01' },
      { name: 'Google Sheets', rows: payload('row', 'new'), st: toolStates(0.35, 'listening'), meta: '12:04:02' },
      { name: 'Zapier', rows: payload('form', 'sent'), st: toolStates(0.38, 'connected'), meta: '12:04:02' },
    ].map((s, i) => ({ ...s, y: TOP.wide + i * (th + SCENE.sib) }));
    const bx = ax - SP.s8, mid = ay + 52, inY = [mid - CARD.row, mid, mid + CARD.row];
    const e = [
      route([[ax - SCENE.col, 80], [bx, 80], [bx, inY[0]], [ax, inY[0]]]),
      route([[ax - SCENE.col, 176], [ax, inY[1]]]),
      route([[ax - SCENE.col, 272], [bx, 272], [bx, inY[2]], [ax, inY[2]]]),
    ];
    const lax = ax + aw / 2, ly = TOP.wide + 44, asY = TOP.wide + 88 + SP.s24, outY = asY + 44;
    const out = route([[ax + aw, outY], [rx, outY]]);
    const down = route([[lax, ay], [lax, ly], [rx, ly]]);
    const up = route([[rx, ly], [lax, ly], [lax, ay]]);
    const bw = bubbleW('Thanks, got it.'), bY = asY + 88 + SP.s12;
    const aiPorts: (string | Pt)[] = [...inY.map((y): Pt => [ax, y]), [ax + aw, outY], [lax, ay]];
    return `${label(W.e, LABEL.wide, 'Tools you already use')}${label(W.w - W.e, LABEL.wide, 'One AI workflow', 'end')}
      ${e.map((g, i) => edge(g, { draw: `${0.12 + i * 0.03} ${0.24 + i * 0.03}`, lit: `${[0.4, 0.42, 0.5][i]} ${[0.46, 0.48, 0.56][i]}` })).join('')}
      ${edge(out, { draw: '.2 .3', lit: '.72 .78' })}${edge(down, { dashed: true, lit: '.58 .64' })}
      ${tools.map((s, i) => anim('enter', `${i * 0.04} ${0.14 + i * 0.04}`, '-14 0', card({ x: W.e, y: s.y, w: tw, tool: s.name, name: s.name, rows: [{ parts: s.rows }], status: s.st, meta: s.meta, ports: 'r', pulse: `${s.st[1][0]}` }))).join('')}
      ${anim('enter', '.1 .3', '0 0 0 .92', card({ x: ax, y: ay, w: aw, icon: 'workflow', name: 'AI workflow', focal: true, plates: 2, lit: '.40 .6', pulse: '.40 .42 .50 .65', ports: aiPorts, rows: aiRows(3), status: aiChip }), { ease: 'spring' })}
      ${anim('enter', '.16 .32', '0 10', card({ x: rx, y: TOP.wide, w: rw, icon: 'cpu', name: 'Local AI', ports: [[rx, ly]], pulse: '.58', rows: [{ text: 'private' }], status: [[0, 'local', 'live']] }))}
      ${anim('enter', '.18 .34', '14 0', card({ x: rx, y: asY, w: rw, icon: 'bot', name: 'Assistant', ports: 'l', pulse: '.72', rows: asRows, status: asChip }))}
      ${bubble(W.w - W.e - bw, bY, bw, rx + SP.s32, 'Thanks, got it.', '.74 .80')}
      ${e.map((g, i) => packet(g, ['.28 .40', '.35 .42', '.38 .50'][i])).join('')}${packet(down, '.53 .58')}${packet(up, '.60 .65')}${packet(out, '.66 .72')}
      ${strip(W.w, STRIP, 'sample run', { text: '12:04:04', states: [[0, '12:04:00'], [0.28, '12:04:01'], [0.5, '12:04:03'], [0.88, '12:04:04']] }, { live: '.28 .32' })}`;
  }
  // Phones: the two tools side by side (timestamp on its own row), the AI workflow and Local AI top-aligned beneath,
  // the Assistant full width, then the reply.
  const tw = (N.w - 2 * N.e - SCENE.sib) / 2, th = 104, t2 = N.e + tw + SCENE.sib, ay = TOP.narrow + th + SP.s24, aw = 156, ah = 104;
  const lx = N.e + aw + SP.s24, lw = N.w - N.e - lx, lh = 64, ly = ay, asY = ay + ah + SP.s24;
  const c1 = N.e + tw / 2, c2 = t2 + tw / 2, p2 = N.e + aw - SP.s32;
  const n1 = route([[c1, TOP.narrow + th], [c1, ay]]);
  const n2 = route([[c2, TOP.narrow + th], [c2, ay - CARD.padX], [p2, ay - CARD.padX], [p2, ay]]);
  const link = route([[N.e + aw, ly + lh / 2], [lx, ly + lh / 2]]);
  const back = route([[lx, ly + lh / 2], [N.e + aw, ly + lh / 2]]);
  const out = route([[c1, ay + ah], [c1, asY]]);
  const aiPorts: Pt[] = [[c1, ay], [p2, ay], [N.e + aw, ly + lh / 2], [c1, ay + ah]];
  return `${label(N.e, LABEL.narrow, 'Tools you already use')}
    ${edge(n1, { draw: '.12 .24', lit: '.40 .46' })}${edge(n2, { draw: '.15 .27', lit: '.44 .5' })}${edge(link, { dashed: true, lit: '.58 .64' })}${edge(out, { draw: '.2 .3', lit: '.72 .78' })}
    ${anim('enter', '0 .14', '0 -12', card({ x: N.e, y: TOP.narrow, w: tw, tool: 'HubSpot', name: 'HubSpot', rows: [{ parts: payload('lead', 'sample') }, { text: '12:04:01' }], status: [[0, 'connected', 'idle'], [0.28, 'sent', 'done']], ports: 'b', pulse: '.28' }))}
    ${anim('enter', '.04 .18', '0 -12', card({ x: t2, y: TOP.narrow, w: tw, tool: 'Google Sheets', name: 'Google Sheets', rows: [{ parts: payload('row', 'new') }, { text: '12:04:02' }], status: [[0, 'listening', 'idle'], [0.32, 'sent', 'done']], ports: 'b', pulse: '.32' }))}
    ${anim('enter', '.1 .3', '0 0 0 .92', card({ x: N.e, y: ay, w: aw, icon: 'workflow', name: 'AI workflow', focal: true, plates: 2, lit: '.40 .6', pulse: '.40 .44 .65', ports: aiPorts, rows: aiRows(2), status: aiChip }), { ease: 'spring' })}
    ${anim('enter', '.16 .32', '10 0', card({ x: lx, y: ly, w: lw, icon: 'cpu', name: 'Local AI', ports: 'l', pulse: '.58', status: [[0, 'local', 'live']], meta: 'private' }))}
    ${anim('enter', '.18 .34', '0 12', card({ x: N.e, y: asY, w: N.w - 2 * N.e, icon: 'bot', name: 'Assistant', ports: [[c1, asY]], pulse: '.72', rows: asRows, status: asChip, meta: { text: '12:04:04', states: [[0, '--:--'], [0.88, '12:04:04']] } }))}
    ${bubble(N.e, asY + 88 + SP.s12, bubbleW('Thanks, got it.'), N.e + SP.s32, 'Thanks, got it.', '.74 .80')}
    ${packet(n1, '.28 .40')}${packet(n2, '.32 .44')}${packet(link, '.53 .58')}${packet(back, '.60 .65')}${packet(out, '.66 .72')}`;
}

/* ---------------- Second opinion ---------------- */
// Pins and their callouts are fixed coordinates; the cards are laid around them.
const pin = (x: number, y: number, n: string, cx: number, cy: number, text: string, at: string) =>
  anim(
    'enter',
    at,
    '0 -16',
    `<g class="sr3-callout"><rect x="${cx}" y="${cy}" width="${text.length * 6 + 16}" height="17" rx="4"/>${t(cx + 8, cy + 12, text, 'sr3-mono sr3-paper')}</g><g class="sr3-pin"><path d="M${x} ${y + 9}v7"/><rect x="${x - 8}" y="${y - 8}" width="16" height="16" rx="4"/>${t(x, y + 3.6, n, 'sr3-pin-text', 'text-anchor="middle"')}</g>`,
    { ease: 'spring' },
  );
const findings = [
  ['Permissions', 'who can edit what'],
  ['Field mappings', 'form → CRM fields'],
  ['Error paths', 'failed step → alert'],
];
const findingsChip: [number, string, string][] = [
  [0, 'draft', 'idle'],
  [0.62, 'writing', 'live'],
  [0.9, 'ready', 'done'],
];
const nodes: [string, string?][] = [['Web form', 'clipboard-list'], ['Zapier'], ['Google Sheets'], ['HubSpot'], ['Alert', 'bell'], ['QuickBooks']];
const mini = ([name, ic]: [string, string?], x: number, y: number, w: number, h: number, i: number, lines?: string[]) =>
  anim('enter', `${i * 0.02} ${0.12 + i * 0.02}`, '0 8', card({ x, y, w, h, mini: true, icon: ic, tool: ic ? undefined : name, name, lines, dot: false, ports: [] }));

function opinion(L: Layout) {
  if (L === 'wide') {
    // Board 16–292 with 12 pads; rows 48 tall and 40 apart, columns 16 apart. Each wire runs through its cards'
    // centres. "Google Sheets" sets on two lines: one line needs 134 and the column is 108.
    const bx = W.e, bw = 276, by = TOP.wide, bh = 280, c1 = bx + CARD.padX, w1 = 108, c2 = c1 + w1 + SCENE.col, w2 = bx + bw - CARD.padX - c2, rh = 48, rows = [72, 160, 248];
    const at = (i: number): [number, number, number, number] => [i % 2 ? c2 : c1, rows[i >> 1], i % 2 ? w2 : w1, rh];
    const m1 = c1 + w1, mx = c2 + w2 / 2, my = rows.map((y) => y + rh / 2);
    const e = [
      route([[m1, my[0]], [c2, my[0]]]),
      route([[mx, rows[0] + rh], [mx, rows[1]]]),
      route([[c2, my[1]], [m1, my[1]]]),
      route([[mx, rows[1] + rh], [mx, rows[2]]]),
    ];
    const err = route([[c2, my[2]], [m1, my[2]]]);
    const fx = bx + bw + SP.s12, fw = W.w - W.e - fx, fy = TOP.wide, fh = bh;
    const ent = [48, 120, 192], div = [100, 172], foot = 240, chipY = foot + SP.s12;
    const fcard = card({
      x: fx, y: fy, w: fw, h: fh, icon: 'file-text', name: 'Written findings', dot: false, ports: [], plates: 1,
      body: `<path class="sr3-divider" d="M${fx + 1} ${fy + foot}H${fx + fw - 1}"/>${chip(fx + CARD.padX, fy + chipY, findingsChip)}${muted(fx + fw - CARD.padX, fy + chipY + BASE.mono, 'sample', 'text-anchor="end"')}`,
    });
    const tx = fx + CARD.padX + SP.s12 + SP.s8;
    return `${label(W.e, LABEL.wide, 'Small app · critical flow')}${label(W.w - W.e, LABEL.wide, 'Written findings', 'end')}
      <rect class="sr3-board" x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="9"/>${muted(c1, by + CARD.padX + BASE.mono, 'critical-flow.map')}
      ${e.map((g, i) => edge(g, { draw: `${0.06 + i * 0.025} ${0.16 + i * 0.025}` })).join('')}${edge(err, { dashed: true, lit: '.37 .43' })}
      ${nodes.map((n, i) => { const [x, y, w, h] = at(i); return mini(n, x, y, w, h, i, n[0] === 'Google Sheets' ? ['Google', 'Sheets'] : undefined); }).join('')}
      <g class="sr3-scan" data-scan=".08 .5 250" opacity="0"><rect x="${bx + 1}" y="38" width="${bw - 2}" height="26" fill="url(#SCAN)"/><path d="M${bx + 1} 64H${bx + bw - 1}"/></g>
      ${pin(262, 70, '1', 168, 46, 'Permissions', '.19 .29')}${pin(218, 136, '2', 96, 128, 'Field mappings', '.26 .36')}${pin(148, 268, '3', 88, 226, 'Error paths', '.36 .46')}
      ${anim('enter', '.54 .68', '18 0', `${fcard}
        ${findings.map(([a, b], i) => anim('enter', `${0.64 + i * 0.07} ${0.74 + i * 0.07}`, '-10 0', `${t(fx + CARD.padX, fy + ent[i] + BASE.mono, `0${i + 1}`, 'sr3-mono sr3-orange-text')}${t(tx, fy + ent[i] + BASE.name, a, 'sr3-name sr3-name-s')}${muted(tx, fy + ent[i] + CARD.row + BASE.mono, b)}${i < 2 ? `<path class="sr3-divider" d="M${fx + CARD.padX} ${fy + div[i]}H${fx + fw - CARD.padX}"/>` : ''}`)).join('')}`, { ease: 'spring' })}
      ${strip(W.w, STRIP, 'review · sample', { text: 'note · ready', states: [[0, 'scan · idle'], [0.08, 'scan · running'], [0.5, 'scan · done'], [0.9, 'note · ready']] }, { live: '.08 .12' })}`;
  }
  // Phones: rows 40 tall and 32 apart, columns 32 apart; the left column is 134 so "Google Sheets" fits on one
  // line, which leaves pin 3 4 clear of the Alert card. Pins sit on their wires.
  const bx = N.e, bw = N.w - 2 * N.e, by = TOP.narrow, c1 = bx + CARD.padX, w1 = 134, c2 = c1 + w1 + SP.s32, w2 = bx + bw - CARD.padX - c2, ys = [60, 132, 204], bh = ys[2] + CARD.mini + CARD.padX - by;
  const m1 = c1 + w1, mx = c2 + w2 / 2, my = ys.map((y) => y + CARD.mini / 2);
  const e = [
    route([[m1, my[0]], [c2, my[0]]]),
    route([[mx, ys[0] + CARD.mini], [mx, ys[1]]]),
    route([[c2, my[1]], [m1, my[1]]]),
    route([[mx, ys[1] + CARD.mini], [mx, ys[2]]]),
  ];
  const err = route([[c2, my[2]], [m1, my[2]]]);
  const fy = by + bh + SP.s16, fw = bw, rowY = (i: number) => CARD.head + CARD.bodyGap + i * SP.s32, fh = rowY(2) + CARD.row + SP.s8 + CARD.chip + CARD.padY;
  const fcard = card({
    x: bx, y: fy, w: fw, h: fh, icon: 'file-text', name: 'Written findings', dot: false, ports: [], plates: 1,
    body: `${chip(bx + CARD.padX, fy + rowY(2) + CARD.row + SP.s8, findingsChip)}${muted(bx + fw - CARD.padX, fy + rowY(2) + CARD.row + SP.s8 + BASE.mono, 'sample', 'text-anchor="end"')}`,
  });
  return `${label(N.e, LABEL.narrow, 'Small app · critical flow')}
    <rect class="sr3-board" x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="9"/>${muted(c1, by + SP.s8 + BASE.mono, 'critical-flow.map')}
    ${e.map((g, i) => edge(g, { draw: `${0.06 + i * 0.025} ${0.16 + i * 0.025}` })).join('')}${edge(err, { dashed: true, lit: '.37 .43' })}
    ${nodes.map((n, i) => mini(n, i % 2 ? c2 : c1, ys[i >> 1], i % 2 ? w2 : w1, CARD.mini, i)).join('')}
    <g class="sr3-scan" data-scan=".08 .5 190" opacity="0"><rect x="${bx + 1}" y="34" width="${bw - 2}" height="26" fill="url(#SCAN)"/><path d="M${bx + 1} 60H${bx + bw - 1}"/></g>
    ${pin(310, 62, '1', 214, 40, 'Permissions', '.19 .29')}${pin(256, 118, '2', 140, 110, 'Field mappings', '.26 .36')}${pin(170, 220, '3', 129, 176, 'Error paths', '.36 .46')}
    ${anim('enter', '.54 .68', '0 14', `${fcard}
      ${findings.map(([a, b], i) => anim('enter', `${0.64 + i * 0.07} ${0.74 + i * 0.07}`, '-10 0', `${t(bx + CARD.padX, fy + rowY(i) + BASE.mono, `0${i + 1}`, 'sr3-mono sr3-orange-text')}${t(bx + CARD.padX + SP.s20, fy + rowY(i) + BASE.name, a, 'sr3-name sr3-name-s')}${muted(bx + fw - CARD.padX, fy + rowY(i) + BASE.mono, b, 'text-anchor="end"')}${i < 2 ? `<path class="sr3-divider" d="M${bx + CARD.padX} ${fy + rowY(i) + CARD.row + SP.s8}H${bx + fw - CARD.padX}"/>` : ''}`)).join('')}`, { ease: 'spring' })}`;
}

/* ---------------- Custom builds ---------------- */
const FIELD = { h: SP.s20, label: monoW('stage') + SP.s12, padX: SP.s8 };
const field = (x: number, y: number, w: number, k: string, v: string) =>
  `${muted(x, y + FIELD.h / 2 - CARD.row / 2 + BASE.mono, k)}<rect class="sr3-input" x="${x + FIELD.label}" y="${y}" width="${w - FIELD.label}" height="${FIELD.h}" rx="4"/>${t(x + FIELD.label + FIELD.padX, y + FIELD.h / 2 - CARD.row / 2 + BASE.mono, v, 'sr3-mono sr3-paper')}`;
const STEP = { h: SP.s24, w: 76 };
const steps3 = (x: number, y: number, gap: number, at: number[]) =>
  ['form', 'check', 'save']
    .map((s, i) => {
      const sx = x + i * (STEP.w + gap);
      return `<g><rect class="sr3-step" x="${sx}" y="${y}" width="${STEP.w}" height="${STEP.h}" rx="4"/><rect class="sr3-step is-lit" x="${sx}" y="${y}" width="${STEP.w}" height="${STEP.h}" rx="4" data-fade="${at[i]} ${at[i] + 0.03}"/>${t(sx + STEP.w / 2, y + STEP.h / 2 - CARD.row / 2 + BASE.mono, s, 'sr3-mono sr3-paper', 'text-anchor="middle"')}${i < 2 ? `<path class="sr3-wire" d="M${sx + STEP.w} ${y + STEP.h / 2}h${gap}"/>` : ''}</g>`;
    })
    .join('');
const stepPackets = (x: number, y: number, gap: number) =>
  [0, 1]
    .map((i) =>
      packet(route([[x + STEP.w + i * (STEP.w + gap), y + STEP.h / 2], [x + STEP.w + i * (STEP.w + gap) + gap, y + STEP.h / 2]]), ['.86 .89', '.89 .92'][i], { dim: true }),
    )
    .join('');
const NAV = ['Leads', 'Jobs', 'Invoices', 'Settings'];
const NAV_ICON = ['users', 'briefcase', 'receipt', 'settings'];
const NAV_ROW = SP.s32;
const socket = (x: number, y: number, w: number, h: number, s: string, at: string) =>
  `<g data-fade="${at} ${(+at + 0.04).toFixed(3)} 1 0" opacity="0"><rect class="sr3-socket" x="${x}" y="${y}" width="${w}" height="${h}" rx="7"/>${muted(x + w / 2, y + h / 2 - CARD.row / 2 + BASE.mono, s, 'text-anchor="middle"')}</g>`;
const ring = (x: number, y: number, w: number, h: number, at: string) =>
  `<rect class="sr3-ring" x="${x - SP.s4}" y="${y - SP.s4}" width="${w + SP.s8}" height="${h + SP.s8}" rx="11" data-pulse="${at}" opacity="0"/>`;
// The shell's bottom row: "sample check", the progress track between, the chip at the right.
const checkRow = (x: number, y: number, w: number, check: [number, string, string][]) => {
  const cw = chipW(check), tx = x + monoW('sample check') + SP.s12, tw = w - (tx - x) - cw - SP.s12;
  return `${muted(x, y + BASE.mono, 'sample check')}<rect class="sr3-track" x="${tx}" y="${y + CARD.row / 2 - 2}" width="${tw}" height="4" rx="2"/><rect class="sr3-track-fill" x="${tx}" y="${y + CARD.row / 2 - 2}" width="${tw}" height="4" rx="2" data-fill=".7 .86"/>${chip(x + w, y, check, { anchor: 'end' })}`;
};
const shell = (x: number, y: number, w: number, h: number, shellChip: [number, string, string][]) =>
  `<g class="sr3-shell"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="11" class="sr3-shell-face"/><path class="sr3-divider" d="M${x + 1} ${y + CARD.head}H${x + w - 1}"/>${[0, 1, 2].map((i) => `<circle class="sr3-tl" cx="${x + 16 + i * 12}" cy="${y + CARD.head / 2}" r="3.2"/>`).join('')}${muted(x + 56, y + CARD.head / 2 - CARD.row / 2 + BASE.mono, 'app · custom build')}${chip(x + w - CARD.padX, y + SP.s8, shellChip, { anchor: 'end' })}</g>`;

function build(L: Layout) {
  const shellChip: [number, string, string][] = [
    [0, 'empty', 'idle'],
    [0.12, 'building', 'live'],
    [0.7, 'booting', 'live'],
    [0.9, 'ready', 'done'],
  ];
  const check: [number, string, string][] = [
    [0, 'queued', 'idle'],
    [0.84, 'running', 'live'],
    [0.93, 'done', 'done'],
  ];
  const snap = (a: number, b: number) => `${(a + (b - a) * 0.32).toFixed(3)}`;
  const flowH = CARD.head + SP.s12 + STEP.h + SP.s12, fieldsH = CARD.head + SP.s12 + FIELD.h + SP.s8 + FIELD.h + SP.s12;
  const flowCard = (x: number, y: number, w: number, gap: number) =>
    card({ x, y, w, h: flowH, icon: 'route', name: 'Critical flow', dot: false, ports: [], body: steps3(x + CARD.padX, y + CARD.head + SP.s12, gap, [0.86, 0.89, 0.92]) });
  const fieldsCard = (x: number, y: number, w: number) =>
    card({ x, y, w, h: fieldsH, icon: 'text-cursor-input', name: 'Fields', dot: false, ports: [], body: field(x + CARD.padX, y + CARD.head + SP.s12, w - 2 * CARD.padX, 'name', 'Sample Co.') + field(x + CARD.padX, y + CARD.head + SP.s12 + FIELD.h + SP.s8, w - 2 * CARD.padX, 'stage', 'new lead') });
  if (L === 'wide') {
    // Shell 16–464 × 36–316; header 32; modules 12 inside it and 12 apart; the check row 12 under them.
    const sx = W.e, sy = TOP.wide, sw = W.w - 2 * W.e, mx = sx + CARD.padX, my = sy + CARD.head + SP.s12, nw = 112, rx = mx + nw + SP.s12, rw = sx + sw - CARD.padX - rx;
    const mh = flowH + SP.s12 + fieldsH, fy = my + flowH + SP.s12, cy = my + mh + SP.s12, sh = cy + CARD.chip + SP.s12 - sy;
    const nav = card({
      x: mx, y: my, w: nw, h: mh, icon: 'panel-left', name: 'Navigation', dot: false, ports: [],
      body: NAV.map((s, i) => {
        const iy = my + CARD.head + SP.s12 + i * (NAV_ROW + SP.s4);
        return `${i === 1 ? `<rect class="sr3-nav-on" x="${mx + SP.s4}" y="${iy}" width="${nw - SP.s8}" height="${NAV_ROW}" rx="4"/>` : ''}${icon(NAV_ICON[i], { x: mx + CARD.padX, y: iy + SP.s8, cls: i === 1 ? 'is-on' : '' })}${t(mx + CARD.padX + CARD.icon + CARD.iconGap, iy + SP.s8 + BASE.mono, s, 'sr3-mono ' + (i === 1 ? 'sr3-paper' : 'sr3-muted'))}`;
      }).join(''),
    });
    const gap = (rw - 2 * CARD.padX - 3 * STEP.w) / 2;
    return `${label(W.e, LABEL.wide, 'Custom build')}${label(W.w - W.e, LABEL.wide, 'After the diagnostic', 'end')}
      ${shell(sx, sy, sw, sh, shellChip)}
      ${socket(mx, my, nw, mh, 'slot · nav', snap(0.12, 0.32))}${socket(rx, my, rw, flowH, 'slot · flow', snap(0.3, 0.5))}${socket(rx, fy, rw, fieldsH, 'slot · fields', snap(0.48, 0.68))}
      ${ring(mx, my, nw, mh, snap(0.12, 0.32))}${ring(rx, my, rw, flowH, snap(0.3, 0.5))}${ring(rx, fy, rw, fieldsH, snap(0.48, 0.68))}
      ${anim('enter', '.12 .32', '-120 30 -7 .96', nav, { ease: 'spring' })}${anim('enter', '.3 .5', '90 -70 6 .96', flowCard(rx, my, rw, gap), { ease: 'spring' })}${anim('enter', '.48 .68', '110 80 -5 .96', fieldsCard(rx, fy, rw), { ease: 'spring' })}
      ${stepPackets(rx + CARD.padX, my + CARD.head + SP.s12, gap)}
      ${checkRow(mx, cy, sw - 2 * CARD.padX, check)}
      ${strip(W.w, STRIP, 'build · sample', { text: 'ready', states: [[0, '0 of 3 modules'], [0.22, '1 of 3 modules'], [0.4, '2 of 3 modules'], [0.58, '3 of 3 modules'], [0.9, 'ready']] }, { live: '.12 .16' })}`;
  }
  // Phones: the modules stack 12 apart inside the shell; its footer row carries the build status.
  const sx = N.e, sy = TOP.narrow, sw = N.w - 2 * N.e, mx = sx + CARD.padX, mw = sw - 2 * CARD.padX, ny = sy + CARD.head + SP.s12;
  const fly = ny + CARD.mini + SP.s12, fdy = fly + flowH + SP.s12, cy = fdy + fieldsH + SP.s12, dv = cy + CARD.chip + SP.s12, ry = dv + SP.s12, sh = ry + CARD.row + SP.s12 - sy;
  const nav = card({ x: mx, y: ny, w: mw, mini: true, icon: 'panel-left', name: 'Navigation', dot: false, ports: [], body: muted(mx + mw - CARD.padX, ny + CARD.mini / 2 - CARD.row / 2 + BASE.mono, 'Leads · Jobs · Invoices', 'text-anchor="end"') });
  const gap = (mw - 2 * CARD.padX - 3 * STEP.w) / 2;
  return `${label(N.e, LABEL.narrow, 'Custom build')}
    ${shell(sx, sy, sw, sh, shellChip)}<path class="sr3-divider" d="M${sx + 1} ${dv}H${sx + sw - 1}"/>
    ${socket(mx, ny, mw, CARD.mini, 'slot · nav', snap(0.12, 0.32))}${socket(mx, fly, mw, flowH, 'slot · flow', snap(0.3, 0.5))}${socket(mx, fdy, mw, fieldsH, 'slot · fields', snap(0.48, 0.68))}
    ${ring(mx, ny, mw, CARD.mini, snap(0.12, 0.32))}${ring(mx, fly, mw, flowH, snap(0.3, 0.5))}${ring(mx, fdy, mw, fieldsH, snap(0.48, 0.68))}
    ${anim('enter', '.12 .32', '-90 -20 -5 .96', nav, { ease: 'spring' })}${anim('enter', '.3 .5', '90 -30 5 .96', flowCard(mx, fly, mw, gap), { ease: 'spring' })}${anim('enter', '.48 .68', '-80 60 -4 .96', fieldsCard(mx, fdy, mw), { ease: 'spring' })}
    ${stepPackets(mx + CARD.padX, fly + CARD.head + SP.s12, gap)}
    ${checkRow(mx, cy, mw, check)}
    ${muted(mx, ry + BASE.mono, 'build · sample')}<text x="${mx + mw}" y="${ry + BASE.mono}" text-anchor="end" class="sr3-mono sr3-muted" data-text="0:0 of 3 modules|.22:1 of 3 modules|.4:2 of 3 modules|.58:3 of 3 modules|.9:ready">ready</text>`;
}

/* ---------------- AI workshop ---------------- */
const STICKY = { w: 88, h: 64 };
function workshop(L: Layout) {
  const notes = [['new lead', 'comes in'], ['copy to', 'CRM'], ['send intro', 'email'], ['remind on', 'Friday']];
  const pulls = [0.14, 0.3, 0.46];
  const nodeSt: [number, string, string][][] = [
    [[0, 'trigger', 'idle'], [0.7, 'sent', 'done']],
    [[0, 'queued', 'idle'], [0.76, 'running', 'live'], [0.8, 'done', 'done']],
    [[0, 'queued', 'idle'], [0.84, 'running', 'live'], [0.9, 'sent', 'done']],
  ];
  const names: [string, string?][] = [['Web form', 'clipboard-list'], ['HubSpot'], ['Email', 'mail']];
  const metas = ['lead', 'add', 'intro'], pulse = ['.7', '.76', '.84'];
  const status = {
    text: 'sample run · done',
    states: [[0, 'ideas on the board'], [0.14, '1 step automated'], [0.3, '2 steps automated'], [0.46, '3 steps automated'], [0.7, 'sample run'], [0.9, 'sample run · done']] as [number, string][],
  };
  // A pulled note is lifted: it is drawn after the note that stays and after the lane's nodes, so it passes over
  // them and its words are never half hidden on the way.
  const pulled = (i: number, x: number, y: number, w: number, h: number, r: number, tx: number, ty: number, s: number) =>
    anim('leave', `${pulls[i]} ${pulls[i] + 0.12}`, `${r1(tx - (x + w / 2))} ${r1(ty - (y + h / 2))} ${-r} ${s}`, sticky(x, y, w, h, notes[i], { rot: r }));
  const sockets = (pos: number[][], w: number, h: number) =>
    pos
      .slice(0, 3)
      .map(([x, y], i) => `<g data-fade="${(pulls[i] + 0.07).toFixed(2)} ${(pulls[i] + 0.12).toFixed(2)}"><rect class="sr3-socket" x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>${muted(x + w / 2, y + h / 2 - CARD.row / 2 + BASE.mono, `→ step ${i + 1}`, 'text-anchor="middle"')}</g>`)
      .join('');
  if (L === 'wide') {
    // Team board (36–156): four notes 88 wide, 24 apart, 12 under the board's header row. Flow lane (172–312):
    // three nodes 120 wide joined by 32 wires, 12 under its header row.
    const by = TOP.wide, sy = by + CARD.padX + CARD.row + SP.s12, bh = sy + STICKY.h + SP.s16 - by, ly = by + bh + SP.s16, ny = ly + CARD.padX + CARD.row + SP.s12, nh = 88, lh = ny + nh + SP.s12 - ly;
    const pos = [[-3], [2], [-2], [3]].map(([r], i) => [W.e + CARD.padX + i * (STICKY.w + SP.s24), sy, r]);
    const nw = 120, ng = (W.w - 2 * W.e - 2 * CARD.padX - 3 * nw) / 2, slot = [0, 1, 2].map((i) => W.e + CARD.padX + i * (nw + ng)), mid = ny + nh / 2;
    const e = [route([[slot[0] + nw, mid], [slot[1], mid]]), route([[slot[1] + nw, mid], [slot[2], mid]])];
    return `${label(W.e, LABEL.wide, 'Team board')}${label(W.w - W.e, LABEL.wide, 'Flow lane', 'end')}
      <rect class="sr3-board" x="${W.e}" y="${by}" width="${W.w - 2 * W.e}" height="${bh}" rx="9"/>${muted(W.e + CARD.padX, by + CARD.padX + BASE.mono, 'workshop · ideas')}
      <rect class="sr3-board" x="${W.e}" y="${ly}" width="${W.w - 2 * W.e}" height="${lh}" rx="9"/>${muted(W.e + CARD.padX, ly + CARD.padX + BASE.mono, 'flow lane · automated')}
      ${sockets(pos, STICKY.w, STICKY.h)}
      ${e.map((g, i) => edge(g, { draw: `${0.6 + i * 0.03} ${0.68 + i * 0.03}`, lit: `${[0.76, 0.84][i]} ${[0.8, 0.88][i]}` })).join('')}
      ${sticky(pos[3][0], pos[3][1], STICKY.w, STICKY.h, notes[3], { rot: pos[3][2] })}
      ${slot.map((x, i) => anim('enter', `${pulls[i] + 0.07} ${pulls[i] + 0.2}`, '0 -14 0 .94', card({ x, y: ny, w: nw, icon: names[i][1], tool: names[i][1] ? undefined : names[i][0], name: names[i][0], ports: i === 0 ? 'r' : i === 2 ? 'l' : 'lr', rows: [{ text: metas[i] }], status: nodeSt[i], pulse: pulse[i] }), { ease: 'spring' })).join('')}
      ${pos.slice(0, 3).map(([x, y, r], i) => pulled(i, x, y, STICKY.w, STICKY.h, r, slot[i] + nw / 2, mid, 0.9)).join('')}
      ${packet(e[0], '.7 .76')}${packet(e[1], '.8 .84')}
      ${strip(W.w, STRIP, 'workshop · sample', status, { live: '.7 .74' })}`;
  }
  // Phones: the notes 2 × 2; the lane's three nodes are full-width rows 16 apart, joined by wires under their icons.
  const sw = (N.w - 2 * N.e - 2 * CARD.padX - SP.s20) / 2, sh = 56, by = TOP.narrow, s1 = by + CARD.padX, bh = CARD.padX + sh + SP.s12 + sh + SP.s16;
  const pos = [[-3], [2], [-2], [3]].map(([r], i) => [N.e + CARD.padX + (i % 2) * (sw + SP.s20), s1 + (i >> 1) * (sh + SP.s12), r]);
  const ly = by + bh + SP.s12, ny = ly + CARD.padX + CARD.row + SP.s12, nx = N.e + CARD.padX, nw = N.w - 2 * N.e - 2 * CARD.padX, lh = CARD.padX + CARD.row + SP.s12 + 3 * CARD.mini + 2 * SP.s16 + CARD.padX;
  const rowY = (i: number) => ny + i * (CARD.mini + SP.s16), wx = nx + CARD.padX + CARD.icon / 2, fy = ly + lh + SP.s12;
  const e = [route([[wx, rowY(0) + CARD.mini], [wx, rowY(1)]]), route([[wx, rowY(1) + CARD.mini], [wx, rowY(2)]])];
  const nodeRow = (i: number) => {
    const y = rowY(i), cw = chipW(nodeSt[i]), cx = nx + nw - CARD.padX;
    const ports: Pt[] = [...(i ? [[wx, y] as Pt] : []), ...(i < 2 ? [[wx, y + CARD.mini] as Pt] : [])];
    return card({
      x: nx, y, w: nw, mini: true, icon: names[i][1], tool: names[i][1] ? undefined : names[i][0], name: names[i][0], dot: false, pulse: pulse[i], ports,
      body: `${chip(cx, y + CARD.miniPad, nodeSt[i], { anchor: 'end' })}${muted(cx - cw - SP.s8, y + CARD.miniPad + BASE.mono, metas[i], 'text-anchor="end"')}`,
    });
  };
  return `${label(N.e, LABEL.narrow, 'Team board')}
    <rect class="sr3-board" x="${N.e}" y="${by}" width="${N.w - 2 * N.e}" height="${bh}" rx="9"/>
    <rect class="sr3-board" x="${N.e}" y="${ly}" width="${N.w - 2 * N.e}" height="${lh}" rx="9"/>${muted(N.e + CARD.padX, ly + CARD.padX + BASE.mono, 'flow lane · automated')}
    ${sockets(pos, sw, sh)}
    ${e.map((g, i) => edge(g, { draw: `${0.6 + i * 0.03} ${0.68 + i * 0.03}`, lit: `${[0.76, 0.84][i]} ${[0.8, 0.88][i]}` })).join('')}
    ${sticky(pos[3][0], pos[3][1], sw, sh, notes[3], { rot: pos[3][2] })}
    ${[0, 1, 2].map((i) => anim('enter', `${pulls[i] + 0.07} ${pulls[i] + 0.2}`, '0 -14 0 .94', nodeRow(i), { ease: 'spring' })).join('')}
    ${pos.slice(0, 3).map(([x, y, r], i) => pulled(i, x, y, sw, sh, r, nx + nw / 2, rowY(i) + CARD.mini / 2, 0.7)).join('')}
    ${packet(e[0], '.7 .76')}${packet(e[1], '.8 .84')}
    ${muted(N.e, fy + BASE.mono, 'workshop · sample')}<text x="${N.w - N.e}" y="${fy + BASE.mono}" text-anchor="end" class="sr3-mono sr3-muted" data-text="${status.states.map((s) => s.join(':')).join('|')}">${status.text}</text>`;
}

const scenes: Record<Service['id'], (L: Layout) => string> = { setup, opinion, build, workshop };
const names: Record<Service['id'], string> = {
  setup: 'AI systems setup: existing tools send sample events to one AI workflow, which asks a local AI and drafts a reply',
  opinion: 'Second opinion: a review scan marks three findings on a small app flow and writes them up',
  build: 'Custom builds: three modules snap into an app shell, which boots and passes a sample check',
  workshop: 'AI workshop: sticky notes from a team board become three automated steps, then one sample run goes through',
};

/** One service's wrapper holding the wide (480×360) and narrow (340×440) drawings; CSS swaps them by container width. */
export function renderScene(id: Service['id']): string {
  if (!services.some((s) => s.id === id)) throw new Error('Unknown service: ' + id);
  const layouts: Layout[] = ['wide', 'narrow'];
  return `<div class="sr3-stages">${layouts
    .map((L) => stage(`${id}-a-${L}`, L === 'wide' ? W.w : N.w, L === 'wide' ? W.h : N.h, scenes[id](L), `${names[id]} (illustration, sample data)`, { layout: L }))
    .join('')}</div>`;
}
