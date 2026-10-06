// Geometry of the table as a function of the LIVE screen size (kit 1.7.x fluid viewport: the SHORT side is always 720 units,
// the long side follows the aspect). `setSize(w, h)` (called every frame, cheap when nothing changed) recomputes every position.
// Exports are live bindings / objects mutated in place, so importers always see the current layout.
//
// Seats: 0 = you (bottom), 1 = right, 2 = across (top), 3 = left. Tile "w" is the face width in canvas units;
// a tile is 4:3 tall, so its footprint is w x 1.333w (rotated 90 degrees when it belongs to a side seat).
//
// Three screen shapes:
//   tall     portrait phone (the approved look): big ring, name plates around the table, buttons along the bottom.
//   compact  portrait but shorter (tablets, SE, windows): a flatter table, name plates in a row under the header.
//   wide     landscape: the table in the middle, a status panel on the left and a seat/claim panel on the right, your hand along
//            the bottom edge across the full width. Opponent pools use the width, your 14 tiles stay fully visible.
// The table itself ("cluster": wall ring, the four discard pools, opponents' hands, melds, bonus tiles) is described in its own
// centred coordinates and placed on screen with a uniform scale k and an offset (cx, cy).
import { kindOf } from './rules.js';

export let W = 720, H = 1560;
export const host = { t: 0, r: 0, b: 0, l: 0, back: 0, px: 0.6 };   // safe areas + the host's floating back button, in virtual units (browsers: zeros)
export const ROT = [0, -Math.PI / 2, Math.PI, Math.PI / 2];        // a tile's top points toward the centre of the table
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECONDS = 2;
export const inRect = (r, x, y) => !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const R = (x, y, w, h) => ({ x, y, w, h });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const set = (o, x, y, w, h) => { o.x = x; o.y = y; o.w = w; o.h = h; return o; };

export let HAND_Y = 1372, RIVER_W = 36, HANDZONE_Y = 1100;
export const RING = { cx: 360, cy: 700, half: 120 };
export const BTN = { menu: R(0, 0, 0, 0), hint: R(0, 0, 0, 0), pause: R(0, 0, 0, 0) };
export const CHIPS = [R(0, 0, 0, 0), R(0, 0, 0, 0), R(0, 0, 0, 0), R(0, 0, 0, 0)];
export const AUTO_STEP = { dec: R(0, 0, 0, 0), inc: R(0, 0, 0, 0) };
export const GEO = {
  key: '', mode: 'tall', variant: 'tall', wide: false, k: 1, cx: 360, cy: 700, hr: 120, cols: 6, rows: 4, hw: 330, hubK: 1,
  headerX: 40, headerY1: 80, headerY2: 112, headerSize: 40, claimY: 1128, claimH: 84, claimStack: false, claimRect: null, pillBelow: true,
  pillY: 1222, pillBelowY: 1230, textY: 1182, timerY: 1106, chowY: 1164, chowBackY: 1256, chowTitleY: 1150,
  panels: null, status: null, autoCap: { x: 360, y: 20, size: 15 }, autoThink: { x: 360, y: 72, size: 22 }, bottomY: 1452, inlay: null, backBox: R(0, 0, 0, 0),
  handMax: 52, handCx: 360, handAvail: 694, hudBottom: 0, safeTop: 0, safeBottom: 0,
};

// ------------------------------------------------------------------------------------------------ cluster (canonical coordinates, centre = ring centre)
const P = {};
function params(variant, rows, cols) {
  if (variant === 'tall') return { hr: 120, cols: 6, rows: 4, gapV: 42, gapH: 32, oppW: 30, oppPitch: 31, sideW: 26, sidePitch: 26, tMeld: 34, sMeld: 22, tHandY: -462, tMeldY: -394, flowTopY: -400, flowSideY: -252, sideHandX: 330, sideY0: -214, sideMeldX: 330, sideMeldY0: 180, bMeldY: 366, bFlowY: 368, hw: 330, ownMeldW: 34, ownL: -336, ownR: 336, topL: -330, topR: 330, top: -568, bottom: 400 };
  const hr = 96, gapV = 42, gapH = 32, topEdge = hr + gapV + (rows - 1) * 45 + 24, sideEdge = hr + gapH + (rows - 1) * 45 + 24;
  const sideHandX = sideEdge + 16, sideMeldX = sideHandX + 31, hw = sideMeldX + 15, tHandY = -(topEdge + 22 + 36), bMeldY = topEdge + 24;
  return { hr, cols, rows, gapV, gapH, oppW: 26, oppPitch: 27, sideW: 22, sidePitch: 24, tMeld: 22, sMeld: 22, tMeldY: -(topEdge + 22), tHandY, flowTopY: -(topEdge + 22), flowSideY: -212, sideHandX, sideY0: -190, sideMeldX, sideMeldY0: -190, bMeldY, bFlowY: topEdge + 23, hw, ownMeldW: 30, ownL: -hw, ownR: hw, topL: -hw + 14, topR: hw, top: tHandY - 18, bottom: bMeldY + 20 };
}
P.tall = params('tall'); P.flat3 = params('flat', 3, 7); P.flat4 = params('flat', 4, 6);
const pr = () => P[GEO.variant === 'tall' ? 'tall' : GEO.rows === 3 ? 'flat3' : 'flat4'];
const place = (x, y) => ({ x: GEO.cx + GEO.k * x, y: GEO.cy + GEO.k * y });

// ---- slots in the wall ring: slot i (0..143) -> a position around the ring
export function wallPos(i) {
  const p = pr(), stack = i >> 1, level = i & 1, side = Math.floor(stack / 18), n = stack % 18, half = p.hr, S = (half * 2) / 18, inset = (8 * half) / 120;
  const lift = level * -3.2 * (half / 120);
  let x, y, rot;
  if (side === 0) { x = -half + S * (n + 0.5); y = half - inset; rot = 0; }
  else if (side === 1) { x = half - inset; y = half - S * (n + 0.5); rot = Math.PI / 2; }
  else if (side === 2) { x = half - S * (n + 0.5); y = -half + inset; rot = 0; }
  else { x = -half + inset; y = -half + S * (n + 0.5); rot = Math.PI / 2; }
  const q = place(x, y + lift);
  return { x: q.x, y: q.y, rot, w: 12.5 * (half / 120) * GEO.k };
}

export function riverPos(seat, i) {
  const p = pr(), col = i % p.cols, row = Math.floor(i / p.cols), cc = (col - (p.cols - 1) / 2) * 37.5;
  let x, y;
  switch (seat) {
    case 0: x = cc; y = p.hr + p.gapV + row * 45; break;
    case 2: x = -cc; y = -(p.hr + p.gapV) - row * 45; break;
    case 1: x = p.hr + p.gapH + row * 45; y = -cc; break;
    default: x = -(p.hr + p.gapH) - row * 45; y = cc; break;
  }
  const q = place(x, y);
  return { x: q.x, y: q.y, rot: ROT[seat] };
}

// ---- your hand (screen space, along the bottom)
export function handMetrics(n, hasDrawn, big = false) {
  const gap = hasDrawn ? 18 : 0, count = n + (hasDrawn ? 1 : 0), mx = GEO.handMax + (big ? 4 : 0);
  const tw = Math.min(mx, (GEO.handAvail - gap) / Math.max(1, count) - 1.5);
  const pitch = tw + 1.5, total = pitch * count + gap;
  return { tw, pitch, gap, x0: GEO.handCx - total / 2 + pitch / 2 };
}
export const handTileX = (m, idx, hasDrawn, n) => m.x0 + idx * m.pitch + (hasDrawn && idx >= n ? m.gap : 0);

// exposed sets and bonus tiles for each seat. Returns positions for one meld's tiles.
export function meldOrigin(seat, mi, prevTiles) {
  const p = pr(), k = GEO.k, w = (seat === 0 ? p.ownMeldW : seat === 2 ? p.tMeld : p.sMeld) * k, step = w + 1.5 * k, off = prevTiles * step + mi * 12 * k, span = 3 * step + 12 * k;
  switch (seat) {
    case 0: { const q = place(p.ownL, p.bMeldY); return { x: q.x + w / 2 + off, y: q.y, rot: 0, w, dx: step, dy: 0 }; }
    case 2: { const q = place(p.topR, p.tMeldY); return { x: q.x - w / 2 - off, y: q.y, rot: Math.PI, w, dx: -step, dy: 0 }; }
    case 1: { const q = place(p.sideMeldX, p.sideMeldY0); return { x: q.x, y: q.y + w / 2 + off, rot: ROT[1], w, dx: 0, dy: step, _span: span }; }
    default: { const q = place(-p.sideMeldX, p.sideMeldY0); return { x: q.x, y: q.y + w / 2 + off, rot: ROT[3], w, dx: 0, dy: step, _span: span }; }
  }
}
export function flowerPos(seat, i) {
  const p = pr(), k = GEO.k, tall = GEO.variant === 'tall';
  switch (seat) {
    case 0: { const q = place(p.ownR, p.bFlowY); return { x: q.x - 13 * k - i * 27 * k, y: q.y, rot: 0, w: 24 * k }; }
    case 2: { const q = place(p.topL, p.flowTopY); return { x: q.x + i * 22 * k, y: q.y, rot: Math.PI, w: 20 * k }; }
    case 1: { const q = place(p.sideHandX, p.flowSideY); return { x: q.x, y: q.y, rot: ROT[1], w: 20 * k, ox: -i * (tall ? 22 : 20) * k }; }
    default: { const q = place(-p.sideHandX, p.flowSideY); return { x: q.x, y: q.y, rot: ROT[3], w: 20 * k, ox: i * (tall ? 22 : 20) * k }; }
  }
}
// opponent hand slot idx (0..n-1), plus the extra drawn tile
export function oppHandPos(seat, idx, n, hasDrawn) {
  const p = pr(), k = GEO.k, gap = hasDrawn && idx >= n ? 14 : 0;
  if (seat === 2) {
    const q = place(-((n + (hasDrawn ? 1 : 0)) * p.oppPitch) / 2 + idx * p.oppPitch + p.oppPitch / 2 + gap / 2, p.tHandY);
    return { x: q.x, y: q.y, rot: Math.PI, w: p.oppW * k };
  }
  const q = place(seat === 1 ? p.sideHandX : -p.sideHandX, p.sideY0 + idx * p.sidePitch + gap);
  return { x: q.x, y: q.y, rot: ROT[seat], w: p.sideW * k };
}
// where a big "PUNG!" / "MAHJONG!" call appears for a seat
export const callPos = (seat) => { const p = pr(), d = [[0, p.hr + 70], [p.hr + 60, 0], [0, -(p.hr + 70)], [-(p.hr + 60), 0]][seat]; return place(d[0], d[1]); };
// the hub box inside the ring: centre + scale (1 = the phone layout's 192-unit box)
export const hubRect = () => ({ cx: GEO.cx, cy: GEO.cy, s: GEO.hubK });

// Every tile's target on screen. `s` = rules state; opts = { reveal, selected, big }.
// Returns Map(id -> { x, y, rot, w, f (0 back, 1 face), z })
export function tileTargets(s, opts = {}) {
  const T = new Map(), { reveal = false, selected = -1, big = false } = opts;
  for (let i = s.front; i < s.back; i++) { const t = s.deck[i]; const p = wallPos(i); T.set(t, { ...p, f: 0, z: 0, wall: true }); }
  for (let p = 0; p < 4; p++) {
    const hand = s.hands[p], n = hand.length, drawn = s.turn === p && s.drawn >= 0 ? s.drawn : -1, has = drawn >= 0;
    if (p === 0) {
      const m = handMetrics(n, has, big);
      hand.forEach((t, i) => T.set(t, { x: handTileX(m, i, has, n), y: HAND_Y - (t === selected ? 26 : 0), rot: 0, w: m.tw, f: 1, z: 5, hand: true }));
      if (has) T.set(drawn, { x: handTileX(m, n, true, n), y: HAND_Y - (drawn === selected ? 26 : 0), rot: 0, w: m.tw, f: 1, z: 5, hand: true, drawnTile: true });
    } else {
      const f = reveal ? 1 : 0;
      hand.forEach((t, i) => { const q = oppHandPos(p, i, n, has); T.set(t, { ...q, f, z: 3 }); });
      if (has) { const q = oppHandPos(p, n, n, true); T.set(drawn, { ...q, f, z: 3 }); }
    }
    s.rivers[p].forEach((t, i) => { const q = riverPos(p, i); T.set(t, { ...q, w: RIVER_W * GEO.k, f: 1, z: 1 + i / 100, river: true }); });
    let used = 0;
    s.melds[p].forEach((m, mi) => {
      const o = meldOrigin(p, mi, used);
      m.tiles.forEach((t, ti) => {
        const hidden = m.type === 'ckong' && (ti === 0 || ti === 3) && !reveal;
        T.set(t, { x: o.x + o.dx * ti, y: o.y + o.dy * ti, rot: o.rot, w: o.w, f: hidden ? 0 : 1, z: 2, meld: true });
      });
      used += m.tiles.length;
    });
    s.flowers[p].forEach((t, i) => { const q = flowerPos(p, i); T.set(t, { x: q.x + (q.ox ?? 0), y: q.y, rot: q.rot, w: q.w, f: 1, z: 2, bonus: true }); });
  }
  return T;
}
export const kindAt = (s, t) => kindOf(t);

// ------------------------------------------------------------------------------------------------ buttons and areas
// claim / own-action buttons for n options (n up to 5). Returns rects in order.
export function claimSlots(n) {
  const out = [];
  if (GEO.claimStack) {
    const a = GEO.claimRect, gap = 6, h = Math.min(GEO.claimH, (a.h - (n - 1) * gap) / n);
    for (let i = 0; i < n; i++) out.push(R(a.x, a.y + a.h - (n - i) * (h + gap) + gap, a.w, h));
    return out;
  }
  const gap = 10, w = Math.min(176, (680 - gap * (n - 1)) / n), total = n * w + gap * (n - 1), x0 = GEO.handCx - total / 2;
  for (let i = 0; i < n; i++) out.push(R(x0 + i * (w + gap), GEO.claimY, w, GEO.claimH));
  return out;
}
// the "Which chow?" pickers (n pairs) and their Back button
export function chowSlots(n) {
  const picks = [];
  if (GEO.claimStack) {
    const a = GEO.claimRect, h = 66, gap = 6, back = R(a.x, a.y + a.h - 66, a.w, 66);
    for (let i = 0; i < n; i++) picks.push(R(a.x, back.y - 8 - (n - i) * (h + gap) + gap, a.w, h));
    return { picks, back, title: { x: a.x + a.w / 2, y: picks[0].y - 10 } };
  }
  if (GEO.mode === 'compact') {                                   // no room for a second row: the picks and Back share one row
    const gap = 10, w = Math.min(200, (Math.min(680, W - 24) - n * gap) / (n + 1)), total = (n + 1) * w + n * gap, x0 = GEO.handCx - total / 2;
    for (let i = 0; i < n; i++) picks.push(R(x0 + i * (w + gap), GEO.claimY, w, 78));
    return { picks, back: R(x0 + n * (w + gap), GEO.claimY, w, 78), title: { x: GEO.handCx, y: GEO.claimY - 12 } };
  }
  const w = 200;
  for (let i = 0; i < n; i++) picks.push(R(GEO.handCx - (n * w + (n - 1) * 12) / 2 + i * (w + 12), GEO.chowY, w, 78));
  return { picks, back: R(GEO.handCx - 102, GEO.chowBackY, 204, 62), title: { x: GEO.handCx, y: GEO.chowTitleY } };
}
// the message pill (portrait modes); null in wide, where messages live in the status panel
export const pillRect = (hasButtons, bh) => {
  if (GEO.wide) return null;
  const y = GEO.pillBelow ? (hasButtons ? GEO.pillY : Math.min(GEO.pillBelowY, GEO.bottomY - 134 - bh)) - 4 : GEO.claimY - 8 - bh;
  return R(GEO.handCx - 330, y, 660, bh);
};

// ------------------------------------------------------------------------------------------------ the screen
export function setSize(w, h) {
  w = Math.round(w); h = Math.round(h);
  const key = `${w}x${h}|${Math.round(host.t)},${Math.round(host.r)},${Math.round(host.b)},${Math.round(host.l)},${Math.round(host.back)}`;
  if (key === GEO.key) return GEO;
  W = w; H = h; GEO.key = key;
  build(w, h);
  return GEO;
}

function build(w, h) {
  const land = w >= h * 1.1, t = Math.max(0, host.t), b = Math.max(0, host.b), l = Math.max(0, host.l), r = Math.max(0, host.r);
  const backClear = host.back ? l + host.back + 14 : 0;
  const px = (w - 720) / 2;                                   // near-square windows: the portrait stack is centred
  GEO.wide = land; GEO.handCx = (l + w - r) / 2; GEO.safeTop = t; GEO.safeBottom = b;
  GEO.backBox = host.back ? R(l, t, host.back + 8, host.back + 8) : R(0, 0, 0, 0);
  if (!land) {
    // ---------------- portrait: tall (approved look) or compact
    const yb = h - Math.max(24, b + 8) - 84;                   // top of the bottom button row (1452 on a 720x1560 screen)
    GEO.bottomY = yb;
    GEO.headerX = Math.max(40, backClear); GEO.headerY1 = t + 80; GEO.headerY2 = t + 112; GEO.headerSize = 40;
    const hdrBottom = t + 124;
    const freeTall = (yb - 324) - hdrBottom - 8, kt = clamp(freeTall / 996, 0, 1);
    if (kt >= 0.9) {
      GEO.mode = 'tall'; GEO.variant = 'tall'; GEO.k = kt; Object.assign(GEO, { hr: 120, cols: 6, rows: 4, hw: 330 });
      const top = hdrBottom + 8 + Math.max(0, freeTall - 996) / 2;
      GEO.cx = w / 2; GEO.cy = top + 568 * kt;
      Object.assign(GEO, { claimY: yb - 324, claimH: 84, pillBelow: true, pillY: yb - 230, pillBelowY: yb - 222, textY: yb - 270, timerY: yb - 346, chowY: yb - 288, chowBackY: yb - 196, chowTitleY: yb - 302, claimStack: false, handMax: 52, handAvail: Math.min(694, w - l - r - 26) });
      HAND_Y = yb - 80;
      // name plates, relative to the ring centre like in the approved phone layout
      const rel = [[0, 0], [160, -326], [-100, -568], [-350, -326]], size = [[220, 84], [190, 60], [200, 60], [190, 60]];
      set(CHIPS[0], 24 + px, yb, 220, 84);
      for (let i = 1; i < 4; i++) set(CHIPS[i], GEO.cx + rel[i][0] * kt, GEO.cy + rel[i][1] * kt, size[i][0], size[i][1]);
    } else {
      GEO.mode = 'compact'; GEO.variant = 'flat';
      const claimY = yb - 211, pillH = 62, botLimit = claimY - 8 - pillH - 6, topY = hdrBottom + 66 + 6;
      const fit = (p) => clamp(Math.min((botLimit - topY) / (p.bottom - p.top), (w - 20) / (2 * p.hw)), 0.5, 1.15);
      const k4 = fit(P.flat4), rows = k4 >= 0.85 ? 4 : 3, p = rows === 4 ? P.flat4 : P.flat3, kk = rows === 4 ? k4 : fit(P.flat3);
      Object.assign(GEO, { k: kk, hr: p.hr, cols: p.cols, rows, hw: p.hw });
      GEO.cx = w / 2; GEO.cy = topY + ((botLimit - topY) - (p.bottom - p.top) * kk) / 2 - p.top * kk;
      Object.assign(GEO, { claimY, claimH: 84, pillBelow: false, pillY: claimY - 8 - pillH, textY: claimY - 8 - pillH + 40, timerY: claimY - 14, chowY: claimY - 4, chowBackY: yb - 188, chowTitleY: claimY - 16, claimStack: false, handMax: 58, handAvail: Math.min(900, w - l - r - 26) });
      HAND_Y = yb - 62;
      const cw = Math.min(216, (w - 28 - 20) / 3), y = hdrBottom + 4, x0 = w / 2 - (3 * cw + 20) / 2;
      set(CHIPS[3], x0, y, cw, 60); set(CHIPS[2], x0 + cw + 10, y, cw, 60); set(CHIPS[1], x0 + 2 * (cw + 10), y, cw, 60); set(CHIPS[0], 24 + px, yb, 220, 84);
    }
    HANDZONE_Y = HAND_Y - 100; GEO.panels = null; GEO.status = null;
    set(BTN.menu, w - r - 28 - 76, t + 44, 76, 76);
    set(BTN.hint, 264 + px, yb, 200, 84); set(BTN.pause, 480 + px, yb, 216, 84);
    set(AUTO_STEP.dec, 180 + px, t + 28, 92, 72); set(AUTO_STEP.inc, 448 + px, t + 28, 92, 72);
    if (backClear && AUTO_STEP.dec.x < backClear) AUTO_STEP.dec.x = backClear;
    GEO.autoCap = { x: w / 2, y: t + 20, size: 15 }; GEO.autoThink = { x: w / 2, y: t + 72, size: 22 };
  } else {
    // ---------------- wide (landscape)
    GEO.mode = 'wide'; GEO.variant = 'flat';
    const maxTw = 58, handBottom = h - Math.max(b, 6) - 10, tileTop = handBottom - maxTw * 1.333;
    const p = P.flat3, availTop = t + 8, availBot = tileTop - 4;
    const kH = (availBot - availTop) / (p.bottom - p.top), kW = (w / 2 - 214 - 14 - Math.max(l, r)) / p.hw;
    const kk = clamp(Math.min(1, kH, kW), 0.5, 1);
    Object.assign(GEO, { k: kk, hr: p.hr, cols: p.cols, rows: 3, hw: p.hw });
    GEO.cx = w / 2; GEO.cy = availTop + ((availBot - availTop) - (p.bottom - p.top) * kk) / 2 - p.top * kk;
    HAND_Y = handBottom - maxTw * 0.667; HANDZONE_Y = tileTop - 30;
    Object.assign(GEO, { handMax: maxTw, handAvail: Math.min(900, w - l - r - 26), claimStack: true, pillBelow: false });
    const clusterL = GEO.cx - p.hw * kk, clusterR = GEO.cx + p.hw * kk, pad = 10;
    const Lp = R(l + pad, t + 8, Math.max(150, clusterL - 12 - (l + pad)), availBot - (t + 8));
    const Rp = R(clusterR + 12, t + 8, Math.max(150, w - r - pad - (clusterR + 12)), availBot - (t + 8));
    GEO.panels = { L: Lp, R: Rp };
    GEO.headerX = Math.max(Lp.x + 4, backClear); GEO.headerY1 = t + 38; GEO.headerY2 = t + 66; GEO.headerSize = 28;
    const bh = 72, gap = 8, ch = 56, c0 = t + 76;
    set(BTN.menu, w - r - 10 - 76, t + 8, 76, 76);
    set(BTN.hint, Lp.x, Lp.y + Lp.h - 2 * (bh + gap) + gap, Lp.w, bh); set(BTN.pause, Lp.x, Lp.y + Lp.h - (bh + gap) + gap, Lp.w, bh);
    set(CHIPS[3], Lp.x, c0, Lp.w, ch); set(CHIPS[2], Lp.x, c0 + ch + 8, Lp.w, ch);
    set(CHIPS[1], Rp.x, t + 8 + 76 + 8, Rp.w, ch); set(CHIPS[0], Rp.x, t + 8 + 76 + 8 + ch + 8, Rp.w, ch);
    const hudY = c0 + 2 * (ch + 8) + 2;
    GEO.autoCap = { x: Lp.x + Lp.w / 2, y: hudY + 14, size: 14 }; GEO.autoThink = { x: Lp.x + Lp.w / 2, y: hudY + 64, size: 20 };
    set(AUTO_STEP.dec, Lp.x, hudY + 20, 60, 60); set(AUTO_STEP.inc, Lp.x + Lp.w - 60, hudY + 20, 60, 60);
    GEO.hudBottom = hudY + 86;
    const cTop = t + 8 + 76 + 8 + 2 * (ch + 8) + 8;
    GEO.claimRect = R(Rp.x, cTop, Rp.w, Rp.y + Rp.h - cTop); GEO.claimH = 70;
    const sTop = c0 + 2 * (ch + 8) + 4;
    GEO.status = R(Lp.x, sTop, Lp.w, BTN.hint.y - 8 - sTop);
  }
  const p = pr();
  RING.cx = GEO.cx; RING.cy = GEO.cy; RING.half = p.hr * GEO.k;
  GEO.hubK = (p.hr / 120) * GEO.k;
  const hwK = p.hw * GEO.k;
  GEO.inlay = GEO.variant === 'tall' ? { x: 16, y: GEO.cy - 360 * GEO.k, w: w - 32, h: 720 * GEO.k } : { x: GEO.cx - hwK - 8, y: GEO.cy + (p.top - 8) * GEO.k, w: 2 * hwK + 16, h: (p.bottom - p.top + 16) * GEO.k };
}
